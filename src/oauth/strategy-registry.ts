import { IOAuthStrategy, OAuthProvider, OAuthError } from '../types/oauth';
import { Result, Ok, Err } from '../types/result';

/**
 * OAuth Strategy Registry
 *
 * Central registry for managing OAuth provider strategies.
 * Allows registration and retrieval of strategies by provider name.
 *
 * Usage:
 * ```typescript
 * const registry = new OAuthStrategyRegistry();
 * registry.register(new GoogleOAuthStrategy(config));
 * registry.register(new GitHubOAuthStrategy(config));
 *
 * const strategy = registry.get('google');
 * ```
 */
export class OAuthStrategyRegistry {
  private strategies: Map<OAuthProvider, IOAuthStrategy> = new Map();

  /**
   * Register an OAuth strategy
   *
   * @param strategy - OAuth strategy instance
   * @returns Result indicating success or failure
   */
  register(strategy: IOAuthStrategy): Result<void, OAuthError> {
    const provider = strategy.provider;

    // Check if provider already registered
    if (this.strategies.has(provider)) {
      return Err({
        type: 'INVALID_PROVIDER',
        message: `OAuth provider "${provider}" is already registered`,
      });
    }

    this.strategies.set(provider, strategy);

    return Ok(undefined);
  }

  /**
   * Get OAuth strategy by provider name
   *
   * @param provider - OAuth provider name
   * @returns Result containing strategy or error
   */
  get(provider: OAuthProvider): Result<IOAuthStrategy, OAuthError> {
    const strategy = this.strategies.get(provider);

    if (!strategy) {
      return Err({
        type: 'INVALID_PROVIDER',
        message: `OAuth provider "${provider}" is not registered`,
      });
    }

    return Ok(strategy);
  }

  /**
   * List all registered provider names
   *
   * @returns Array of registered provider names
   */
  listProviders(): OAuthProvider[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Check if provider is registered
   *
   * @param provider - OAuth provider name
   * @returns True if registered, false otherwise
   */
  has(provider: OAuthProvider): boolean {
    return this.strategies.has(provider);
  }

  /**
   * Unregister OAuth strategy
   *
   * @param provider - OAuth provider name
   * @returns Result indicating success or failure
   */
  unregister(provider: OAuthProvider): Result<void, OAuthError> {
    if (!this.strategies.has(provider)) {
      return Err({
        type: 'INVALID_PROVIDER',
        message: `OAuth provider "${provider}" is not registered`,
      });
    }

    this.strategies.delete(provider);

    return Ok(undefined);
  }

  /**
   * Clear all registered strategies
   */
  clear(): void {
    this.strategies.clear();
  }
}
