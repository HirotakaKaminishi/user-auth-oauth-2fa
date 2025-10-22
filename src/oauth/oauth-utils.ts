/**
 * OAuth Utility Functions
 *
 * Helper functions for OAuth 2.0 flows:
 * - Query string building with URL encoding
 * - Error response parsing
 * - HTTP request helpers
 */

/**
 * Build URL query string from params object
 *
 * Features:
 * - URL encodes all values
 * - Skips undefined values
 * - Handles array values by joining with spaces
 * - Sorts keys alphabetically for consistent output
 *
 * @param params - Parameters object
 * @returns URL-encoded query string
 */
export function buildQueryString(params: Record<string, any>): string {
  const entries = Object.entries(params)
    .filter(([_key, value]) => value !== undefined)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB)) // Sort for consistency
    .map(([key, value]) => {
      const encodedKey = encodeURIComponent(key);
      let encodedValue: string;

      if (Array.isArray(value)) {
        // Join array values with spaces (OAuth scope convention)
        encodedValue = encodeURIComponent(value.join(' '));
      } else {
        encodedValue = encodeURIComponent(String(value));
      }

      return `${encodedKey}=${encodedValue}`;
    });

  return entries.join('&');
}

/**
 * OAuth Error Response Format
 */
export interface OAuthErrorResponse {
  error: string;
  description?: string;
  uri?: string;
}

/**
 * Parse OAuth error response
 *
 * Supports multiple error formats:
 * - Standard OAuth 2.0: { error, error_description, error_uri }
 * - GitHub: { error, error_description, error_uri }
 * - Microsoft: { error, error_description, error_codes, ... }
 * - Custom: { error, message }
 *
 * @param body - Error response body
 * @returns Normalized error object
 */
export function parseOAuthErrorResponse(body: any): OAuthErrorResponse {
  // Handle string responses
  if (typeof body === 'string') {
    return {
      error: 'unknown_error',
      description: body,
    };
  }

  // Handle object responses
  if (typeof body === 'object' && body !== null) {
    const error = body.error || 'unknown_error';
    const description = body.error_description || body.message;
    const uri = body.error_uri;

    return {
      error,
      description,
      uri,
    };
  }

  // Fallback
  return {
    error: 'unknown_error',
    description: 'An unknown error occurred',
  };
}

/**
 * Build OAuth authorization URL
 *
 * @param baseUrl - OAuth provider's authorization endpoint
 * @param params - Authorization parameters
 * @returns Complete authorization URL
 */
export function buildAuthUrl(baseUrl: string, params: Record<string, any>): string {
  const queryString = buildQueryString(params);
  return `${baseUrl}?${queryString}`;
}

/**
 * Validate OAuth state parameter
 *
 * Used for CSRF protection in OAuth flows
 *
 * @param receivedState - State from OAuth callback
 * @param expectedState - State stored in session/cookie
 * @returns True if valid, false otherwise
 */
export function validateState(receivedState: string | undefined, expectedState: string | undefined): boolean {
  if (!receivedState || !expectedState) {
    return false;
  }

  return receivedState === expectedState;
}

/**
 * Extract domain from email address
 *
 * Useful for domain-based routing or restrictions
 *
 * @param email - Email address
 * @returns Domain part of email
 */
export function extractEmailDomain(email: string): string | null {
  const match = email.match(/@(.+)$/);
  return match && match[1] ? match[1] : null;
}

/**
 * Generate OAuth scope string from array
 *
 * @param scopes - Array of scope strings
 * @returns Space-separated scope string
 */
export function buildScopeString(scopes: string[]): string {
  return scopes.join(' ');
}

/**
 * Parse OAuth scope string to array
 *
 * @param scopeString - Space-separated scope string
 * @returns Array of scope strings
 */
export function parseScopeString(scopeString: string): string[] {
  return scopeString.split(' ').filter(scope => scope.length > 0);
}
