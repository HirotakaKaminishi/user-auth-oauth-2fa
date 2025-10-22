import { Request, Response } from 'express';
import { OAuthStrategyRegistry } from '../oauth/strategy-registry';
import { EncryptionService } from '../services/encryption-service';
import { PostgresUserRepository } from '../repositories/postgres-user-repository';
import { OAuthProvider } from '../types/oauth';

/**
 * OAuth Controller
 *
 * Handles OAuth 2.0 authentication flow with PKCE:
 * 1. /login - Generate state & code_verifier, redirect to provider
 * 2. /callback - Verify state, exchange code for token, fetch profile, create/update user
 */
export class OAuthController {
  constructor(
    private readonly strategyRegistry: OAuthStrategyRegistry,
    private readonly encryptionService: EncryptionService,
    private readonly userRepository: PostgresUserRepository
  ) {}

  /**
   * Initiate OAuth login
   *
   * GET /api/v1/auth/oauth/:provider/login
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const provider = req.params['provider'] as OAuthProvider;

      // Get OAuth strategy
      const strategyResult = this.strategyRegistry.get(provider);

      if (!strategyResult.success) {
        res.status(400).json({
          error: 'Invalid provider',
          message: 'Unknown provider',
        });
        return;
      }

      const strategy = strategyResult.value;

      // Generate PKCE code_verifier and code_challenge
      const codeVerifierResult = this.encryptionService.generateCodeVerifier();
      if (!codeVerifierResult.success) {
        res.status(500).json({
          error: 'Failed to generate code verifier',
        });
        return;
      }

      const codeVerifier = codeVerifierResult.value;
      const codeChallengeResult = this.encryptionService.generateCodeChallenge(codeVerifier);

      if (!codeChallengeResult.success) {
        res.status(500).json({
          error: 'Failed to generate code challenge',
        });
        return;
      }

      const codeChallenge = codeChallengeResult.value;

      // Generate CSRF state
      const stateResult = this.encryptionService.generateRandomHex(32);
      if (!stateResult.success) {
        res.status(500).json({
          error: 'Failed to generate state',
        });
        return;
      }

      const state = stateResult.value;

      // Store code_verifier and state in session
      (req.session as any).oauth_code_verifier = codeVerifier;
      (req.session as any).oauth_state = state;

      // Build authorization URL
      const authUrlResult = strategy.buildAuthUrl({
        clientId: process.env[`${provider.toUpperCase()}_CLIENT_ID`] || '',
        redirectUri: process.env[`${provider.toUpperCase()}_CALLBACK_URL`] || '',
        scope: this.getDefaultScopes(provider),
        state,
        codeChallenge,
        codeChallengeMethod: 'S256',
      });

      if (!authUrlResult.success) {
        res.status(500).json({
          error: 'Failed to build authorization URL',
        });
        return;
      }

      // Redirect to OAuth provider
      res.redirect(authUrlResult.value);
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handle OAuth callback
   *
   * GET /api/v1/auth/oauth/:provider/callback
   */
  async callback(req: Request, res: Response): Promise<void> {
    try {
      const provider = req.params['provider'] as OAuthProvider;
      const code = req.query['code'] as string | undefined;
      const state = req.query['state'] as string | undefined;
      const error = req.query['error'] as string | undefined;

      // Check for OAuth errors
      if (error) {
        res.status(400).json({
          error: 'OAuth error',
          message: error,
          description: req.query['error_description'],
        });
        return;
      }

      // Validate required parameters
      if (!code || !state) {
        res.status(400).json({
          error: 'Missing code or state parameter',
        });
        return;
      }

      // Verify state (CSRF protection)
      const sessionState = (req.session as any).oauth_state;
      if (!sessionState || state !== sessionState) {
        res.status(403).json({
          error: 'Invalid state parameter',
          message: 'CSRF validation failed',
        });
        return;
      }

      // Get code_verifier from session
      const codeVerifier = (req.session as any).oauth_code_verifier;
      if (!codeVerifier) {
        res.status(400).json({
          error: 'Missing code verifier',
          message: 'Session expired or invalid',
        });
        return;
      }

      // Clear OAuth session data
      delete (req.session as any).oauth_state;
      delete (req.session as any).oauth_code_verifier;

      // Get OAuth strategy
      const strategyResult = this.strategyRegistry.get(provider);
      if (!strategyResult.success) {
        res.status(400).json({
          error: 'Invalid provider',
        });
        return;
      }

      const strategy = strategyResult.value;

      // Exchange code for tokens
      const tokenResult = await strategy.exchangeCode({
        clientId: process.env[`${provider.toUpperCase()}_CLIENT_ID`] || '',
        clientSecret: process.env[`${provider.toUpperCase()}_CLIENT_SECRET`] || '',
        code,
        redirectUri: process.env[`${provider.toUpperCase()}_CALLBACK_URL`] || '',
        codeVerifier,
      });

      if (!tokenResult.success) {
        res.status(400).json({
          error: 'Token exchange failed',
        });
        return;
      }

      const tokens = tokenResult.value;

      // Get user profile
      const profileResult = await strategy.getUserProfile(tokens.accessToken);

      if (!profileResult.success) {
        res.status(400).json({
          error: 'Failed to fetch user profile',
        });
        return;
      }

      const profile = profileResult.value;

      // Find or create user in database (add rawProfile for repository)
      const profileWithRaw = {
        ...profile,
        rawProfile: {}, // Raw profile data (optional for now)
      };

      const userResult = await this.userRepository.findOrCreateByOAuth(profileWithRaw);

      if (!userResult.success) {
        res.status(500).json({
          error: 'Failed to create/update user',
        });
        return;
      }

      const user = userResult.value;

      // Create session
      (req.session as any).userId = user.id;
      (req.session as any).provider = provider;

      // Return success response
      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          picture: user.picture,
          emailVerified: user.emailVerified,
        },
        message: 'Login successful',
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get current user info
   *
   * GET /api/v1/auth/me
   */
  async me(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.session as any).userId;

      if (!userId) {
        res.status(401).json({
          error: 'Not authenticated',
        });
        return;
      }

      const userResult = await this.userRepository.findById(userId);

      if (!userResult.success) {
        res.status(404).json({
          error: 'User not found',
        });
        return;
      }

      const user = userResult.value;

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          picture: user.picture,
          emailVerified: user.emailVerified,
          twoFactorEnabled: user.twoFactorEnabled,
        },
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Logout
   *
   * POST /api/v1/auth/logout
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      req.session.destroy((err) => {
        if (err) {
          res.status(500).json({
            error: 'Failed to logout',
            message: err.message,
          });
          return;
        }

        res.json({
          success: true,
          message: 'Logged out successfully',
        });
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get default scopes for each provider
   */
  private getDefaultScopes(provider: OAuthProvider): string[] {
    switch (provider) {
      // case 'google': // Disabled: GCP account required
      //   return ['openid', 'email', 'profile'];
      case 'github':
        return ['user:email'];
      case 'microsoft':
        return ['openid', 'email', 'profile'];
      default:
        return [];
    }
  }
}
