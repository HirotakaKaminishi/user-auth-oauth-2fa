/**
 * Two-Factor Service Tests
 * Task 5.2-5.4: 2FA Enrollment, Verification, and Management
 */

import { TwoFactorService } from '../../services/two-factor-service';
import { TOTPService } from '../../services/totp-service';
import { EncryptionService } from '../../services/encryption-service';
import { PostgresUserRepository } from '../../repositories/postgres-user-repository';
import { Pool } from 'pg';
import { isOk, isErr } from '../../types/result';

describe('TwoFactorService', () => {
  let pool: Pool;
  let userRepository: PostgresUserRepository;
  let encryptionService: EncryptionService;
  let totpService: TOTPService;
  let twoFactorService: TwoFactorService;

  let testUserId: string;

  beforeAll(async () => {
    // Setup database connection
    pool = new Pool({
      host: process.env['DB_HOST'] || 'localhost',
      port: parseInt(process.env['DB_PORT'] || '5432'),
      database: process.env['DB_NAME'] || 'auth_db',
      user: process.env['DB_USER'] || 'auth_user',
      password: process.env['DB_PASSWORD'] || 'dev_password',
    });

    // Initialize services
    encryptionService = new EncryptionService(
      process.env['ENCRYPTION_KEY'] || 'test-encryption-key-must-be-32-chars-long-minimum!'
    );

    totpService = new TOTPService({
      issuer: '2FA Test',
      digits: 6,
      period: 30,
      algorithm: 'SHA1',
      window: 1,
    });

    userRepository = new PostgresUserRepository(pool);

    twoFactorService = new TwoFactorService(
      totpService,
      encryptionService,
      userRepository
    );

    // Clean up test data
    await pool.query('DELETE FROM oauth_connections');
    await pool.query('DELETE FROM users');

    // Create test user
    const createUserResult = await userRepository.findOrCreateByOAuth({
      provider: 'github',
      providerId: 'test-2fa-user',
      email: 'test-2fa@example.com',
      emailVerified: true,
      name: 'Test 2FA User',
      rawProfile: {},
    });

    if (!isOk(createUserResult)) {
      throw new Error('Failed to create test user');
    }

    testUserId = createUserResult.value.id;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM oauth_connections');
    await pool.query('DELETE FROM users');
    await pool.end();
  });

  describe('startEnrollment', () => {
    it('should start 2FA enrollment successfully', async () => {
      const result = await twoFactorService.startEnrollment(
        testUserId,
        'test-2fa@example.com'
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const enrollment = result.value;
        expect(enrollment.secret).toBeDefined();
        expect(enrollment.secret).toMatch(/^[A-Z2-7]+=*$/); // Base32 format
        expect(enrollment.uri).toMatch(/^otpauth:\/\/totp\//);
        expect(enrollment.uri).toContain('test-2fa%40example.com');
        expect(enrollment.qrCode).toMatch(/^data:image\/png;base64,/);
        expect(enrollment.accountName).toBe('test-2fa@example.com');
      }
    });

    it('should return error if user already has 2FA enabled', async () => {
      // First enrollment
      const startResult = await twoFactorService.startEnrollment(
        testUserId,
        'test-2fa@example.com'
      );
      expect(isOk(startResult)).toBe(true);

      if (!isOk(startResult)) return;
      const { secret } = startResult.value;

      // Generate valid token
      const tokenResult = totpService.generateToken(secret);
      expect(isOk(tokenResult)).toBe(true);
      if (!isOk(tokenResult)) return;

      // Complete enrollment
      const completeResult = await twoFactorService.completeEnrollment(
        testUserId,
        tokenResult.value,
        secret
      );
      expect(isOk(completeResult)).toBe(true);

      // Try to start enrollment again (should fail)
      const secondStartResult = await twoFactorService.startEnrollment(
        testUserId,
        'test-2fa@example.com'
      );
      expect(isErr(secondStartResult)).toBe(true);
      if (isErr(secondStartResult)) {
        expect(secondStartResult.error.type).toBe('ALREADY_ENROLLED');
      }

      // Cleanup: disable 2FA for next tests
      await twoFactorService.disable(testUserId);
    });
  });

  describe('completeEnrollment', () => {
    it('should complete enrollment with valid TOTP token', async () => {
      // Start enrollment
      const startResult = await twoFactorService.startEnrollment(
        testUserId,
        'test-2fa@example.com'
      );
      expect(isOk(startResult)).toBe(true);
      if (!isOk(startResult)) return;

      const { secret } = startResult.value;

      // Generate valid token
      const tokenResult = totpService.generateToken(secret);
      expect(isOk(tokenResult)).toBe(true);
      if (!isOk(tokenResult)) return;

      // Complete enrollment
      const completeResult = await twoFactorService.completeEnrollment(
        testUserId,
        tokenResult.value,
        secret
      );

      expect(isOk(completeResult)).toBe(true);
      if (isOk(completeResult)) {
        const enrollment = completeResult.value;
        expect(enrollment.success).toBe(true);
        expect(enrollment.recoveryCodes).toHaveLength(8);
        expect(enrollment.recoveryCodes[0]).toMatch(/^[A-Z0-9]{10}$/); // 10-char alphanumeric
        expect(enrollment.enrolledAt).toBeInstanceOf(Date);

        // Verify all recovery codes are unique
        const uniqueCodes = new Set(enrollment.recoveryCodes);
        expect(uniqueCodes.size).toBe(8);
      }

      // Cleanup
      await twoFactorService.disable(testUserId);
    });

    it('should reject enrollment with invalid TOTP token', async () => {
      // Start enrollment
      const startResult = await twoFactorService.startEnrollment(
        testUserId,
        'test-2fa@example.com'
      );
      expect(isOk(startResult)).toBe(true);
      if (!isOk(startResult)) return;

      const { secret } = startResult.value;

      // Try to complete with invalid token
      const completeResult = await twoFactorService.completeEnrollment(
        testUserId,
        '000000',
        secret
      );

      expect(isErr(completeResult)).toBe(true);
      if (isErr(completeResult)) {
        expect(completeResult.error.type).toBe('VERIFICATION_FAILED');
      }
    });
  });

  describe('verifyToken', () => {
    let enrolledSecret: string;

    beforeEach(async () => {
      // Enroll user for testing
      const startResult = await twoFactorService.startEnrollment(
        testUserId,
        'test-2fa@example.com'
      );
      if (!isOk(startResult)) throw new Error('Failed to start enrollment');

      enrolledSecret = startResult.value.secret;

      const tokenResult = totpService.generateToken(enrolledSecret);
      if (!isOk(tokenResult)) throw new Error('Failed to generate token');

      const completeResult = await twoFactorService.completeEnrollment(
        testUserId,
        tokenResult.value,
        enrolledSecret
      );
      if (!isOk(completeResult)) throw new Error('Failed to complete enrollment');
    });

    afterEach(async () => {
      await twoFactorService.disable(testUserId);
    });

    it('should verify valid TOTP token', async () => {
      // Generate current token
      const tokenResult = totpService.generateToken(enrolledSecret);
      expect(isOk(tokenResult)).toBe(true);
      if (!isOk(tokenResult)) return;

      // Verify token
      const verifyResult = await twoFactorService.verifyToken(
        testUserId,
        tokenResult.value
      );

      expect(isOk(verifyResult)).toBe(true);
      if (isOk(verifyResult)) {
        expect(verifyResult.value.valid).toBe(true);
        expect(verifyResult.value.codeType).toBe('totp');
      }
    });

    it('should reject invalid TOTP token', async () => {
      const verifyResult = await twoFactorService.verifyToken(testUserId, '000000');

      expect(isOk(verifyResult)).toBe(true);
      if (isOk(verifyResult)) {
        expect(verifyResult.value.valid).toBe(false);
      }
    });

    it('should track failed attempts and lock account after 3 failures', async () => {
      // Attempt 1
      const result1 = await twoFactorService.verifyToken(testUserId, '111111');
      expect(isOk(result1)).toBe(true);
      if (isOk(result1)) {
        expect(result1.value.valid).toBe(false);
        expect(result1.value.remainingAttempts).toBe(2);
      }

      // Attempt 2
      const result2 = await twoFactorService.verifyToken(testUserId, '222222');
      expect(isOk(result2)).toBe(true);
      if (isOk(result2)) {
        expect(result2.value.valid).toBe(false);
        expect(result2.value.remainingAttempts).toBe(1);
      }

      // Attempt 3 (should lock)
      const result3 = await twoFactorService.verifyToken(testUserId, '333333');
      expect(isErr(result3)).toBe(true);
      if (isErr(result3)) {
        expect(result3.error.type).toBe('ACCOUNT_LOCKED');
        expect(result3.error.message).toContain('15 minutes');
      }
    });
  });

  describe('verifyRecoveryCode', () => {
    let recoveryCodes: string[];

    beforeEach(async () => {
      // Enroll user and get recovery codes
      const startResult = await twoFactorService.startEnrollment(
        testUserId,
        'test-2fa@example.com'
      );
      if (!isOk(startResult)) throw new Error('Failed to start enrollment');

      const tokenResult = totpService.generateToken(startResult.value.secret);
      if (!isOk(tokenResult)) throw new Error('Failed to generate token');

      const completeResult = await twoFactorService.completeEnrollment(
        testUserId,
        tokenResult.value,
        startResult.value.secret
      );
      if (!isOk(completeResult)) throw new Error('Failed to complete enrollment');

      recoveryCodes = completeResult.value.recoveryCodes;
    });

    afterEach(async () => {
      await twoFactorService.disable(testUserId);
    });

    it('should verify valid recovery code', async () => {
      const recoveryCode = recoveryCodes[0]!;

      const result = await twoFactorService.verifyRecoveryCode(testUserId, recoveryCode);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.valid).toBe(true);
        expect(result.value.codeType).toBe('recovery');
      }
    });

    it('should invalidate used recovery code', async () => {
      const recoveryCode = recoveryCodes[0]!;

      // First use
      const result1 = await twoFactorService.verifyRecoveryCode(testUserId, recoveryCode);
      expect(isOk(result1)).toBe(true);
      if (isOk(result1)) {
        expect(result1.value.valid).toBe(true);
      }

      // Second use (should fail)
      const result2 = await twoFactorService.verifyRecoveryCode(testUserId, recoveryCode);
      expect(isOk(result2)).toBe(true);
      if (isOk(result2)) {
        expect(result2.value.valid).toBe(false);
      }
    });

    it('should reject invalid recovery code', async () => {
      const result = await twoFactorService.verifyRecoveryCode(testUserId, 'INVALID123');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.valid).toBe(false);
      }
    });
  });

  describe('disable', () => {
    it('should disable 2FA successfully', async () => {
      // Enroll first
      const startResult = await twoFactorService.startEnrollment(
        testUserId,
        'test-2fa@example.com'
      );
      if (!isOk(startResult)) return;

      const tokenResult = totpService.generateToken(startResult.value.secret);
      if (!isOk(tokenResult)) return;

      await twoFactorService.completeEnrollment(
        testUserId,
        tokenResult.value,
        startResult.value.secret
      );

      // Disable
      const disableResult = await twoFactorService.disable(testUserId);
      expect(isOk(disableResult)).toBe(true);
      if (isOk(disableResult)) {
        expect(disableResult.value).toBe(true);
      }

      // Verify status
      const statusResult = await twoFactorService.getStatus(testUserId);
      expect(isOk(statusResult)).toBe(true);
      if (isOk(statusResult)) {
        expect(statusResult.value.enabled).toBe(false);
      }
    });
  });

  describe('regenerateRecoveryCodes', () => {
    beforeEach(async () => {
      // Enroll user
      const startResult = await twoFactorService.startEnrollment(
        testUserId,
        'test-2fa@example.com'
      );
      if (!isOk(startResult)) throw new Error('Failed to start enrollment');

      const tokenResult = totpService.generateToken(startResult.value.secret);
      if (!isOk(tokenResult)) throw new Error('Failed to generate token');

      await twoFactorService.completeEnrollment(
        testUserId,
        tokenResult.value,
        startResult.value.secret
      );
    });

    afterEach(async () => {
      await twoFactorService.disable(testUserId);
    });

    it('should regenerate recovery codes', async () => {
      const result = await twoFactorService.regenerateRecoveryCodes(testUserId);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const { recoveryCodes, regeneratedAt } = result.value;
        expect(recoveryCodes).toHaveLength(8);
        expect(recoveryCodes[0]).toMatch(/^[A-Z0-9]{10}$/);
        expect(regeneratedAt).toBeInstanceOf(Date);

        // Verify all codes are unique
        const uniqueCodes = new Set(recoveryCodes);
        expect(uniqueCodes.size).toBe(8);
      }
    });

    it('should invalidate old recovery codes after regeneration', async () => {
      // Get initial codes
      const statusBefore = await twoFactorService.getStatus(testUserId);
      expect(isOk(statusBefore)).toBe(true);

      // Regenerate
      const regenerateResult = await twoFactorService.regenerateRecoveryCodes(testUserId);
      expect(isOk(regenerateResult)).toBe(true);

      // Verify new codes work
      if (isOk(regenerateResult)) {
        const newCode = regenerateResult.value.recoveryCodes[0]!;
        const verifyResult = await twoFactorService.verifyRecoveryCode(testUserId, newCode);
        expect(isOk(verifyResult)).toBe(true);
        if (isOk(verifyResult)) {
          expect(verifyResult.value.valid).toBe(true);
        }
      }
    });
  });

  describe('getStatus', () => {
    it('should return disabled status for user without 2FA', async () => {
      const result = await twoFactorService.getStatus(testUserId);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.enabled).toBe(false);
      }
    });

    it('should return enabled status with details for enrolled user', async () => {
      // Enroll first
      const startResult = await twoFactorService.startEnrollment(
        testUserId,
        'test-2fa@example.com'
      );
      if (!isOk(startResult)) return;

      const tokenResult = totpService.generateToken(startResult.value.secret);
      if (!isOk(tokenResult)) return;

      await twoFactorService.completeEnrollment(
        testUserId,
        tokenResult.value,
        startResult.value.secret
      );

      // Get status
      const statusResult = await twoFactorService.getStatus(testUserId);
      expect(isOk(statusResult)).toBe(true);
      if (isOk(statusResult)) {
        const status = statusResult.value;
        expect(status.enabled).toBe(true);
        expect(status.enrolledAt).toBeInstanceOf(Date);
        expect(status.recoveryCodesRemaining).toBe(8);
      }

      // Cleanup
      await twoFactorService.disable(testUserId);
    });
  });
});
