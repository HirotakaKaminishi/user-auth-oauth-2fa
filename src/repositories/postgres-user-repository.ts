/**
 * PostgreSQL UserRepository Implementation
 * Task 2.2: UserRepository with CRUD operations
 *
 * Features:
 * - OAuth-based user creation and lookup
 * - Optimistic locking via updated_at
 * - 2FA settings management
 * - Multi-provider OAuth connections
 */

import { Pool, PoolClient } from 'pg';
import { UserRepository } from './user-repository.interface';
import { Result, Ok, Err } from '../types/result';
import {
  User,
  UserId,
  OAuthUserProfile,
  OAuthConnection,
  RepositoryError,
} from '../types/user';
import { logger } from '../config/logger';

export class PostgresUserRepository implements UserRepository {
  constructor(private pool: Pool) {}

  /**
   * Find user by OAuth profile or create new user
   * Requirements: 1.2, 1.3 - OAuth login and auto user creation
   */
  async findOrCreateByOAuth(
    oauthProfile: OAuthUserProfile
  ): Promise<Result<User, RepositoryError>> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // First, check if OAuth connection exists
      const oauthResult = await client.query(
        `SELECT user_id FROM oauth_connections
         WHERE provider = $1 AND provider_id = $2`,
        [oauthProfile.provider, oauthProfile.providerId]
      );

      let userId: UserId;

      if (oauthResult.rows.length > 0) {
        // OAuth connection exists, update last_used_at
        userId = oauthResult.rows[0].user_id;
        await client.query(
          `UPDATE oauth_connections
           SET last_used_at = NOW()
           WHERE provider = $1 AND provider_id = $2`,
          [oauthProfile.provider, oauthProfile.providerId]
        );

        logger.info('OAuth connection found, updated last_used_at', {
          userId,
          provider: oauthProfile.provider,
        });
      } else {
        // Check if user exists with this email
        const userResult = await client.query(
          `SELECT id FROM users WHERE email = $1`,
          [oauthProfile.email]
        );

        if (userResult.rows.length > 0) {
          // User exists, add OAuth connection
          userId = userResult.rows[0].id;
          await this.insertOAuthConnection(client, userId, {
            provider: oauthProfile.provider,
            providerId: oauthProfile.providerId,
            connectedAt: new Date(),
            lastUsedAt: new Date(),
          });

          logger.info('User exists, added OAuth connection', {
            userId,
            provider: oauthProfile.provider,
          });
        } else {
          // Create new user
          const insertResult = await client.query(
            `INSERT INTO users (email, email_verified, name, picture, account_status, failed_login_attempts)
             VALUES ($1, $2, $3, $4, 'active', 0)
             RETURNING id`,
            [
              oauthProfile.email,
              oauthProfile.emailVerified,
              oauthProfile.name,
              oauthProfile.picture || null,
            ]
          );

          userId = insertResult.rows[0].id;

          // Create OAuth connection
          await this.insertOAuthConnection(client, userId, {
            provider: oauthProfile.provider,
            providerId: oauthProfile.providerId,
            connectedAt: new Date(),
            lastUsedAt: new Date(),
          });

          logger.info('Created new user with OAuth connection', {
            userId,
            email: oauthProfile.email,
            provider: oauthProfile.provider,
          });
        }
      }

      await client.query('COMMIT');

      // Fetch and return complete user object
      return await this.findById(userId);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error in findOrCreateByOAuth', { error });

      if (error instanceof Error) {
        if (error.message.includes('duplicate key')) {
          return Err({
            type: 'DUPLICATE_EMAIL',
            email: oauthProfile.email,
          });
        }
        return Err({
          type: 'DATABASE_ERROR',
          cause: error,
        });
      }

