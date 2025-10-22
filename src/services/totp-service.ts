/**
 * TOTP Service Implementation
 * Task 5.1: TOTP Core Functionality
 *
 * RFC 6238準拠のTime-based One-Time Password実装
 */

import * as OTPAuth from 'otpauth';
import * as QRCode from 'qrcode';
import { Result, Ok, Err } from '../types/result';
import {
  ITOTPService,
  TOTPConfig,
  TOTPSecret,
  TOTPError,
  TOTPVerificationResult,
} from '../types/totp';

/**
 * TOTP Service
 *
 * 主な機能:
 * - Base32 secretの生成
 * - 6桁TOTPコードの生成（30秒ウィンドウ）
 * - TOTPコードの検証（±1ウィンドウ許容）
 * - otpauth:// URI生成
 * - QRコード生成
 */
export class TOTPService implements ITOTPService {
  private readonly config: TOTPConfig;

  constructor(config: TOTPConfig) {
    this.config = config;
  }

  /**
   * 新しいTOTP secretを生成
   */
  async generateSecret(
    accountName: string,
    generateQR: boolean = false
  ): Promise<Result<TOTPSecret, TOTPError>> {
    try {
      // Generate random secret (160 bits = 20 bytes)
      const secret = new OTPAuth.Secret({ size: 20 });

      // Generate otpauth URI
      const uriResult = this.generateUri(accountName, secret.base32);
      if (!uriResult.success) {
        return uriResult;
      }

      const uri = uriResult.value;

      // Generate QR code if requested
      let qrCode: string | undefined;
      if (generateQR) {
        const qrResult = await this.generateQRCode(uri);
        if (!qrResult.success) {
          return qrResult;
        }
        qrCode = qrResult.value;
      }

      return Ok({
        secret: secret.base32,
        uri,
        qrCode,
      });
    } catch (error) {
      return Err({
        type: 'GENERATION_FAILED',
        message: `Failed to generate secret: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      });
    }
  }

  /**
   * TOTPコードを生成
   */
  generateToken(secret: string): Result<string, TOTPError> {
    try {
      // Validate secret format (Base32)
      if (!this.isValidBase32(secret)) {
        return Err({
          type: 'INVALID_SECRET',
          message: 'Secret must be a valid Base32 string',
          timestamp: new Date(),
        });
      }

      // Create TOTP instance
      const totp = new OTPAuth.TOTP({
        issuer: this.config.issuer,
        label: this.config.issuer,
        algorithm: this.config.algorithm,
        digits: this.config.digits,
        period: this.config.period,
        secret: secret,
      });

      // Generate token
      const token = totp.generate();

      return Ok(token);
    } catch (error) {
      return Err({
        type: 'INVALID_SECRET',
        message: `Failed to generate token: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      });
    }
  }

  /**
   * TOTPコードを検証
   */
  verifyToken(
    token: string,
    secret: string
  ): Result<TOTPVerificationResult, TOTPError> {
    try {
      // Validate token format (6 digits)
      if (!/^\d{6}$/.test(token)) {
        return Err({
          type: 'INVALID_TOKEN',
          message: 'Token must be a 6-digit number',
          timestamp: new Date(),
        });
      }

      // Validate secret format
      if (!this.isValidBase32(secret)) {
        return Err({
          type: 'INVALID_SECRET',
          message: 'Secret must be a valid Base32 string',
          timestamp: new Date(),
        });
      }

      // Create TOTP instance
      const totp = new OTPAuth.TOTP({
        issuer: this.config.issuer,
        label: this.config.issuer,
        algorithm: this.config.algorithm,
        digits: this.config.digits,
        period: this.config.period,
        secret: secret,
      });

      // Validate token with time window
      const delta = totp.validate({
        token,
        window: this.config.window,
      });

      // delta is null if invalid, otherwise it's the time step offset
      if (delta === null) {
        return Ok({
          valid: false,
        });
      }

      return Ok({
        valid: true,
        delta,
      });
    } catch (error) {
      return Err({
        type: 'INVALID_SECRET',
        message: `Failed to verify token: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      });
    }
  }

  /**
   * otpauth:// URIを生成
   */
  generateUri(accountName: string, secret: string): Result<string, TOTPError> {
    try {
      // Validate secret format
      if (!this.isValidBase32(secret)) {
        return Err({
          type: 'INVALID_SECRET',
          message: 'Secret must be a valid Base32 string',
          timestamp: new Date(),
        });
      }

      // Create TOTP instance
      const totp = new OTPAuth.TOTP({
        issuer: this.config.issuer,
        label: accountName,
        algorithm: this.config.algorithm,
        digits: this.config.digits,
        period: this.config.period,
        secret: secret,
      });

      // Generate URI
      const uri = totp.toString();

      return Ok(uri);
    } catch (error) {
      return Err({
        type: 'INVALID_SECRET',
        message: `Failed to generate URI: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      });
    }
  }

  /**
   * QRコード画像を生成（Data URL形式）
   */
  async generateQRCode(uri: string): Promise<Result<string, TOTPError>> {
    try {
      if (!uri || uri.trim().length === 0) {
        return Err({
          type: 'QR_CODE_GENERATION_FAILED',
          message: 'URI cannot be empty',
          timestamp: new Date(),
        });
      }

      // Generate QR code as Data URL
      const qrCodeDataURL = await QRCode.toDataURL(uri, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 300,
        margin: 1,
      });

      return Ok(qrCodeDataURL);
    } catch (error) {
      return Err({
        type: 'QR_CODE_GENERATION_FAILED',
        message: `Failed to generate QR code: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Base32形式の検証
   */
  private isValidBase32(value: string): boolean {
    // Base32 alphabet: A-Z (uppercase) and 2-7, with optional padding (=)
    const base32Regex = /^[A-Z2-7]+=*$/;
    return base32Regex.test(value);
  }
}
