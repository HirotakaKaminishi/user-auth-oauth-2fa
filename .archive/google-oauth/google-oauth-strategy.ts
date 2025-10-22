import axios from 'axios';
import {
  IOAuthStrategy,
  OAuthProvider,
  AuthUrlParams,
  TokenExchangeParams,
  OAuthTokens,
  OAuthUserProfile,
  OAuthError,
  OAuthStrategyConfig,
} from '../types/oauth';
import { Result, Ok, Err } from '../types/result';
import { buildAuthUrl, parseOAuthErrorResponse } from './oauth-utils';

/**
 * Google OAuth 2.0 Strategy
 *
 * Implements OAuth 2.0 authentication flow with Google Identity Platform.
 * Supports PKCE (RFC 7636) for enhanced security.
 *
 * Endpoints:
 * - Authorization: https://accounts.google.com/o/oauth2/v2/auth
 * - Token: https://oauth2.googleapis.com/token
 * - Userinfo: https://www.googleapis.com/oauth2/v3/userinfo
 *
 * Scopes:
 * - openid: OpenID Connect
 * - email: User's email address
 * - profile: User's basic profile information
 *
 * Reference: https://developers.google.com/identity/protocols/oauth2
 */
export class GoogleOAuthStrategy implements IOAuthStrategy {
  readonly provider: OAuthProvider = 'google';

  private readonly config: OAuthStrategyConfig;

  // Google OAuth 2.0 endpoints
  private readonly authorizationUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  private readonly tokenUrl = 'https://oauth2.googleapis.com/token';
  private readonly userinfoUrl = 'https://www.googleapis.com/oauth2/v3/userinfo';

  constructor(config: OAuthStrategyConfig) {
    this.config = config;
  }

  /**
   * Build Google OAuth authorization URL with PKCE
   */
  buildAuthUrl(params: AuthUrlParams): Result<string, OAuthError> {
    try {
      const queryParams = {
        client_id: params.clientId,
        redirect_uri: params.redirectUri,
        response_type: 'code',
        scope: params.scope.join(' '),
        state: params.state,
        code_challenge: params.codeChallenge,
        code_challenge_method: params.codeChallengeMethod,
        access_type: 'offline', // Request refresh token
        prompt: 'consent', // Force consent screen to get refresh token
      };

      const url = buildAuthUrl(this.authorizationUrl, queryParams);

      return Ok(url);
    } catch (error) {
      return Err({
        type: 'AUTH_URL_GENERATION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCode(params: TokenExchangeParams): Promise<Result<OAuthTokens, OAuthError>> {
    try {
      const requestBody = new URLSearchParams({
        client_id: params.clientId,
        client_secret: params.clientSecret,
        code: params.code,
        redirect_uri: params.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: params.codeVerifier, // PKCE
      });

      const response = await axios.post(this.tokenUrl, requestBody.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const data = response.data;

      return Ok({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        tokenType: data.token_type,
        scope: data.scope,
      });
    } catch (error) {
      const axiosError = error as any;

      if (axiosError.response) {
        const errorInfo = parseOAuthErrorResponse(axiosError.response.data);

        return Err({
          type: 'TOKEN_EXCHANGE_FAILED',
          message: errorInfo.description || errorInfo.error,
          statusCode: axiosError.response.status,
        });
      }

      return Err({
        type: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get user profile from Google userinfo endpoint
   */
  async getUserProfile(accessToken: string): Promise<Result<OAuthUserProfile, OAuthError>> {
    try {
      const response = await axios.get(this.userinfoUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = response.data;

      return Ok({
        provider: this.provider,
        providerId: data.sub, // Google user ID
        email: data.email,
        emailVerified: data.email_verified,
        name: data.name,
        picture: data.picture,
      });
    } catch (error) {
      const axiosError = error as any;

      if (axiosError.response) {
        return Err({
          type: 'PROFILE_FETCH_FAILED',
          message: 'Failed to fetch user profile',
          statusCode: axiosError.response.status,
        });
      }

      return Err({
        type: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<Result<OAuthTokens, OAuthError>> {
    try {
      const requestBody = new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      });

      const response = await axios.post(this.tokenUrl, requestBody.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const data = response.data;

      return Ok({
        accessToken: data.access_token,
        refreshToken: data.refresh_token, // Google may return new refresh token
        expiresIn: data.expires_in,
        tokenType: data.token_type,
        scope: data.scope,
      });
    } catch (error) {
      const axiosError = error as any;

      if (axiosError.response) {
        const errorInfo = parseOAuthErrorResponse(axiosError.response.data);

        return Err({
          type: 'TOKEN_REFRESH_FAILED',
          message: errorInfo.description || errorInfo.error,
          statusCode: axiosError.response.status,
        });
      }

      return Err({
        type: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