      return Err({
        type: 'DATABASE_ERROR',
        cause: new Error('Unknown error'),
      });
    } finally {
      client.release();
    }
  }

  /**
   * Create new user (for WebAuthn-only registration)
   * Returns the created user with generated ID
   */
  async create(email: string, name: string): Promise<Result<User, RepositoryError>> {
    try {
      const result = await this.pool.query(
        `INSERT INTO users (email, email_verified, name, account_status, failed_login_attempts)
         VALUES ($1, false, $2, 'active', 0)
         RETURNING id`,
        [email, name]
      );

      const userId = result.rows[0].id;

      logger.info('Created new WebAuthn-only user', { userId, email });

      // Return the complete user object
      return await this.findById(userId);
    } catch (error) {
      logger.error('Error in create user', { error, email });

      if (error instanceof Error) {
        if (error.message.includes('duplicate key')) {
          return Err({
            type: 'DUPLICATE_EMAIL',
            email,
          });
        }
        return Err({
          type: 'DATABASE_ERROR',
          cause: error,
        });
      }

      return Err({
        type: 'DATABASE_ERROR',
        cause: new Error('Unknown error'),
      });
    }
  }

  /**
   * Find user by ID
   * Returns NOT_FOUND error if user doesn't exist
   */
  async findById(userId: UserId): Promise<Result<User, RepositoryError>> {
    try {
      const result = await this.pool.query(
        `SELECT
          u.id, u.email, u.email_verified, u.name, u.picture,
          u.account_status, u.failed_login_attempts, u.locked_until,
          u.created_at, u.updated_at,
          tfc.enabled as two_factor_enabled,
          tfc.secret_encrypted as two_factor_secret,
          tfc.recovery_codes_hashed as recovery_codes
         FROM users u
         LEFT JOIN two_factor_credentials tfc ON u.id = tfc.user_id
         WHERE u.id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return Err({
          type: 'NOT_FOUND',
          entityId: userId,
        });
      }

      const row = result.rows[0];

      // Fetch OAuth connections
      const oauthResult = await this.pool.query(
        `SELECT provider, provider_id, connected_at, last_used_at
         FROM oauth_connections
         WHERE user_id = $1
         ORDER BY connected_at ASC`,
        [userId]
      );

      const oauthConnections: OAuthConnection[] = oauthResult.rows.map((r) => ({
        provider: r.provider,
        providerId: r.provider_id,
        connectedAt: r.connected_at,
        lastUsedAt: r.last_used_at,
      }));

      const user: User = {
        id: row.id,
        email: row.email,
        emailVerified: row.email_verified,
        name: row.name,
        picture: row.picture,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        oauthConnections,
        accountStatus: row.account_status,
        failedLoginAttempts: row.failed_login_attempts,
        lockedUntil: row.locked_until,
      };

      return Ok(user);
    } catch (error) {
      logger.error('Error in findById', { userId, error });
      if (error instanceof Error) {
        return Err({
          type: 'DATABASE_ERROR',
          cause: error,
        });
      }
      return Err({
        type: 'DATABASE_ERROR',
        cause: new Error('Unknown error'),
      });
    }
  }

  /**
   * Find user by email
   * Returns null if user doesn't exist (not an error)
   */
  async findByEmail(email: string): Promise<Result<User | null, RepositoryError>> {
    try {
      const result = await this.pool.query(
        `SELECT id FROM users WHERE email = $1`,
        [email]
      );

      if (result.rows.length === 0) {
        return Ok(null);
      }

      return await this.findById(result.rows[0].id);
    } catch (error) {
      logger.error('Error in findByEmail', { email, error });
      if (error instanceof Error) {
        return Err({
          type: 'DATABASE_ERROR',
          cause: error,
        });
      }
      return Err({
        type: 'DATABASE_ERROR',
        cause: new Error('Unknown error'),
      });
    }
  }

  /**
   * Update user information
   * Uses optimistic locking via updated_at timestamp
   */
  async update(user: User): Promise<Result<User, RepositoryError>> {
    try {
      const result = await this.pool.query(
        `UPDATE users
         SET
           name = $1,
           picture = $2,
           account_status = $3,
           failed_login_attempts = $4,
           locked_until = $5,
           updated_at = NOW()
         WHERE id = $6 AND updated_at = $7
         RETURNING updated_at`,
        [
          user.name,
          user.picture,
          user.accountStatus,
          user.failedLoginAttempts,
          user.lockedUntil,
          user.id,
          user.updatedAt,
        ]
      );

      if (result.rows.length === 0) {
        // Check if user exists
        const checkResult = await this.pool.query(
          `SELECT id FROM users WHERE id = $1`,
          [user.id]
        );

        if (checkResult.rows.length === 0) {
          return Err({
            type: 'NOT_FOUND',
            entityId: user.id,
          });
        }

        // User exists but updated_at doesn't match - optimistic lock failure
        logger.warn('Optimistic lock conflict in update', { userId: user.id });
        return Err({
          type: 'OPTIMISTIC_LOCK_ERROR',
          entityId: user.id,
        });
      }

      logger.info('User updated successfully', { userId: user.id });

      // Fetch and return updated user
      return await this.findById(user.id);
    } catch (error) {
      logger.error('Error in update', { userId: user.id, error });
      if (error instanceof Error) {
        return Err({
          type: 'DATABASE_ERROR',
          cause: error,
        });
      }
      return Err({
        type: 'DATABASE_ERROR',
        cause: new Error('Unknown error'),
      });
    }
  }

  /**
   * Add OAuth connection to existing user
   * Requirements: 1.2, 1.3 - OAuth login
   */
  async addOAuthConnection(
    userId: UserId,
    connection: OAuthConnection
  ): Promise<Result<void, RepositoryError>> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Check if user exists
      const userResult = await client.query(
        `SELECT id FROM users WHERE id = $1`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return Err({
          type: 'NOT_FOUND',
          entityId: userId,
        });
      }

      // Check for duplicate OAuth connection
      const duplicateResult = await client.query(
        `SELECT id FROM oauth_connections
         WHERE provider = $1 AND provider_id = $2`,
        [connection.provider, connection.providerId]
      );

      if (duplicateResult.rows.length > 0) {
        await client.query('ROLLBACK');
        return Err({
          type: 'DUPLICATE_OAUTH_CONNECTION',
          provider: connection.provider,
          providerId: connection.providerId,
        });
      }

      await this.insertOAuthConnection(client, userId, connection);

      await client.query('COMMIT');

      logger.info('OAuth connection added', {
        userId,
        provider: connection.provider,
      });

      return Ok(undefined);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error in addOAuthConnection', { userId, error });

      if (error instanceof Error) {
        if (error.message.includes('duplicate key')) {
          return Err({
            type: 'DUPLICATE_OAUTH_CONNECTION',
            provider: connection.provider,
            providerId: connection.providerId,
          });
        }
        return Err({
          type: 'DATABASE_ERROR',
          cause: error,
        });
      }

      return Err({
        type: 'DATABASE_ERROR',
        cause: new Error('Unknown error'),
      });
    } finally {
      client.release();
    }
  }

  /**
   * Helper method to insert OAuth connection
   */
  private async insertOAuthConnection(
    client: PoolClient,
    userId: UserId,
    connection: OAuthConnection
  ): Promise<void> {
    await client.query(
      `INSERT INTO oauth_connections (user_id, provider, provider_id, connected_at, last_used_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        connection.provider,
        connection.providerId,
        connection.connectedAt,
        connection.lastUsedAt,
      ]
    );
  }
}
