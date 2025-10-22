import { Result } from './result';

/**
 * OAuth Provider Types
 */
export type OAuthProvider = 'google' | 'github' | 'microsoft';

/**
 * OAuth User Profile
 *
 * Normalized user profile from OAuth providers
 */
export type OAuthUserProfile = {
  provider: OAuthProvider;
  providerId: string; // Unique ID from provider
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
};

/**
 * OAuth Tokens
 *
 * Access token and optional refresh token from OAuth provider
 */
export type OAuthTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number; // Seconds until expiration
  tokenType: string; // Usually "Bearer"
  scope?: string;
};

/**
 * OAuth Authorization URL Parameters
 */
export type AuthUrlParams = {
  clientId: string;
  redirectUri: string;
  scope: string[];
  state: string; // CSRF protection
  codeChallenge: string; // PKCE code_challenge
  codeChallengeMethod: 'S256'; // PKCE method
};

/**
 * OAuth Token Exchange Parameters
 */
export type TokenExchangeParams = {
  clientId: string;
  clientSecret: string;
  code: string; // Authorization code
  redirectUri: string;
  codeVerifier: string; // PKCE code_verifier
};

/**
 * OAuth Strategy Error Types
 */
export type OAuthError =
  | { type: 'INVALID_PROVIDER'; message: string }
  | { type: 'AUTH_URL_GENERATION_FAILED'; message: string }
  | { type: 'TOKEN_EXCHANGE_FAILED'; message: string; statusCode?: number }
  | { type: 'PROFILE_FETCH_FAILED'; message: string; statusCode?: number }
  | { type: 'TOKEN_REFRESH_FAILED'; message: string; statusCode?: number }
  | { type: 'INVALID_RESPONSE'; message: string }
  | { type: 'NETWORK_ERROR'; message: string };

/**
 * OAuth Strategy Interface
 *
 * Abstract interface that all OAuth provider strategies must implement.
 * Supports OAuth 2.0 with PKCE (RFC 7636) for enhanced security.
 */
export interface IOAuthStrategy {
  /**
   * Get provider name
   */
  readonly provider: OAuthProvider;

  /**
   * Build OAuth authorization URL with PKCE
   *
   * @param params - Authorization URL parameters
   * @returns Authorization URL to redirect user to
   */
  buildAuthUrl(params: AuthUrlParams): Result<string, OAuthError>;

  /**
   * Exchange authorization code for access token
   *
   * @param params - Token exchange parameters
   * @returns OAuth tokens (access token, refresh token, etc.)
   */
  exchangeCode(params: TokenExchangeParams): Promise<Result<OAuthTokens, OAuthError>>;

  /**
   * Get user profile using access token
   *
   * @param accessToken - OAuth access token
   * @returns Normalized user profile
   */
  getUserProfile(accessToken: string): Promise<Result<OAuthUserProfile, OAuthError>>;

  /**
   * Refresh access token using refresh token
   *
   * @param refreshToken - OAuth refresh token
   * @returns New OAuth tokens
   */
  refreshToken(refreshToken: string): Promise<Result<OAuthTokens, OAuthError>>;
}

/**
 * OAuth Strategy Constructor
 */
export interface OAuthStrategyConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}
