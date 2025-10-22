import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GitHubOAuthStrategy } from '../../oauth/github-oauth-strategy';
import { OAuthStrategyConfig } from '../../types/oauth';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GitHubOAuthStrategy', () => {
  let strategy: GitHubOAuthStrategy;
  const config: OAuthStrategyConfig = {
    clientId: 'test-github-client-id',
    clientSecret: 'test-github-client-secret',
    redirectUri: 'http://localhost:3000/api/v1/auth/oauth/github/callback',
  };

  beforeEach(() => {
    strategy = new GitHubOAuthStrategy(config);
    jest.clearAllMocks();
  });

  describe('Provider Identification', () => {
    it('should identify as github provider', () => {
      expect(strategy.provider).toBe('github');
    });
  });

  describe('buildAuthUrl', () => {
    it('should build correct GitHub OAuth authorization URL', () => {
      const result = strategy.buildAuthUrl({
        clientId: config.clientId,
        redirectUri: config.redirectUri,
        scope: ['user:email'],
        state: 'random-state-456',
        codeChallenge: 'challenge-hash-def456',
        codeChallengeMethod: 'S256',
      });

      expect(result.success).toBe(true);

      if (!result.success) return;

      const url = result.value;
      expect(url).toContain('https://github.com/login/oauth/authorize');
      expect(url).toContain('client_id=test-github-client-id');
      expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fv1%2Fauth%2Foauth%2Fgithub%2Fcallback');
      expect(url).toContain('scope=user%3Aemail');
      expect(url).toContain('state=random-state-456');
      expect(url).toContain('code_challenge=challenge-hash-def456');
      expect(url).toContain('code_challenge_method=S256');
    });
  });

  describe('exchangeCode', () => {
    it('should exchange authorization code for tokens successfully', async () => {
      const mockTokenResponse = {
        access_token: 'github-access-token-789',
        token_type: 'bearer',
        scope: 'user:email',
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockTokenResponse });

      const result = await strategy.exchangeCode({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        code: 'github-auth-code-abc',
        redirectUri: config.redirectUri,
        codeVerifier: 'github-verifier-789',
      });

      expect(result.success).toBe(true);

      if (!result.success) return;

      expect(result.value.accessToken).toBe('github-access-token-789');
      expect(result.value.tokenType).toBe('bearer');
      expect(result.value.scope).toBe('user:email');

      // Verify correct API call with JSON Accept header
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://github.com/login/oauth/access_token',
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': 'application/json',
          }),
        })
      );
    });

    it('should return error when token exchange fails', async () => {
      const mockError = {
        response: {
          status: 400,
          data: {
            error: 'bad_verification_code',
            error_description: 'The code passed is incorrect or expired.',
          },
        },
      };

      mockedAxios.post.mockRejectedValueOnce(mockError);

      const result = await strategy.exchangeCode({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        code: 'invalid-github-code',
        redirectUri: config.redirectUri,
        codeVerifier: 'verifier',
      });

      expect(result.success).toBe(false);

      if (result.success) return;

      expect(result.error.type).toBe('TOKEN_EXCHANGE_FAILED');
    });
  });

  describe('getUserProfile', () => {
    it('should fetch user profile with email from multiple endpoints', async () => {
      const mockUserInfo = {
        id: 12345678,
        login: 'octocat',
        name: 'The Octocat',
        avatar_url: 'https://github.com/images/error/octocat_happy.gif',
      };

      const mockEmails = [
        {
          email: 'secondary@example.com',
          primary: false,
          verified: true,
        },
        {
          email: 'octocat@github.com',
          primary: true,
          verified: true,
        },
      ];

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockUserInfo })
        .mockResolvedValueOnce({ data: mockEmails });

      const result = await strategy.getUserProfile('github-access-token');

      expect(result.success).toBe(true);

      if (!result.success) return;

      expect(result.value.provider).toBe('github');
      expect(result.value.providerId).toBe('12345678');
      expect(result.value.email).toBe('octocat@github.com'); // Primary email
      expect(result.value.emailVerified).toBe(true);
      expect(result.value.name).toBe('The Octocat');
      expect(result.value.picture).toBe('https://github.com/images/error/octocat_happy.gif');

      // Verify correct API calls
      expect(mockedAxios.get).toHaveBeenNthCalledWith(
        1,
        'https://api.github.com/user',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer github-access-token',
            'Accept': 'application/json',
          }),
        })
      );

      expect(mockedAxios.get).toHaveBeenNthCalledWith(
        2,
        'https://api.github.com/user/emails',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer github-access-token',
            'Accept': 'application/json',
          }),
        })
      );
    });

    it('should handle user with login as fallback name', async () => {
      const mockUserInfo = {
        id: 99999,
        login: 'testuser',
        name: null, // No display name set
        avatar_url: 'https://avatars.githubusercontent.com/u/99999',
      };

      const mockEmails = [
        {
          email: 'test@example.com',
          primary: true,
          verified: false,
        },
      ];

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockUserInfo })
        .mockResolvedValueOnce({ data: mockEmails });

      const result = await strategy.getUserProfile('token');

      expect(result.success).toBe(true);

      if (!result.success) return;

      expect(result.value.name).toBe('testuser'); // Falls back to login
      expect(result.value.emailVerified).toBe(false);
    });

    it('should return error when user info fetch fails', async () => {
      const mockError = {
        response: {
          status: 401,
          data: {
            message: 'Bad credentials',
          },
        },
      };

      mockedAxios.get.mockRejectedValueOnce(mockError);

      const result = await strategy.getUserProfile('invalid-token');

      expect(result.success).toBe(false);

      if (result.success) return;

      expect(result.error.type).toBe('PROFILE_FETCH_FAILED');
    });
  });

  describe('refreshToken', () => {
    it('should return error as GitHub does not support refresh tokens', async () => {
      const result = await strategy.refreshToken('any-token');

      expect(result.success).toBe(false);

      if (result.success) return;

      expect(result.error.type).toBe('TOKEN_REFRESH_FAILED');
      expect(result.error.message).toContain('do not support refresh tokens');
    });
  });
});
