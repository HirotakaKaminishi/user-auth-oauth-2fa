/**
 * Two-Factor Authentication (2FA) Type Definitions
 * Task 5.2-5.4: 2FA Enrollment and Verification
 */

import { Result } from './result';

/**
 * 2FAエラー型
 */
export type TwoFactorErrorType =
  | 'ENROLLMENT_FAILED' // Enrollment失敗
  | 'VERIFICATION_FAILED' // 検証失敗
  | 'INVALID_TOKEN' // 無効なトークン
  | 'INVALID_RECOVERY_CODE' // 無効なリカバリーコード
  | 'ALREADY_ENROLLED' // 既に登録済み
  | 'NOT_ENROLLED' // 未登録
  | 'ACCOUNT_LOCKED' // アカウントロック
  | 'TOTP_SERVICE_ERROR' // TOTPサービスエラー
  | 'ENCRYPTION_ERROR' // 暗号化エラー
  | 'REPOSITORY_ERROR'; // リポジトリエラー

export interface TwoFactorError {
  readonly type: TwoFactorErrorType;
  readonly message: string;
  readonly timestamp: Date;
}

/**
 * 2FA Enrollment開始レスポンス
 */
export interface EnrollmentStartResponse {
  /**
   * Base32エンコードされたsecret (一時的にクライアントに返す)
   */
  readonly secret: string;

  /**
   * otpauth:// URI (QRコード表示用)
   */
  readonly uri: string;

  /**
   * QRコード画像 (Data URL形式)
   */
  readonly qrCode: string;

  /**
   * ユーザーのアカウント名
   */
  readonly accountName: string;
}

/**
 * 2FA Enrollment完了レスポンス
 */
export interface EnrollmentCompleteResponse {
  /**
   * Enrollment成功フラグ
   */
  readonly success: true;

  /**
   * リカバリーコード（平文、一度だけ表示）
   */
  readonly recoveryCodes: string[];

  /**
   * Enrollment完了日時
   */
  readonly enrolledAt: Date;
}

/**
 * 2FA検証リクエスト
 */
export interface TwoFactorVerificationRequest {
  /**
   * ユーザーID
   */
  readonly userId: string;

  /**
   * ユーザーが入力したTOTPトークンまたはリカバリーコード
   */
  readonly token: string;
}

/**
 * 2FA検証レスポンス
 */
export interface TwoFactorVerificationResponse {
  /**
   * 検証成功フラグ
   */
  readonly valid: boolean;

  /**
   * 使用されたコードタイプ
   */
  readonly codeType?: 'totp' | 'recovery';

  /**
   * 残りの失敗試行回数（ロックアウト前）
   */
  readonly remainingAttempts?: number;

  /**
   * アカウントロック解除時刻（ロック中の場合）
   */
  readonly lockedUntil?: Date;
}

/**
 * 2FAステータス
 */
export interface TwoFactorStatus {
  /**
   * 2FA有効化状態
   */
  readonly enabled: boolean;

  /**
   * Enrollment日時
   */
  readonly enrolledAt?: Date;

  /**
   * 残りのリカバリーコード数
   */
  readonly recoveryCodesRemaining?: number;

  /**
   * 最終検証成功日時
   */
  readonly lastVerifiedAt?: Date;
}

/**
 * リカバリーコード再生成レスポンス
 */
export interface RecoveryCodesRegenerateResponse {
  /**
   * 新しいリカバリーコード（平文）
   */
  readonly recoveryCodes: string[];

  /**
   * 再生成日時
   */
  readonly regeneratedAt: Date;
}

/**
 * Two-Factor Service Interface
 */
export interface ITwoFactorService {
  /**
   * 2FA Enrollment開始
   *
   * @param userId ユーザーID
   * @param accountName アカウント名（Email等）
   * @returns Enrollment開始情報（secret、QRコード）
   */
  startEnrollment(
    userId: string,
    accountName: string
  ): Promise<Result<EnrollmentStartResponse, TwoFactorError>>;

  /**
   * 2FA Enrollment完了検証
   *
   * @param userId ユーザーID
   * @param token ユーザーが入力したTOTPトークン
   * @param secret Enrollment開始時に生成されたsecret
   * @returns リカバリーコード
   */
  completeEnrollment(
    userId: string,
    token: string,
    secret: string
  ): Promise<Result<EnrollmentCompleteResponse, TwoFactorError>>;

  /**
   * 2FAトークン検証（ログイン時）
   *
   * @param userId ユーザーID
   * @param token ユーザーが入力したトークン
   * @returns 検証結果
   */
  verifyToken(
    userId: string,
    token: string
  ): Promise<Result<TwoFactorVerificationResponse, TwoFactorError>>;

  /**
   * リカバリーコード検証
   *
   * @param userId ユーザーID
   * @param recoveryCode ユーザーが入力したリカバリーコード
   * @returns 検証結果
   */
  verifyRecoveryCode(
    userId: string,
    recoveryCode: string
  ): Promise<Result<TwoFactorVerificationResponse, TwoFactorError>>;

  /**
   * 2FA無効化
   *
   * @param userId ユーザーID
   * @returns 成功/失敗
   */
  disable(userId: string): Promise<Result<boolean, TwoFactorError>>;

  /**
   * リカバリーコード再生成
   *
   * @param userId ユーザーID
   * @returns 新しいリカバリーコード
   */
  regenerateRecoveryCodes(
    userId: string
  ): Promise<Result<RecoveryCodesRegenerateResponse, TwoFactorError>>;

  /**
   * 2FAステータス取得
   *
   * @param userId ユーザーID
   * @returns 2FAステータス
   */
  getStatus(userId: string): Promise<Result<TwoFactorStatus, TwoFactorError>>;
}
