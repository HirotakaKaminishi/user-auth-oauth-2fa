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
 * GitHub OAuth 2.0 Strategy
 *
 * Implements OAuth 2.0 authentication flow with GitHub.
 * Supports PKCE (RFC 7636) for enhanced security.
 *
 * Endpoints:
 * - Authorization: https://github.com/login/oauth/authorize
 * - Token: https://github.com/login/oauth/access_token
 * - User API: https://api.github.com/user
 * - Emails API: https://api.github.com/user/emails
 *
 * Scopes:
 * - user:email: Access to user email addresses (including verified status)
 *
 * Notes:
 * - GitHub does not support refresh tokens for OAuth apps
 * - Email address requires separate API call to /user/emails
 * - Primary email is identified by "primary: true" field
 *
 * Reference: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps
 */
export class GitHubOAuthStrategy implements IOAuthStrategy {
  readonly provider: OAuthProvider = 'github';

  // GitHub OAuth endpoints
  private readonly authorizationUrl = 'https://github.com/login/oauth/authorize';
  private readonly tokenUrl = 'https://github.com/login/oauth/access_token';
  private readonly userApiUrl = 'https://api.github.com/user';
  private readonly emailsApiUrl = 'https://api.github.com/user/emails';

  constructor(_config: OAuthStrategyConfig) {
    // Config not used for GitHub as it doesn't need client credentials for user API calls
  }

  /**
   * Build GitHub OAuth authorization URL with PKCE
   */
  buildAuthUrl(params: AuthUrlParams): Result<string, OAuthError> {
    try {
      const queryParams = {
        client_id: params.clientId,
        redirect_uri: params.redirectUri,
        scope: params.scope.join(' '),
        state: params.state,
        code_challenge: params.codeChallenge,
        code_challenge_method: params.codeChallengeMethod,
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
        code_verifier: params.codeVerifier, // PKCE
      });

      const response = await axios.post(this.tokenUrl, requestBody.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json', // GitHub defaults to form-urlencoded response
        },
      });

      const data = response.data;

      return Ok({
        accessToken: data.access_token,
        refreshToken: undefined, // GitHub OAuth apps don't support refresh tokens
        expiresIn: undefined, // GitHub tokens don't expire
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
   * Get user profile from GitHub API
   *
   * Fetches user info from /user and email from /user/emails endpoints
   */
  async getUserProfile(accessToken: string): Promise<Result<OAuthUserProfile, OAuthError>> {
    try {
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      };

      // Fetch user info
      const userResponse = await axios.get(this.userApiUrl, { headers });
      const userData = userResponse.data;

      // Fetch emails to get primary email and verification status
      const emailsResponse = await axios.get(this.emailsApiUrl, { headers });
      const emailsData = emailsResponse.data;

      // Find primary email
      const primaryEmail = emailsData.find((e: any) => e.primary === true);

      if (!primaryEmail) {
        return Err({
          type: 'PROFILE_FETCH_FAILED',
          message: 'No primary email found for user',
        });
      }

      return Ok({
        provider: this.provider,
        providerId: String(userData.id),
        email: primaryEmail.email,
        emailVerified: primaryEmail.verified,
        name: userData.name || userData.login, // Fall back to login if name not set
        picture: userData.avatar_url,
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
   * Refresh access token
   *
   * Note: GitHub OAuth apps do not support refresh tokens.
   * This method always returns an error.
   */
  async refreshToken(_refreshToken: string): Promise<Result<OAuthTokens, OAuthError>> {
    return Err({
      type: 'TOKEN_REFRESH_FAILED',
      message: 'GitHub OAuth apps do not support refresh tokens',
    });
  }
}
