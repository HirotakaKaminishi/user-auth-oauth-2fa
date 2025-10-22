/**
 * UserRepository Interface
 * Based on design.md Data Layer specification (line 686-712)
 */

import { Result } from '../types/result';
import {
  User,
  UserId,
  OAuthUserProfile,
  OAuthConnection,
  RepositoryError,
} from '../types/user';

export interface UserRepository {
  /**
   * Find user by OAuth profile or create new user
   * Requirements: 1.2, 1.3
   */
  findOrCreateByOAuth(
    oauthProfile: OAuthUserProfile
  ): Promise<Result<User, RepositoryError>>;

  /**
   * Create new user (for WebAuthn-only registration)
   * Returns the created user with generated ID
   */
  create(email: string, name: string): Promise<Result<User, RepositoryError>>;

  /**
   * Find user by ID
   * Returns NOT_FOUND error if user doesn't exist
   */
  findById(userId: UserId): Promise<Result<User, RepositoryError>>;

  /**
   * Find user by email
   * Returns null if user doesn't exist (not an error)
   */
  findByEmail(email: string): Promise<Result<User | null, RepositoryError>>;

  /**
   * Update user information
   * Uses optimistic locking via updated_at timestamp
   */
  update(user: User): Promise<Result<User, RepositoryError>>;

  /**
   * Add OAuth connection to existing user
   * Requirements: 1.2, 1.3
   */
  addOAuthConnection(
    userId: UserId,
    connection: OAuthConnection
  ): Promise<Result<void, RepositoryError>>;
}
