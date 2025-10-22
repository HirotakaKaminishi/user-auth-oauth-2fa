import axios from 'axios';
import {
  IOAuthStrategy,
  OAuthProvider,
  OAuthStrategyConfig,
  AuthUrlParams,
  TokenExchangeParams,
  OAuthTokens,
  OAuthUserProfile,
  OAuthError,
} from '../types/oauth';
import { Result, Ok, Err } from '../types/result';
import { buildAuthUrl, parseOAuthErrorResponse } from './oauth-utils';

/**
 * Microsoft OAuth Strategy Configuration
 */
export interface MicrosoftOAuthStrategyConfig extends OAuthStrategyConfig {
  /**
   * Azure AD tenant ID or common/organizations/consumers
   * Default: 'common' (supports both personal and work accounts)
   */
  tenant?: string;
}

/**
 * Microsoft OAuth 2.0 Strategy with PKCE
 *
 * Implements OAuth 2.0 authentication flow for Microsoft accounts using:
 * - Azure AD / Microsoft identity platform
 * - PKCE (RFC 7636) for enhanced security
 * - Microsoft Graph API for user profile
 *
 * Supported account types (via tenant parameter):
 * - common: Both personal Microsoft accounts and work/school accounts (default)
 * - organizations: Work/school accounts only
 * - consumers: Personal Microsoft accounts only
 * - {tenant-id}: Specific Azure AD tenant
 *
 * @see https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow
 * @see https://docs.microsoft.com/en-us/graph/auth-v2-user
 */
export class MicrosoftOAuthStrategy implements IOAuthStrategy {
  readonly provider: OAuthProvider = 'microsoft';
  private readonly config: MicrosoftOAuthStrategyConfig;
  private readonly tenant: string;
  private readonly baseAuthUrl: string;
  private readonly baseTokenUrl: string;
  private readonly userProfileUrl = 'https://graph.microsoft.com/v1.0/me';

  constructor(config: MicrosoftOAuthStrategyConfig) {
    this.config = config;
    this.tenant = config.tenant || 'common';
    this.baseAuthUrl = `https://login.microsoftonline.com/${this.tenant}/oauth2/v2.0/authorize`;
    this.baseTokenUrl = `https://login.microsoftonline.com/${this.tenant}/oauth2/v2.0/token`;
  }

  /**
   * Build authorization URL for Microsoft OAuth
   *
   * Generates the authorization URL with PKCE parameters to redirect users to Microsoft login.
   *
   * @param params - Authorization URL parameters
   * @returns Authorization URL or error
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
        response_mode: 'query',
      };

      return Ok(buildAuthUrl(this.baseAuthUrl, queryParams));
    } catch (error) {
      return Err({
        type: 'AUTH_URL_GENERATION_FAILED',
        message: error instanceof Error ? error.message : 'Failed to build authorization URL',
      });
    }
  }

  /**
   * Exchange authorization code for access tokens
   *
   * Exchanges the authorization code received from Microsoft for access and refresh tokens.
   * Uses PKCE code_verifier for enhanced security.
   *
   * @param params - Token exchange parameters
   * @returns OAuth tokens or error
   */
  async exchangeCode(params: TokenExchangeParams): Promise<Result<OAuthTokens, OAuthError>> {
    try {
      const requestBody = new URLSearchParams({
        client_id: params.clientId,
        client_secret: params.clientSecret,
        code: params.code,
        redirect_uri: params.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: params.codeVerifier,
      });

      const response = await axios.post(this.baseTokenUrl, requestBody.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      return Ok({
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
        tokenType: response.data.token_type,
        scope: response.data.scope,
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
   * Get user profile from Microsoft Graph API
   *
   * Fetches the authenticated user's profile information from Microsoft Graph.
   *
   * Email field handling:
   * - Prefers 'mail' field (primary email)
   * - Falls back to 'userPrincipalName' if mail is not available
   *
   * @param accessToken - Microsoft Graph access token
   * @returns User profile or error
   */
  async getUserProfile(accessToken: string): Promise<Result<OAuthUserProfile, OAuthError>> {
    try {
      const response = await axios.get(this.userProfileUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      const data = response.data;

      // Microsoft Graph returns 'mail' or 'userPrincipalName'
      const email = data.mail || data.userPrincipalName;
      const name = data.displayName || data.id;

      return Ok({
        provider: this.provider,
        providerId: data.id,
        email,
        emailVerified: true, // Microsoft accounts are pre-verified
        name,
        picture: undefined, // Microsoft Graph doesn't include photo URL in basic profile
      });
    } catch (error) {
      const axiosError = error as any;
      if (axiosError.response) {
        return Err({
          type: 'PROFILE_FETCH_FAILED',
          message:
            axiosError.response.data?.error?.message ||
            'Failed to fetch user profile from Microsoft Graph',
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
   *
   * Obtains a new access token using a previously issued refresh token.
   *
   * @param refreshToken - Microsoft refresh token
   * @returns New OAuth tokens or error
   */
  async refreshToken(refreshToken: string): Promise<Result<OAuthTokens, OAuthError>> {
    try {
      const requestBody = new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      });

      const response = await axios.post(this.baseTokenUrl, requestBody.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      return Ok({
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
        tokenType: response.data.token_type,
        scope: response.data.scope,
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
