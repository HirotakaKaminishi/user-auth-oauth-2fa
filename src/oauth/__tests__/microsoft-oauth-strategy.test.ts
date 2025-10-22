import { MicrosoftOAuthStrategy } from '../microsoft-oauth-strategy';
import { OAuthStrategyConfig, TokenExchangeParams } from '../../types/oauth';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MicrosoftOAuthStrategy', () => {
  let strategy: MicrosoftOAuthStrategy;
  let config: OAuthStrategyConfig;
  let exchangeParams: TokenExchangeParams;

  beforeEach(() => {
    config = {
      clientId: 'test-microsoft-client-id',
      clientSecret: 'test-microsoft-client-secret',
      redirectUri: 'http://localhost:3000/api/v1/auth/oauth/microsoft/callback',
    };
    strategy = new MicrosoftOAuthStrategy(config);
    exchangeParams = {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      code: 'auth-code-123',
      redirectUri: config.redirectUri,
      codeVerifier: 'code-verifier-xyz',
    };
    jest.clearAllMocks();
  });

  describe('provider', () => {
    it('should return microsoft as provider', () => {
      expect(strategy.provider).toBe('microsoft');
    });
  });

  describe('buildAuthUrl', () => {
    it('should build valid authorization URL with PKCE', () => {
      const result = strategy.buildAuthUrl({
        clientId: config.clientId,
        redirectUri: config.redirectUri,
        scope: ['openid', 'email', 'profile'],
        state: 'random-state-123',
        codeChallenge: 'code-challenge-abc',
        codeChallengeMethod: 'S256',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const url = result.value;
        expect(url).toContain('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
        expect(url).toContain('client_id=test-microsoft-client-id');
        expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fv1%2Fauth%2Foauth%2Fmicrosoft%2Fcallback');
        expect(url).toContain('response_type=code');
        expect(url).toContain('scope=openid%20email%20profile');
        expect(url).toContain('state=random-state-123');
        expect(url).toContain('code_challenge=code-challenge-abc');
        expect(url).toContain('code_challenge_method=S256');
        expect(url).toContain('response_mode=query');
      }
    });

    it('should build authorization URL with custom tenant', () => {
      const customStrategy = new MicrosoftOAuthStrategy({
        ...config,
        tenant: 'organizations',
      });

      const result = customStrategy.buildAuthUrl({
        clientId: config.clientId,
        redirectUri: config.redirectUri,
        scope: ['openid', 'email', 'profile'],
        state: 'state-123',
        codeChallenge: 'challenge-123',
        codeChallengeMethod: 'S256',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toContain('https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize');
      }
    });

    it('should handle empty scope array', () => {
      const result = strategy.buildAuthUrl({
        clientId: config.clientId,
        redirectUri: config.redirectUri,
        scope: [],
        state: 'state-123',
        codeChallenge: 'challenge-123',
        codeChallengeMethod: 'S256',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toContain('scope=');
      }
    });
  });

  describe('exchangeCode', () => {
    it('should successfully exchange authorization code for tokens', async () => {
      const mockTokenResponse = {
        data: {
          access_token: 'microsoft-access-token',
          refresh_token: 'microsoft-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'openid email profile',
        },
      };

      mockedAxios.post.mockResolvedValueOnce(mockTokenResponse);

      const result = await strategy.exchangeCode(exchangeParams);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.accessToken).toBe('microsoft-access-token');
        expect(result.value.refreshToken).toBe('microsoft-refresh-token');
        expect(result.value.expiresIn).toBe(3600);
        expect(result.value.tokenType).toBe('Bearer');
        expect(result.value.scope).toBe('openid email profile');
      }

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        expect.any(String),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
      );

      const requestBody = mockedAxios.post.mock.calls[0]?.[1] as string;
      expect(requestBody).toContain('client_id=test-microsoft-client-id');
      expect(requestBody).toContain('client_secret=test-microsoft-client-secret');
      expect(requestBody).toContain('code=auth-code-123');
      expect(requestBody).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fv1%2Fauth%2Foauth%2Fmicrosoft%2Fcallback');
      expect(requestBody).toContain('grant_type=authorization_code');
      expect(requestBody).toContain('code_verifier=code-verifier-xyz');
    });

    it('should handle token exchange failure', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        response: {
          status: 400,
          data: {
            error: 'invalid_grant',
            error_description: 'Invalid authorization code',
          },
        },
      });

      const result = await strategy.exchangeCode(exchangeParams);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('TOKEN_EXCHANGE_FAILED');
        expect(result.error.message).toContain('Invalid authorization code');
      }
    });

    it('should handle network errors during token exchange', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Network error'));

      const result = await strategy.exchangeCode(exchangeParams);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('NETWORK_ERROR');
        expect(result.error.message).toBe('Network error');
      }
    });
  });

  describe('getUserProfile', () => {
    it('should successfully fetch user profile from Microsoft Graph', async () => {
      const mockProfileResponse = {
        data: {
          id: 'microsoft-user-id-123',
          mail: 'user@example.com',
          displayName: 'John Doe',
          userPrincipalName: 'user@example.com',
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockProfileResponse);

      const result = await strategy.getUserProfile('microsoft-access-token');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.provider).toBe('microsoft');
        expect(result.value.providerId).toBe('microsoft-user-id-123');
        expect(result.value.email).toBe('user@example.com');
        expect(result.value.emailVerified).toBe(true);
        expect(result.value.name).toBe('John Doe');
        expect(result.value.picture).toBeUndefined();
      }

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://graph.microsoft.com/v1.0/me',
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer microsoft-access-token',
            Accept: 'application/json',
          },
        })
      );
    });

    it('should use userPrincipalName if mail field is missing', async () => {
      const mockProfileResponse = {
        data: {
          id: 'microsoft-user-id-456',
          userPrincipalName: 'user@tenant.onmicrosoft.com',
          displayName: 'Jane Smith',
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockProfileResponse);

      const result = await strategy.getUserProfile('microsoft-access-token');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.email).toBe('user@tenant.onmicrosoft.com');
        expect(result.value.name).toBe('Jane Smith');
      }
    });

    it('should use id as fallback name if displayName is missing', async () => {
      const mockProfileResponse = {
        data: {
          id: 'microsoft-user-id-789',
          mail: 'user@example.com',
          userPrincipalName: 'user@example.com',
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockProfileResponse);

      const result = await strategy.getUserProfile('microsoft-access-token');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.name).toBe('microsoft-user-id-789');
      }
    });

    it('should handle profile fetch failure', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        response: {
          status: 401,
          data: {
            error: {
              code: 'InvalidAuthenticationToken',
              message: 'Access token is invalid',
            },
          },
        },
      });

      const result = await strategy.getUserProfile('invalid-token');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('PROFILE_FETCH_FAILED');
      }
    });

    it('should handle network errors during profile fetch', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network timeout'));

      const result = await strategy.getUserProfile('microsoft-access-token');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('NETWORK_ERROR');
        expect(result.error.message).toBe('Network timeout');
      }
    });
  });

  describe('refreshToken', () => {
    it('should successfully refresh access token', async () => {
      const mockRefreshResponse = {
        data: {
          access_token: 'new-microsoft-access-token',
          refresh_token: 'new-microsoft-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'openid email profile',
        },
      };

      mockedAxios.post.mockResolvedValueOnce(mockRefreshResponse);

      const result = await strategy.refreshToken('old-refresh-token');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.accessToken).toBe('new-microsoft-access-token');
        expect(result.value.refreshToken).toBe('new-microsoft-refresh-token');
        expect(result.value.expiresIn).toBe(3600);
      }

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        expect.any(String),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
      );

      const requestBody = mockedAxios.post.mock.calls[0]?.[1] as string;
      expect(requestBody).toContain('client_id=test-microsoft-client-id');
      expect(requestBody).toContain('client_secret=test-microsoft-client-secret');
      expect(requestBody).toContain('refresh_token=old-refresh-token');
      expect(requestBody).toContain('grant_type=refresh_token');
    });

    it('should handle refresh token failure', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        response: {
          status: 400,
          data: {
            error: 'invalid_grant',
            error_description: 'Refresh token expired',
          },
        },
      });

      const result = await strategy.refreshToken('expired-refresh-token');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('TOKEN_REFRESH_FAILED');
        expect(result.error.message).toContain('Refresh token expired');
      }
    });

    it('should handle network errors during token refresh', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await strategy.refreshToken('refresh-token');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('NETWORK_ERROR');
        expect(result.error.message).toBe('Connection refused');
      }
    });
  });
});
