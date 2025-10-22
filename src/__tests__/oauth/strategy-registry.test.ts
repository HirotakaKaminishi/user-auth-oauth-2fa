import { describe, it, expect, beforeEach } from '@jest/globals';
import { OAuthStrategyRegistry } from '../../oauth/strategy-registry';
import {
  IOAuthStrategy,
  OAuthProvider,
  AuthUrlParams,
  TokenExchangeParams,
  OAuthTokens,
  OAuthUserProfile,
  OAuthError,
  OAuthStrategyConfig,
} from '../../types/oauth';
import { Result, Ok } from '../../types/result';

// Mock OAuth Strategy for testing
class MockOAuthStrategy implements IOAuthStrategy {
  readonly provider: OAuthProvider;

  constructor(provider: OAuthProvider, _config: OAuthStrategyConfig) {
    this.provider = provider;
  }

  buildAuthUrl(_params: AuthUrlParams): Result<string, OAuthError> {
    return Ok(`https://${this.provider}.example.com/oauth/authorize`);
  }

  async exchangeCode(_params: TokenExchangeParams): Promise<Result<OAuthTokens, OAuthError>> {
    return Ok({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      expiresIn: 3600,
      tokenType: 'Bearer',
    });
  }

  async getUserProfile(_accessToken: string): Promise<Result<OAuthUserProfile, OAuthError>> {
    return Ok({
      provider: this.provider,
      providerId: 'mock-user-id',
      email: 'user@example.com',
      emailVerified: true,
      name: 'Mock User',
    });
  }

  async refreshToken(_refreshToken: string): Promise<Result<OAuthTokens, OAuthError>> {
    return Ok({
      accessToken: 'new-access-token',
      expiresIn: 3600,
      tokenType: 'Bearer',
    });
  }
}

describe('OAuthStrategyRegistry', () => {
  let registry: OAuthStrategyRegistry;

  beforeEach(() => {
    registry = new OAuthStrategyRegistry();
  });

  describe('Strategy Registration', () => {
    it('should register OAuth strategy successfully', () => {
      const mockStrategy = new MockOAuthStrategy('google', {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3000/callback',
      });

      const result = registry.register(mockStrategy);

      expect(result.success).toBe(true);
    });

    it('should prevent registering duplicate provider', () => {
      const strategy1 = new MockOAuthStrategy('google', {
        clientId: 'client-1',
        clientSecret: 'secret-1',
        redirectUri: 'http://localhost:3000/callback',
      });

      const strategy2 = new MockOAuthStrategy('google', {
        clientId: 'client-2',
        clientSecret: 'secret-2',
        redirectUri: 'http://localhost:3000/callback',
      });

      registry.register(strategy1);
      const result = registry.register(strategy2);

      expect(result.success).toBe(false);

      if (result.success) return;

      expect(result.error.type).toBe('INVALID_PROVIDER');
      expect(result.error.message).toContain('already registered');
    });

    it('should register multiple different providers', () => {
      const googleStrategy = new MockOAuthStrategy('google', {
        clientId: 'google-client',
        clientSecret: 'google-secret',
        redirectUri: 'http://localhost:3000/callback',
      });

      const githubStrategy = new MockOAuthStrategy('github', {
        clientId: 'github-client',
        clientSecret: 'github-secret',
        redirectUri: 'http://localhost:3000/callback',
      });

      const microsoftStrategy = new MockOAuthStrategy('microsoft', {
        clientId: 'microsoft-client',
        clientSecret: 'microsoft-secret',
        redirectUri: 'http://localhost:3000/callback',
      });

      const result1 = registry.register(googleStrategy);
      const result2 = registry.register(githubStrategy);
      const result3 = registry.register(microsoftStrategy);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);
    });
  });

  describe('Strategy Retrieval', () => {
    it('should retrieve registered strategy by provider name', () => {
      const mockStrategy = new MockOAuthStrategy('google', {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3000/callback',
      });

      registry.register(mockStrategy);
      const result = registry.get('google');

      expect(result.success).toBe(true);

      if (!result.success) return;

      expect(result.value.provider).toBe('google');
    });

    it('should return error for unregistered provider', () => {
      const result = registry.get('google');

      expect(result.success).toBe(false);

      if (result.success) return;

      expect(result.error.type).toBe('INVALID_PROVIDER');
      expect(result.error.message).toContain('not registered');
    });

    it('should retrieve correct strategy for each provider', () => {
      const googleStrategy = new MockOAuthStrategy('google', {
        clientId: 'google-client',
        clientSecret: 'google-secret',
        redirectUri: 'http://localhost:3000/callback',
      });

      const githubStrategy = new MockOAuthStrategy('github', {
        clientId: 'github-client',
        clientSecret: 'github-secret',
        redirectUri: 'http://localhost:3000/callback',
      });

      registry.register(googleStrategy);
      registry.register(githubStrategy);

      const googleResult = registry.get('google');
      const githubResult = registry.get('github');

      expect(googleResult.success).toBe(true);
      expect(githubResult.success).toBe(true);

      if (!googleResult.success || !githubResult.success) return;

      expect(googleResult.value.provider).toBe('google');
      expect(githubResult.value.provider).toBe('github');
    });
  });

  describe('Strategy Listing', () => {
    it('should return empty array when no strategies registered', () => {
      const providers = registry.listProviders();

      expect(providers).toEqual([]);
    });

    it('should list all registered provider names', () => {
      const googleStrategy = new MockOAuthStrategy('google', {
        clientId: 'google-client',
        clientSecret: 'google-secret',
        redirectUri: 'http://localhost:3000/callback',
      });

      const githubStrategy = new MockOAuthStrategy('github', {
        clientId: 'github-client',
        clientSecret: 'github-secret',
        redirectUri: 'http://localhost:3000/callback',
      });

      registry.register(googleStrategy);
      registry.register(githubStrategy);

      const providers = registry.listProviders();

      expect(providers).toHaveLength(2);
      expect(providers).toContain('google');
      expect(providers).toContain('github');
    });
  });

  describe('Strategy Integration', () => {
    it('should use retrieved strategy to build auth URL', () => {
      const mockStrategy = new MockOAuthStrategy('google', {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3000/callback',
      });

      registry.register(mockStrategy);
      const strategyResult = registry.get('google');

      expect(strategyResult.success).toBe(true);

      if (!strategyResult.success) return;

      const strategy = strategyResult.value;
      const authUrlResult = strategy.buildAuthUrl({
        clientId: 'test-client-id',
        redirectUri: 'http://localhost:3000/callback',
        scope: ['openid', 'email', 'profile'],
        state: 'random-state-123',
        codeChallenge: 'challenge-hash',
        codeChallengeMethod: 'S256',
      });

      expect(authUrlResult.success).toBe(true);

      if (!authUrlResult.success) return;

      expect(authUrlResult.value).toContain('google.example.com');
    });

    it('should use retrieved strategy to exchange code', async () => {
      const mockStrategy = new MockOAuthStrategy('github', {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3000/callback',
      });

      registry.register(mockStrategy);
      const strategyResult = registry.get('github');

      expect(strategyResult.success).toBe(true);

      if (!strategyResult.success) return;

      const strategy = strategyResult.value;
      const tokenResult = await strategy.exchangeCode({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        code: 'auth-code-123',
        redirectUri: 'http://localhost:3000/callback',
        codeVerifier: 'verifier-123',
      });

      expect(tokenResult.success).toBe(true);

      if (!tokenResult.success) return;

      expect(tokenResult.value.accessToken).toBe('mock-access-token');
      expect(tokenResult.value.tokenType).toBe('Bearer');
    });
  });
});
