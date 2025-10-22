import { describe, it, expect } from '@jest/globals';
import { buildQueryString, parseOAuthErrorResponse } from '../../oauth/oauth-utils';

describe('OAuth Utilities', () => {
  describe('buildQueryString', () => {
    it('should build query string from object', () => {
      const params = {
        client_id: 'test-client',
        redirect_uri: 'http://localhost:3000/callback',
        scope: 'openid email profile',
        state: 'random-state-123',
      };

      const queryString = buildQueryString(params);

      expect(queryString).toContain('client_id=test-client');
      expect(queryString).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback');
      expect(queryString).toContain('scope=openid%20email%20profile');
      expect(queryString).toContain('state=random-state-123');
    });

    it('should URL encode special characters', () => {
      const params = {
        redirect_uri: 'https://example.com/callback?foo=bar&baz=qux',
        state: 'state/with+special=chars',
      };

      const queryString = buildQueryString(params);

      expect(queryString).toContain('redirect_uri=https%3A%2F%2Fexample.com%2Fcallback%3Ffoo%3Dbar%26baz%3Dqux');
      expect(queryString).toContain('state=state%2Fwith%2Bspecial%3Dchars');
    });

    it('should handle empty object', () => {
      const queryString = buildQueryString({});

      expect(queryString).toBe('');
    });

    it('should skip undefined values', () => {
      const params = {
        client_id: 'test-client',
        redirect_uri: undefined,
        scope: 'openid',
      };

      const queryString = buildQueryString(params);

      expect(queryString).toContain('client_id=test-client');
      expect(queryString).toContain('scope=openid');
      expect(queryString).not.toContain('redirect_uri');
    });

    it('should handle array values by joining with spaces', () => {
      const params = {
        scope: ['openid', 'email', 'profile'],
      };

      const queryString = buildQueryString(params);

      expect(queryString).toBe('scope=openid%20email%20profile');
    });

    it('should maintain consistent order for testability', () => {
      const params = {
        z_param: 'last',
        a_param: 'first',
        m_param: 'middle',
      };

      const queryString = buildQueryString(params);

      // Should be alphabetically ordered
      const parts = queryString.split('&');
      expect(parts[0]).toContain('a_param=first');
      expect(parts[1]).toContain('m_param=middle');
      expect(parts[2]).toContain('z_param=last');
    });
  });

  describe('parseOAuthErrorResponse', () => {
    it('should parse standard OAuth error response', () => {
      const errorBody = {
        error: 'invalid_grant',
        error_description: 'The authorization code is invalid',
      };

      const result = parseOAuthErrorResponse(errorBody);

      expect(result.error).toBe('invalid_grant');
      expect(result.description).toBe('The authorization code is invalid');
    });

    it('should handle error_description field', () => {
      const errorBody = {
        error: 'access_denied',
        error_description: 'User denied access',
      };

      const result = parseOAuthErrorResponse(errorBody);

      expect(result.error).toBe('access_denied');
      expect(result.description).toBe('User denied access');
    });

    it('should handle missing error_description', () => {
      const errorBody = {
        error: 'server_error',
      };

      const result = parseOAuthErrorResponse(errorBody);

      expect(result.error).toBe('server_error');
      expect(result.description).toBeUndefined();
    });

    it('should handle non-standard error format with message', () => {
      const errorBody = {
        error: 'api_error',
        message: 'Something went wrong',
      };

      const result = parseOAuthErrorResponse(errorBody);

      expect(result.error).toBe('api_error');
      expect(result.description).toBe('Something went wrong');
    });

    it('should handle string error response', () => {
      const errorBody = 'Invalid request';

      const result = parseOAuthErrorResponse(errorBody);

      expect(result.error).toBe('unknown_error');
      expect(result.description).toBe('Invalid request');
    });

    it('should handle GitHub error format', () => {
      const errorBody = {
        error: 'bad_verification_code',
        error_description: 'The code passed is incorrect or expired.',
        error_uri: 'https://docs.github.com/apps/oauth-apps',
      };

      const result = parseOAuthErrorResponse(errorBody);

      expect(result.error).toBe('bad_verification_code');
      expect(result.description).toBe('The code passed is incorrect or expired.');
      expect(result.uri).toBe('https://docs.github.com/apps/oauth-apps');
    });

    it('should handle Microsoft error format', () => {
      const errorBody = {
        error: 'invalid_request',
        error_description: 'AADSTS90014: Required field missing',
        error_codes: [90014],
        timestamp: '2025-10-21 00:00:00Z',
        trace_id: 'abc-123',
      };

      const result = parseOAuthErrorResponse(errorBody);

      expect(result.error).toBe('invalid_request');
      expect(result.description).toBe('AADSTS90014: Required field missing');
    });
  });
});
