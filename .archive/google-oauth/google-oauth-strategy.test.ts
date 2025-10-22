import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GoogleOAuthStrategy } from '../../oauth/google-oauth-strategy';
import { OAuthStrategyConfig } from '../../types/oauth';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GoogleOAuthStrategy', () => {
  let strategy: GoogleOAuthStrategy;
  const config: OAuthStrategyConfig = {
    clientId: 'test-google-client-id',
    clientSecret: 'test-google-client-secret',
    redirectUri: 'http://localhost:3000/api/v1/auth/oauth/google/callback',
  };

  beforeEach(() => {
    strategy = new GoogleOAuthStrategy(config);
    jest.clearAllMocks();
  });

  describe('Provider Identification', () => {
    it('should identify as google provider', () => {
      expect(strategy.provider).toBe('google');
    });
  });

  describe('buildAuthUrl', () => {
    it('should build correct Google OAuth authorization URL', () => {
      const result = strategy.buildAuthUrl({
        clientId: config.clientId,
        redirectUri: config.redirectUri,
        scope: ['openid', 'email', 'profile'],
        state: 'random-state-123',
        codeChallenge: 'challenge-hash-abc123',
        codeChallengeMethod: 'S256',
      });

      expect(result.success).toBe(true);

      if (!result.success) return;

      const url = result.value;
      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url).toContain('client_id=test-google-client-id');
      expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fv1%2Fauth%2Foauth%2Fgoogle%2Fcallback');
      expect(url).toContain('response_type=code');
      expect(url).toContain('scope=openid%20email%20profile');
      expect(url).toContain('state=random-state-123');
      expect(url).toContain('code_challenge=challenge-hash-abc123');
      expect(url).toContain('code_challenge_method=S256');
      expect(url).toContain('access_type=offline'); // Request refresh token
      expect(url).toContain('prompt=consent'); // Force consent screen
    });

    it('should include PKCE parameters', () => {
      const result = strategy.buildAuthUrl({
        clientId: config.clientId,
        redirectUri: config.redirectUri,
        scope: ['openid'],
        state: 'state',
        codeChallenge: 'my-challenge',
        codeChallengeMethod: 'S256',
      });

      expect(result.success).toBe(true);

      if (!result.success) return;

      expect(result.value).toContain('code_challenge=my-challenge');
      expect(result.value).toContain('code_challenge_method=S256');
    });
  });

  describe('exchangeCode', () => {
    it('should exchange authorization code for tokens successfully', async () => {
      const mockTokenResponse = {
        access_token: 'google-access-token-123',
        refresh_token: 'google-refresh-token-456',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'openid email profile',
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockTokenResponse });

      const result = await strategy.exchangeCode({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        code: 'auth-code-xyz',
        redirectUri: config.redirectUri,
        codeVerifier: 'verifier-123',
      });

      expect(result.success).toBe(true);

      if (!result.success) return;

      expect(result.value.accessToken).toBe('google-access-token-123');
      expect(result.value.refreshToken).toBe('google-refresh-token-456');
      expect(result.value.expiresIn).toBe(3600);
      expect(result.value.tokenType).toBe('Bearer');
      expect(result.value.scope).toBe('openid email profile');

      // Verify correct API call
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.any(String),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      );
    });

    it('should return error when token exchange fails', async () => {
      const mockError = {
        response: {
          status: 400,
          data: {
            error: 'invalid_grant',
            error_description: 'Invalid authorization code',
          },
        },
      };

      mockedAxios.post.mockRejectedValueOnce(mockError);

      const result = await strategy.exchangeCode({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        code: 'invalid-code',
        redirectUri: config.redirectUri,
        codeVerifier: 'verifier-123',
      });

      expect(result.success).toBe(false);

      if (result.success) return;

      expect(result.error.type).toBe('TOKEN_EXCHANGE_FAILED');
      expect(result.error.message).toContain('Invalid authorization code');
    });

    it('should handle network errors', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Network error'));

      const result = await strategy.exchangeCode({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        code: 'auth-code',
        redirectUri: config.redirectUri,
        codeVerifier: 'verifier',
      });

      expect(result.success).toBe(false);

      if (result.success) return;

      expect(result.error.type).toBe('NETWORK_ERROR');
    });
  });

  describe('getUserProfile', () => {
    it('should fetch user profile successfully', async () => {
      const mockUserInfo = {
        sub: 'google-user-id-123',
        email: 'user@example.com',
        email_verified: true,
        name: 'John Doe',
        picture: 'https://example.com/avatar.jpg',
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockUserInfo });

      const result = await strategy.getUserProfile('access-token-123');

      expect(result.success).toBe(true);

      if (!result.success) return;

      expect(result.value.provider).toBe('google');
      expect(result.value.providerId).toBe('google-user-id-123');
      expect(result.value.email).toBe('user@example.com');
      expect(result.value.emailVerified).toBe(true);
      expect(result.value.name).toBe('John Doe');
      expect(result.value.picture).toBe('https://example.com/avatar.jpg');

      // Verify correct API call
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer access-token-123',
          },
        })
      );
    });

    it('should handle missing optional fields', async () => {
      const mockUserInfo = {
        sub: 'google-user-id-456',
        email: 'user2@example.com',
        email_verified: false,
        name: 'Jane Smith',
        // picture is optional
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockUserInfo });

      const result = await strategy.getUserProfile('access-token-456');

      expect(result.success).toBe(true);

      if (!result.success) return;

      expect(result.value.picture).toBeUndefined();
    });

    it('should return error when profile fetch fails', async () => {
      const mockError = {
        response: {
          status: 401,
          data: {
            error: {
              code: 401,
              message: 'Invalid Credentials',
            },
          },
        },
      };

      mockedAxios.get.mockRejectedValueOnce(mockError);

      const result = await strategy.getUserProfile('invalid-token');

      expect(result.success).toBe(false);

      if (result.success) return;

      expect(result.error.type).toBe('PROFILE_FETCH_FAILED');
      if (result.error.type === 'PROFILE_FETCH_FAILED') {
        expect(result.error.statusCode).toBe(401);
      }
    });
  });

  describe('refreshToken', () => {
    it('should refresh access token successfully', async () => {
      const mockRefreshResponse = {
        access_token: 'new-access-token-789',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'openid email profile',
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockRefreshResponse });

      const result = await strategy.refreshToken('refresh-token-abc');

      expect(result.success).toBe(true);

      if (!result.success) return;

      expect(result.value.accessToken).toBe('new-access-token-789');
      expect(result.value.expiresIn).toBe(3600);
      expect(result.value.tokenType).toBe('Bearer');

      // Verify correct API call
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.any(String),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      );
    });

    it('should return error when refresh fails', async () => {
      const mockError = {
        response: {
          status: 400,
          data: {
            error: 'invalid_grant',
            error_description: 'Token has been expired or revoked',
          },
        },
      };

      mockedAxios.post.mockRejectedValueOnce(mockError);

      const result = await strategy.refreshToken('expired-refresh-token');

      expect(result.success).toBe(false);

      if (result.success) return;

      expect(result.error.type).toBe('TOKEN_REFRESH_FAILED');
    });
  });
});
