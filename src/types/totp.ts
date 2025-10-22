/**
 * TOTP (Time-based One-Time Password) Type Definitions
 *
 * RFC 6238準拠のTOTPシステム型定義
 */

import { Result } from './result';

/**
 * TOTPエラー型
 */
export type TOTPErrorType =
  | 'INVALID_SECRET' // 無効なsecret形式
  | 'INVALID_TOKEN' // 無効なTOTPコード
  | 'TOKEN_EXPIRED' // トークン期限切れ
  | 'GENERATION_FAILED' // 生成失敗
  | 'QR_CODE_GENERATION_FAILED'; // QRコード生成失敗

export interface TOTPError {
  readonly type: TOTPErrorType;
  readonly message: string;
  readonly timestamp: Date;
}

/**
 * TOTP設定
 */
export interface TOTPConfig {
  /**
   * アプリケーション名（QRコード表示用）
   */
  readonly issuer: string;

  /**
   * TOTPコードの桁数（通常6桁）
   */
  readonly digits: number;

  /**
   * 時間ステップ（秒）
   */
  readonly period: number;

  /**
   * ハッシュアルゴリズム
   */
  readonly algorithm: 'SHA1' | 'SHA256' | 'SHA512';

  /**
   * 時刻ずれ許容ウィンドウ（±N個のウィンドウ）
   */
  readonly window: number;
}

/**
 * TOTP Secret情報
 */
export interface TOTPSecret {
  /**
   * Base32エンコードされたsecret
   */
  readonly secret: string;

  /**
   * otpauth:// URI (QRコード用)
   */
  readonly uri: string;

  /**
   * QRコード画像（Data URL形式）
   */
  readonly qrCode?: string;
}

/**
 * TOTP検証結果
 */
export interface TOTPVerificationResult {
  /**
   * 検証成功フラグ
   */
  readonly valid: boolean;

  /**
   * 使用されたウィンドウオフセット
   * （0 = 現在のウィンドウ, -1 = 前のウィンドウ, +1 = 次のウィンドウ）
   */
  readonly delta?: number;
}

/**
 * TOTP Service Interface
 */
export interface ITOTPService {
  /**
   * 新しいTOTP secretを生成
   *
   * @param accountName ユーザーのアカウント名（Email等）
   * @param generateQR QRコードを生成するか
   * @returns TOTP secret情報
   */
  generateSecret(
    accountName: string,
    generateQR?: boolean
  ): Promise<Result<TOTPSecret, TOTPError>>;

  /**
   * TOTPコードを生成
   *
   * @param secret Base32エンコードされたsecret
   * @returns 6桁のTOTPコード
   */
  generateToken(secret: string): Result<string, TOTPError>;

  /**
   * TOTPコードを検証
   *
   * @param token ユーザーが入力したTOTPコード
   * @param secret Base32エンコードされたsecret
   * @returns 検証結果
   */
  verifyToken(
    token: string,
    secret: string
  ): Result<TOTPVerificationResult, TOTPError>;

  /**
   * otpauth:// URIを生成
   *
   * @param accountName ユーザーのアカウント名
   * @param secret Base32エンコードされたsecret
   * @returns otpauth:// URI
   */
  generateUri(accountName: string, secret: string): Result<string, TOTPError>;

  /**
   * QRコード画像を生成
   *
   * @param uri otpauth:// URI
   * @returns QRコード画像（Data URL形式）
   */
  generateQRCode(uri: string): Promise<Result<string, TOTPError>>;
}
