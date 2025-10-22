import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Result, Ok, Err } from '../types/result';

/**
 * Encryption Service Error Types
 */
export type EncryptionError =
  | { type: 'ENCRYPTION_FAILED'; message: string }
  | { type: 'DECRYPTION_FAILED'; message: string }
  | { type: 'HASHING_FAILED'; message: string }
  | { type: 'VERIFICATION_FAILED'; message: string }
  | { type: 'RANDOM_GENERATION_FAILED'; message: string };

/**
 * EncryptionService
 *
 * Provides cryptographic operations for the authentication system:
 * - AES-256-GCM encryption/decryption for TOTP secrets
 * - bcrypt hashing/verification for recovery codes (strength 14)
 * - Cryptographically secure random string generation
 * - PKCE code_verifier and code_challenge generation
 *
 * Security specifications:
 * - AES-256-GCM with random IV (12 bytes) and auth tag (16 bytes)
 * - bcrypt with cost factor 14 (2^14 iterations)
 * - All random values use crypto.randomBytes()
 */
export class EncryptionService {
  private readonly encryptionKey: Buffer;
  private readonly algorithm = 'aes-256-gcm' as const;
  private readonly ivLength = 12; // 96 bits for GCM
  private readonly bcryptRounds = 14; // 2^14 iterations

  constructor(encryptionKey: string) {
    // Derive 32-byte key from provided key string
    this.encryptionKey = crypto
      .createHash('sha256')
      .update(encryptionKey)
      .digest();
  }

  /**
   * Encrypt TOTP secret using AES-256-GCM
   * Format: iv:authTag:ciphertext (all hex-encoded)
   */
  encryptTOTPSecret(secret: string): Result<string, EncryptionError> {
    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);

      let encrypted = cipher.update(secret, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      // Format: iv:authTag:ciphertext
      const result = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;

      return Ok(result);
    } catch (error) {
      return Err({
        type: 'ENCRYPTION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown encryption error',
      });
    }
  }

  /**
   * Decrypt TOTP secret using AES-256-GCM
   */
  decryptTOTPSecret(encrypted: string): Result<string, EncryptionError> {
    try {
      const parts = encrypted.split(':');
      if (parts.length !== 3) {
        return Err({
          type: 'DECRYPTION_FAILED',
          message: 'Invalid encrypted format',
        });
      }

      const ivHex = parts[0];
      const authTagHex = parts[1];
      const ciphertext = parts[2];

      if (!ivHex || !authTagHex || !ciphertext) {
        return Err({
          type: 'DECRYPTION_FAILED',
          message: 'Invalid encrypted format - missing parts',
        });
      }

      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);

      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return Ok(decrypted);
    } catch (error) {
      return Err({
        type: 'DECRYPTION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown decryption error',
      });
    }
  }

  /**
   * Hash recovery code using bcrypt (strength 14)
   */
  async hashRecoveryCode(recoveryCode: string): Promise<Result<string, EncryptionError>> {
    try {
      const hash = await bcrypt.hash(recoveryCode, this.bcryptRounds);
      return Ok(hash);
    } catch (error) {
      return Err({
        type: 'HASHING_FAILED',
        message: error instanceof Error ? error.message : 'Unknown hashing error',
      });
    }
  }

  /**
   * Verify recovery code against bcrypt hash
   */
  async verifyRecoveryCode(
    recoveryCode: string,
    hash: string
  ): Promise<Result<boolean, EncryptionError>> {
    try {
      const isValid = await bcrypt.compare(recoveryCode, hash);
      return Ok(isValid);
    } catch (error) {
      return Err({
        type: 'VERIFICATION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown verification error',
      });
    }
  }

  /**
   * Generate cryptographically secure random hex string
   * @param byteLength - Number of random bytes (output will be byteLength * 2 hex chars)
   */
  generateRandomHex(byteLength: number): Result<string, EncryptionError> {
    try {
      const randomBytes = crypto.randomBytes(byteLength);
      return Ok(randomBytes.toString('hex'));
    } catch (error) {
      return Err({
        type: 'RANDOM_GENERATION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown random generation error',
      });
    }
  }

  /**
   * Generate cryptographically secure random base64 string
   * @param byteLength - Number of random bytes
   */
  generateRandomBase64(byteLength: number): Result<string, EncryptionError> {
    try {
      const randomBytes = crypto.randomBytes(byteLength);
      return Ok(randomBytes.toString('base64'));
    } catch (error) {
      return Err({
        type: 'RANDOM_GENERATION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown random generation error',
      });
    }
  }

  /**
   * Generate single recovery code (10 chars uppercase alphanumeric)
   */
  generateRecoveryCode(): Result<string, EncryptionError> {
    try {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      const codeLength = 10;
      let code = '';

      // Generate random indices to select characters
      const randomBytes = crypto.randomBytes(codeLength);

      for (let i = 0; i < codeLength; i++) {
        const byte = randomBytes[i];
        if (byte === undefined) {
          return Err({
            type: 'RANDOM_GENERATION_FAILED',
            message: 'Failed to generate random bytes',
          });
        }
        const randomIndex = byte % chars.length;
        code += chars[randomIndex];
      }

      return Ok(code);
    } catch (error) {
      return Err({
        type: 'RANDOM_GENERATION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown random generation error',
      });
    }
  }

  /**
   * Generate 8 unique recovery codes
   */
  generateRecoveryCodes(): Result<string[], EncryptionError> {
    try {
      const codes = new Set<string>();

      while (codes.size < 8) {
        const codeResult = this.generateRecoveryCode();
        if (!codeResult.success) {
          return codeResult;
        }
        codes.add(codeResult.value);
      }

      return Ok(Array.from(codes));
    } catch (error) {
      return Err({
        type: 'RANDOM_GENERATION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown random generation error',
      });
    }
  }

  /**
   * Generate PKCE code_verifier (RFC 7636)
   * - Length: 43-128 characters
   * - Characters: [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
   * - URL-safe base64 without padding
   */
  generateCodeVerifier(): Result<string, EncryptionError> {
    try {
      // Generate 64 random bytes -> 86 base64 chars (within 43-128 range)
      const randomBytes = crypto.randomBytes(64);
      const codeVerifier = randomBytes
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, ''); // Remove padding

      return Ok(codeVerifier);
    } catch (error) {
      return Err({
        type: 'RANDOM_GENERATION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown random generation error',
      });
    }
  }

  /**
   * Generate PKCE code_challenge from code_verifier (RFC 7636)
   * - Method: S256 (SHA-256)
   * - Format: BASE64URL(SHA256(ASCII(code_verifier)))
   */
  generateCodeChallenge(codeVerifier: string): Result<string, EncryptionError> {
    try {
      const hash = crypto.createHash('sha256').update(codeVerifier).digest();
      const codeChallenge = hash
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, ''); // Remove padding for URL-safe

      return Ok(codeChallenge);
    } catch (error) {
      return Err({
        type: 'RANDOM_GENERATION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown code challenge generation error',
      });
    }
  }
}
