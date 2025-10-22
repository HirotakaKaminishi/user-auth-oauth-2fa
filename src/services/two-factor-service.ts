/**
 * Two-Factor Authentication Service
 * Task 5.2-5.4: 2FA Enrollment, Verification, and Management
 *
 * 主な機能:
 * - 2FA enrollment (QRコード生成、リカバリーコード発行)
 * - TOTP検証 (失敗試行トラッキング、アカウントロック)
 * - リカバリーコード検証 (使用済み管理)
 * - 2FA管理 (無効化、リカバリーコード再生成)
 */

import { ITOTPService } from '../types/totp';
import { EncryptionService } from './encryption-service';
import { PostgresUserRepository } from '../repositories/postgres-user-repository';
import { Result, Ok, Err } from '../types/result';
import {
  ITwoFactorService,
  EnrollmentStartResponse,
  EnrollmentCompleteResponse,
  TwoFactorVerificationResponse,
  RecoveryCodesRegenerateResponse,
  TwoFactorStatus,
  TwoFactorError,
} from '../types/two-factor';

/**
 * 失敗試行の最大回数（これを超えるとアカウントロック）
 */
const MAX_FAILED_ATTEMPTS = 3;

/**
 * アカウントロック時間（ミリ秒）
 */
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export class TwoFactorService implements ITwoFactorService {
  constructor(
    private readonly totpService: ITOTPService,
    private readonly encryptionService: EncryptionService,
    private readonly userRepository: PostgresUserRepository
  ) {}

  /**
   * 2FA Enrollment開始
   */
  async startEnrollment(
    userId: string,
    accountName: string
  ): Promise<Result<EnrollmentStartResponse, TwoFactorError>> {
    try {
      // Check if user already has 2FA enabled
      const userResult = await this.userRepository.findById(userId);
      if (!userResult.success) {
        return Err({
          type: 'REPOSITORY_ERROR',
          message: 'User not found',
          timestamp: new Date(),
        });
      }

      if (userResult.value.twoFactorEnabled) {
        return Err({
          type: 'ALREADY_ENROLLED',
          message: '2FA is already enabled for this user',
          timestamp: new Date(),
        });
      }

      // Generate TOTP secret with QR code
      const secretResult = await this.totpService.generateSecret(accountName, true);
      if (!secretResult.success) {
        return Err({
          type: 'TOTP_SERVICE_ERROR',
          message: secretResult.error.message,
          timestamp: new Date(),
        });
      }

      const { secret, uri, qrCode } = secretResult.value;

      if (!qrCode) {
        return Err({
          type: 'TOTP_SERVICE_ERROR',
          message: 'QR code generation failed',
          timestamp: new Date(),
        });
      }

      return Ok({
        secret,
        uri,
        qrCode,
        accountName,
      });
    } catch (error) {
      return Err({
        type: 'ENROLLMENT_FAILED',
        message: `Enrollment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      });
    }
  }

  /**
   * 2FA Enrollment完了検証
   */
  async completeEnrollment(
    userId: string,
    token: string,
    secret: string
  ): Promise<Result<EnrollmentCompleteResponse, TwoFactorError>> {
    try {
      // Verify TOTP token
      const verifyResult = this.totpService.verifyToken(token, secret);
      if (!verifyResult.success) {
        return Err({
          type: 'TOTP_SERVICE_ERROR',
          message: verifyResult.error.message,
          timestamp: new Date(),
        });
      }

      if (!verifyResult.value.valid) {
        return Err({
          type: 'VERIFICATION_FAILED',
          message: 'Invalid TOTP token. Please try again.',
          timestamp: new Date(),
        });
      }

      // Generate recovery codes (8 codes, 10 chars each)
      const recoveryCodesResult = this.encryptionService.generateRecoveryCodes();
      if (!recoveryCodesResult.success) {
        return Err({
          type: 'ENCRYPTION_ERROR',
          message: 'Failed to generate recovery codes',
          timestamp: new Date(),
        });
      }

      const recoveryCodes = recoveryCodesResult.value;

      // Hash recovery codes for storage
      const hashedCodesPromises = recoveryCodes.map((code) =>
        this.encryptionService.hashRecoveryCode(code)
      );
      const hashedCodesResults = await Promise.all(hashedCodesPromises);

      // Check if any hashing failed
      const hashedCodes: string[] = [];
      for (const result of hashedCodesResults) {
        if (!result.success) {
          return Err({
            type: 'ENCRYPTION_ERROR',
            message: 'Failed to hash recovery codes',
            timestamp: new Date(),
          });
        }
        hashedCodes.push(result.value);
      }

      // Encrypt TOTP secret
      const encryptedSecretResult = this.encryptionService.encryptTOTPSecret(secret);
      if (!encryptedSecretResult.success) {
        return Err({
          type: 'ENCRYPTION_ERROR',
          message: 'Failed to encrypt TOTP secret',
          timestamp: new Date(),
        });
      }

      // Save to database
      const enrolledAt = new Date();
      const updateResult = await this.userRepository.update2FASettings(userId, {
        enabled: true,
        secret: encryptedSecretResult.value,
        recoveryCodes: hashedCodes,
        enrolledAt,
      });

      if (!updateResult.success) {
        return Err({
          type: 'REPOSITORY_ERROR',
          message: 'Failed to save 2FA settings',
          timestamp: new Date(),
        });
      }

      return Ok({
        success: true,
        recoveryCodes, // Return plaintext codes (only shown once)
        enrolledAt,
      });
    } catch (error) {
      return Err({
        type: 'ENROLLMENT_FAILED',
        message: `Enrollment completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      });
    }
  }

  /**
   * 2FAトークン検証（ログイン時）
   */
  async verifyToken(
    userId: string,
    token: string
  ): Promise<Result<TwoFactorVerificationResponse, TwoFactorError>> {
    try {
      // Get user
      const userResult = await this.userRepository.findById(userId);
      if (!userResult.success) {
        return Err({
          type: 'REPOSITORY_ERROR',
          message: 'User not found',
          timestamp: new Date(),
        });
      }

      const user = userResult.value;

      // Check if 2FA is enabled
      if (!user.twoFactorEnabled || !user.twoFactorSecret) {
        return Err({
          type: 'NOT_ENROLLED',
          message: '2FA is not enabled for this user',
          timestamp: new Date(),
        });
      }

      // Check account lock
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        return Err({
          type: 'ACCOUNT_LOCKED',
          message: `Account is locked due to too many failed attempts. Please try again after 15 minutes.`,
          timestamp: new Date(),
        });
      }

      // Decrypt TOTP secret
      const decryptedSecretResult = this.encryptionService.decryptTOTPSecret(
        user.twoFactorSecret
      );
      if (!decryptedSecretResult.success) {
        return Err({
          type: 'ENCRYPTION_ERROR',
          message: 'Failed to decrypt TOTP secret',
          timestamp: new Date(),
        });
      }

      // Verify TOTP token
      const verifyResult = this.totpService.verifyToken(token, decryptedSecretResult.value);
      if (!verifyResult.success) {
        return Err({
          type: 'TOTP_SERVICE_ERROR',
          message: verifyResult.error.message,
          timestamp: new Date(),
        });
      }

      if (!verifyResult.value.valid) {
        // Increment failed attempts
        const newFailedAttempts = user.failedLoginAttempts + 1;

        if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
          // Lock account
          const lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
          await this.userRepository.update({
            ...user,
            failedLoginAttempts: newFailedAttempts,
            lockedUntil,
          });

          return Err({
            type: 'ACCOUNT_LOCKED',
            message: `Too many failed attempts. Account locked for 15 minutes.`,
            timestamp: new Date(),
          });
        }

        // Update failed attempts
        await this.userRepository.update({
          ...user,
          failedLoginAttempts: newFailedAttempts,
        });

        return Ok({
          valid: false,
          codeType: 'totp',
          remainingAttempts: MAX_FAILED_ATTEMPTS - newFailedAttempts,
        });
      }

      // Success: reset failed attempts
      if (user.failedLoginAttempts > 0 || user.lockedUntil) {
        await this.userRepository.update({
          ...user,
          failedLoginAttempts: 0,
          lockedUntil: undefined,
        });
      }

      return Ok({
        valid: true,
        codeType: 'totp',
      });
    } catch (error) {
      return Err({
        type: 'VERIFICATION_FAILED',
        message: `Token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      });
    }
  }

  /**
   * リカバリーコード検証
   */
  async verifyRecoveryCode(
    userId: string,
    recoveryCode: string
  ): Promise<Result<TwoFactorVerificationResponse, TwoFactorError>> {
    try {
      // Get user
      const userResult = await this.userRepository.findById(userId);
      if (!userResult.success) {
        return Err({
          type: 'REPOSITORY_ERROR',
          message: 'User not found',
          timestamp: new Date(),
        });
      }

      const user = userResult.value;

      // Check if 2FA is enabled
      if (!user.twoFactorEnabled || !user.recoveryCodes) {
        return Err({
          type: 'NOT_ENROLLED',
          message: '2FA is not enabled for this user',
          timestamp: new Date(),
        });
      }

      // Verify recovery code against all hashed codes
      const verifyPromises = user.recoveryCodes.map((hashedCode) =>
        this.encryptionService.verifyRecoveryCode(recoveryCode, hashedCode)
      );
      const verifyResults = await Promise.all(verifyPromises);

      // Find matching code
      let matchedIndex = -1;
      for (let i = 0; i < verifyResults.length; i++) {
        const result = verifyResults[i];
        if (result && result.success && result.value) {
          matchedIndex = i;
          break;
        }
      }

      if (matchedIndex === -1) {
        return Ok({
          valid: false,
          codeType: 'recovery',
        });
      }

      // Remove used recovery code
      const remainingCodes = user.recoveryCodes.filter((_, index) => index !== matchedIndex);

      await this.userRepository.update2FASettings(userId, {
        enabled: user.twoFactorEnabled,
        secret: user.twoFactorSecret,
        recoveryCodes: remainingCodes,
        enrolledAt: user.createdAt, // Keep original enrollment date
      });

      return Ok({
        valid: true,
        codeType: 'recovery',
      });
    } catch (error) {
      return Err({
        type: 'VERIFICATION_FAILED',
        message: `Recovery code verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      });
    }
  }

  /**
   * 2FA無効化
   */
  async disable(userId: string): Promise<Result<boolean, TwoFactorError>> {
    try {
      const updateResult = await this.userRepository.update2FASettings(userId, {
        enabled: false,
      });

      if (!updateResult.success) {
        return Err({
          type: 'REPOSITORY_ERROR',
          message: 'Failed to disable 2FA',
          timestamp: new Date(),
        });
      }

      return Ok(true);
    } catch (error) {
      return Err({
        type: 'ENROLLMENT_FAILED',
        message: `Failed to disable 2FA: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      });
    }
  }

  /**
   * リカバリーコード再生成
   */
  async regenerateRecoveryCodes(
    userId: string
  ): Promise<Result<RecoveryCodesRegenerateResponse, TwoFactorError>> {
    try {
      // Get user
      const userResult = await this.userRepository.findById(userId);
      if (!userResult.success) {
        return Err({
          type: 'REPOSITORY_ERROR',
          message: 'User not found',
          timestamp: new Date(),
        });
      }

      const user = userResult.value;

      if (!user.twoFactorEnabled) {
        return Err({
          type: 'NOT_ENROLLED',
          message: '2FA is not enabled for this user',
          timestamp: new Date(),
        });
      }

      // Generate new recovery codes (8 codes, 10 chars each)
      const recoveryCodesResult = this.encryptionService.generateRecoveryCodes();
      if (!recoveryCodesResult.success) {
        return Err({
          type: 'ENCRYPTION_ERROR',
          message: 'Failed to generate recovery codes',
          timestamp: new Date(),
        });
      }

      const recoveryCodes = recoveryCodesResult.value;

      // Hash recovery codes
      const hashedCodesPromises = recoveryCodes.map((code) =>
        this.encryptionService.hashRecoveryCode(code)
      );
      const hashedCodesResults = await Promise.all(hashedCodesPromises);

      const hashedCodes: string[] = [];
      for (const result of hashedCodesResults) {
        if (!result.success) {
          return Err({
            type: 'ENCRYPTION_ERROR',
            message: 'Failed to hash recovery codes',
            timestamp: new Date(),
          });
        }
        hashedCodes.push(result.value);
      }

      // Update database
      const regeneratedAt = new Date();
      const updateResult = await this.userRepository.update2FASettings(userId, {
        enabled: true,
        secret: user.twoFactorSecret,
        recoveryCodes: hashedCodes,
        enrolledAt: user.createdAt,
      });

      if (!updateResult.success) {
        return Err({
          type: 'REPOSITORY_ERROR',
          message: 'Failed to save new recovery codes',
          timestamp: new Date(),
        });
      }

      return Ok({
        recoveryCodes,
        regeneratedAt,
      });
    } catch (error) {
      return Err({
        type: 'ENROLLMENT_FAILED',
        message: `Failed to regenerate recovery codes: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      });
    }
  }

  /**
   * 2FAステータス取得
   */
  async getStatus(userId: string): Promise<Result<TwoFactorStatus, TwoFactorError>> {
    try {
      const userResult = await this.userRepository.findById(userId);
      if (!userResult.success) {
        return Err({
          type: 'REPOSITORY_ERROR',
          message: 'User not found',
          timestamp: new Date(),
        });
      }

      const user = userResult.value;

      if (!user.twoFactorEnabled) {
        return Ok({
          enabled: false,
        });
      }

      return Ok({
        enabled: true,
        enrolledAt: user.createdAt,
        recoveryCodesRemaining: user.recoveryCodes?.length || 0,
        lastVerifiedAt: user.updatedAt,
      });
    } catch (error) {
      return Err({
        type: 'REPOSITORY_ERROR',
        message: `Failed to get 2FA status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      });
    }
  }
}
