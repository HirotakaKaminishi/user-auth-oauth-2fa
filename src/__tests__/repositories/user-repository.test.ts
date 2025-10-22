/**
 * UserRepository Tests (TDD)
 * Task 2.2: UserRepository implementation tests
 *
 * Test Coverage:
 * - findOrCreateByOAuth: Create new user, find existing user, handle duplicate OAuth connection
 * - findById: Find existing user, handle not found
 * - findByEmail: Find existing user, return null for non-existent
 * - update: Update user info, handle optimistic locking
 * - update2FASettings: Update 2FA settings, validate encryption
 * - addOAuthConnection: Add connection, prevent duplicates
 */

import { Pool } from 'pg';
import { PostgresUserRepository } from '../../repositories/postgres-user-repository';
import {
  OAuthUserProfile,
  OAuthConnection,
  TwoFactorSettings,
  User,
} from '../../types/user';
import { isOk, isErr } from '../../types/result';

describe('UserRepository', () => {
  let pool: Pool;
  let repository: PostgresUserRepository;

  beforeAll(async () => {
    // Use test database connection
    pool = new Pool({
      host: process.env['DB_HOST'] || 'localhost',
      port: parseInt(process.env['DB_PORT'] || '5432'),
      database: process.env['DB_NAME'] || 'auth_db_test',
      user: process.env['DB_USER'] || 'postgres',
      password: process.env['DB_PASSWORD'] || 'postgres',
    });

    repository = new PostgresUserRepository(pool);

    // Clean up test data
    await pool.query('DELETE FROM oauth_connections');
    await pool.query('DELETE FROM two_factor_credentials');
    await pool.query('DELETE FROM users');
  });

  afterAll(async () => {
    await pool.end();
  });

  afterEach(async () => {
    // Clean up after each test
    await pool.query('DELETE FROM oauth_connections');
    await pool.query('DELETE FROM two_factor_credentials');
    await pool.query('DELETE FROM users');
  });

  describe('findOrCreateByOAuth', () => {
    const googleProfile: OAuthUserProfile = {
      provider: 'google',
      providerId: 'google-123',
      email: 'test@example.com',
      emailVerified: true,
      name: 'Test User',
      picture: 'https://example.com/avatar.jpg',
      rawProfile: { sub: 'google-123' },
    };

    it('should create new user when OAuth profile does not exist', async () => {
      const result = await repository.findOrCreateByOAuth(googleProfile);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const user = result.value;
        expect(user.id).toBeDefined();
        expect(user.email).toBe('test@example.com');
        expect(user.emailVerified).toBe(true);
        expect(user.name).toBe('Test User');
        expect(user.picture).toBe('https://example.com/avatar.jpg');
        expect(user.accountStatus).toBe('active');
        expect(user.twoFactorEnabled).toBe(false);
        expect(user.failedLoginAttempts).toBe(0);
        expect(user.oauthConnections).toHaveLength(1);
        expect(user.oauthConnections[0]?.provider).toBe('google');
        expect(user.oauthConnections[0]?.providerId).toBe('google-123');
      }
    });

    it('should find existing user when OAuth connection already exists', async () => {
      // First create
      const createResult = await repository.findOrCreateByOAuth(googleProfile);
      expect(isOk(createResult)).toBe(true);

      if (!isOk(createResult)) return;
      const createdUser = createResult.value;

      // Second call should find existing user
      const findResult = await repository.findOrCreateByOAuth(googleProfile);
      expect(isOk(findResult)).toBe(true);

      if (isOk(findResult)) {
        const foundUser = findResult.value;
        expect(foundUser.id).toBe(createdUser.id);
        expect(foundUser.email).toBe(createdUser.email);
      }
    });

    it('should create new user with same email but different provider', async () => {
      // Create with Google
      const googleResult = await repository.findOrCreateByOAuth(googleProfile);
      expect(isOk(googleResult)).toBe(true);

      // Try to create with GitHub (same email)
      const githubProfile: OAuthUserProfile = {
        ...googleProfile,
        provider: 'github',
        providerId: 'github-456',
      };

      const githubResult = await repository.findOrCreateByOAuth(githubProfile);
      expect(isOk(githubResult)).toBe(true);

      // Should be same user with multiple OAuth connections
      if (isOk(googleResult) && isOk(githubResult)) {
        expect(githubResult.value.id).toBe(googleResult.value.id);
        expect(githubResult.value.oauthConnections).toHaveLength(2);
      }
    });

    it('should update last_used_at when existing OAuth connection is used', async () => {
      const createResult = await repository.findOrCreateByOAuth(googleProfile);
      expect(isOk(createResult)).toBe(true);
      if (!isOk(createResult)) return;

      const firstLastUsed = createResult.value.oauthConnections[0]?.lastUsedAt;
      expect(firstLastUsed).toBeDefined();
      if (!firstLastUsed) return;

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      const findResult = await repository.findOrCreateByOAuth(googleProfile);
      expect(isOk(findResult)).toBe(true);
      if (!isOk(findResult)) return;

      const secondLastUsed = findResult.value.oauthConnections[0]?.lastUsedAt;
      expect(secondLastUsed).toBeDefined();
      if (!secondLastUsed) return;

      expect(secondLastUsed.getTime()).toBeGreaterThan(firstLastUsed.getTime());
    });
  });

  describe('findById', () => {
    it('should find user by ID', async () => {
      // Create user first
      const createResult = await repository.findOrCreateByOAuth({
        provider: 'google',
        providerId: 'google-123',
        email: 'test@example.com',
        emailVerified: true,
        name: 'Test User',
        rawProfile: {},
      });
      expect(isOk(createResult)).toBe(true);
      if (!isOk(createResult)) return;

      const userId = createResult.value.id;

      // Find by ID
      const findResult = await repository.findById(userId);
      expect(isOk(findResult)).toBe(true);
      if (isOk(findResult)) {
        expect(findResult.value.id).toBe(userId);
        expect(findResult.value.email).toBe('test@example.com');
      }
    });

    it('should return NOT_FOUND error for non-existent user', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const result = await repository.findById(nonExistentId);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('NOT_FOUND');
      }
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      // Create user first
      await repository.findOrCreateByOAuth({
        provider: 'google',
        providerId: 'google-123',
        email: 'test@example.com',
        emailVerified: true,
        name: 'Test User',
        rawProfile: {},
      });

      // Find by email
      const result = await repository.findByEmail('test@example.com');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).not.toBeNull();
        expect(result.value?.email).toBe('test@example.com');
      }
    });

    it('should return null for non-existent email', async () => {
      const result = await repository.findByEmail('nonexistent@example.com');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBeNull();
      }
    });
  });

  describe('update', () => {
    it('should update user information', async () => {
      // Create user
      const createResult = await repository.findOrCreateByOAuth({
        provider: 'google',
        providerId: 'google-123',
        email: 'test@example.com',
        emailVerified: true,
        name: 'Test User',
        rawProfile: {},
      });
      expect(isOk(createResult)).toBe(true);
      if (!isOk(createResult)) return;

      const user = createResult.value;

      // Update user
      const updatedUser: User = {
        ...user,
        name: 'Updated Name',
        picture: 'https://example.com/new-avatar.jpg',
      };

      const updateResult = await repository.update(updatedUser);
      expect(isOk(updateResult)).toBe(true);
      if (isOk(updateResult)) {
        expect(updateResult.value.name).toBe('Updated Name');
        expect(updateResult.value.picture).toBe('https://example.com/new-avatar.jpg');
        expect(updateResult.value.updatedAt.getTime()).toBeGreaterThan(
          user.updatedAt.getTime()
        );
      }
    });

    it('should handle optimistic locking conflict', async () => {
      // Create user
      const createResult = await repository.findOrCreateByOAuth({
        provider: 'google',
        providerId: 'google-123',
        email: 'test@example.com',
        emailVerified: true,
        name: 'Test User',
        rawProfile: {},
      });
      expect(isOk(createResult)).toBe(true);
      if (!isOk(createResult)) return;

      const user1 = createResult.value;

      // First update
      const update1 = await repository.update({ ...user1, name: 'Update 1' });
      expect(isOk(update1)).toBe(true);

      // Second update with stale data should fail
      const update2 = await repository.update({ ...user1, name: 'Update 2' });
      expect(isErr(update2)).toBe(true);
      if (isErr(update2)) {
        expect(update2.error.type).toBe('OPTIMISTIC_LOCK_ERROR');
      }
    });
  });

  describe('update2FASettings', () => {
    it('should update 2FA settings', async () => {
      // Create user
      const createResult = await repository.findOrCreateByOAuth({
        provider: 'google',
        providerId: 'google-123',
        email: 'test@example.com',
        emailVerified: true,
        name: 'Test User',
        rawProfile: {},
      });
      expect(isOk(createResult)).toBe(true);
      if (!isOk(createResult)) return;

      const userId = createResult.value.id;

      // Update 2FA settings
      const settings: TwoFactorSettings = {
        enabled: true,
        secret: 'encrypted-secret-value',
        recoveryCodes: ['hashed-code-1', 'hashed-code-2'],
        enrolledAt: new Date(),
      };

      const updateResult = await repository.update2FASettings(userId, settings);
      expect(isOk(updateResult)).toBe(true);

      // Verify settings were saved
      const userResult = await repository.findById(userId);
      expect(isOk(userResult)).toBe(true);
      if (isOk(userResult)) {
        expect(userResult.value.twoFactorEnabled).toBe(true);
        expect(userResult.value.twoFactorSecret).toBe('encrypted-secret-value');
        expect(userResult.value.recoveryCodes).toEqual(['hashed-code-1', 'hashed-code-2']);
      }
    });

    it('should disable 2FA when enabled is false', async () => {
      // Create user with 2FA enabled
      const createResult = await repository.findOrCreateByOAuth({
        provider: 'google',
        providerId: 'google-123',
        email: 'test@example.com',
        emailVerified: true,
        name: 'Test User',
        rawProfile: {},
      });
      expect(isOk(createResult)).toBe(true);
      if (!isOk(createResult)) return;

      const userId = createResult.value.id;

      // Enable 2FA
      await repository.update2FASettings(userId, {
        enabled: true,
        secret: 'encrypted-secret',
        recoveryCodes: ['code-1'],
        enrolledAt: new Date(),
      });

      // Disable 2FA
      const disableResult = await repository.update2FASettings(userId, {
        enabled: false,
      });
      expect(isOk(disableResult)).toBe(true);

      // Verify 2FA is disabled
      const userResult = await repository.findById(userId);
      expect(isOk(userResult)).toBe(true);
      if (isOk(userResult)) {
        expect(userResult.value.twoFactorEnabled).toBe(false);
      }
    });
  });

  describe('addOAuthConnection', () => {
    it('should add OAuth connection to existing user', async () => {
      // Create user with Google
      const createResult = await repository.findOrCreateByOAuth({
        provider: 'google',
        providerId: 'google-123',
        email: 'test@example.com',
        emailVerified: true,
        name: 'Test User',
        rawProfile: {},
      });
      expect(isOk(createResult)).toBe(true);
      if (!isOk(createResult)) return;

      const userId = createResult.value.id;

      // Add GitHub connection
      const githubConnection: OAuthConnection = {
        provider: 'github',
        providerId: 'github-456',
        connectedAt: new Date(),
        lastUsedAt: new Date(),
      };

      const addResult = await repository.addOAuthConnection(userId, githubConnection);
      expect(isOk(addResult)).toBe(true);

      // Verify connection was added
      const userResult = await repository.findById(userId);
      expect(isOk(userResult)).toBe(true);
      if (isOk(userResult)) {
        expect(userResult.value.oauthConnections).toHaveLength(2);
        expect(
          userResult.value.oauthConnections.find((c) => c.provider === 'github')
        ).toBeDefined();
      }
    });

    it('should prevent duplicate OAuth connections', async () => {
      // Create user
      const createResult = await repository.findOrCreateByOAuth({
        provider: 'google',
        providerId: 'google-123',
        email: 'test@example.com',
        emailVerified: true,
        name: 'Test User',
        rawProfile: {},
      });
      expect(isOk(createResult)).toBe(true);
      if (!isOk(createResult)) return;

      const userId = createResult.value.id;

      // Try to add duplicate connection
      const duplicateConnection: OAuthConnection = {
        provider: 'google',
        providerId: 'google-123',
        connectedAt: new Date(),
        lastUsedAt: new Date(),
      };

      const addResult = await repository.addOAuthConnection(userId, duplicateConnection);
      expect(isErr(addResult)).toBe(true);
      if (isErr(addResult)) {
        expect(addResult.error.type).toBe('DUPLICATE_OAUTH_CONNECTION');
      }
    });
  });
});
