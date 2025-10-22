/**
 * WebAuthn (FIDO2) Type Definitions
 * Task 5.5: WebAuthn Authentication
 *
 * FIDO2/WebAuthn based passwordless authentication types
 */

import { Result } from './result';

/**
 * WebAuthn Credential - データベース保存用
 */
export interface WebAuthnCredential {
  readonly id: string; // UUID (primary key)
  readonly userId: string; // User ID (foreign key)
  readonly credentialId: string; // Credential ID (base64url encoded, unique)
  readonly publicKey: string; // Public key (base64url encoded TEXT)
  readonly counter: number; // Signature counter (replay attack prevention)
  readonly transports?: AuthenticatorTransport[]; // Transport methods
  readonly deviceName: string; // User-defined device name (e.g. "MacBook Touch ID")
  readonly aaguid?: string; // Authenticator Attestation GUID
  readonly createdAt: Date; // Registration timestamp
  readonly lastUsedAt: Date; // Last authentication timestamp
}

/**
 * WebAuthn Registration Start Response
 */
export interface WebAuthnRegistrationStartResponse {
  readonly options: Awaited<ReturnType<typeof import('@simplewebauthn/server').generateRegistrationOptions>>;
  readonly challenge: string; // Challenge (stored in Redis for verification)
}

/**
 * WebAuthn Registration Complete Request
 */
export interface WebAuthnRegistrationCompleteRequest {
  readonly userId: string;
  readonly credential: {
    readonly id: string;
    readonly rawId: string;
    readonly response: {
      readonly clientDataJSON: string;
      readonly attestationObject: string;
      readonly transports?: AuthenticatorTransport[];
    };
    readonly type: string;
    readonly clientExtensionResults?: Record<string, unknown>;
    readonly authenticatorAttachment?: 'platform' | 'cross-platform';
  };
  readonly deviceName?: string; // Optional device name
}

/**
 * WebAuthn Registration Complete Response
 */
export interface WebAuthnRegistrationCompleteResponse {
  readonly success: boolean;
  readonly credentialId: string;
  readonly deviceName?: string;
  readonly createdAt: Date;
}

/**
 * WebAuthn Authentication Start Response
 */
export interface WebAuthnAuthenticationStartResponse {
  readonly options: Awaited<ReturnType<typeof import('@simplewebauthn/server').generateAuthenticationOptions>>;
  readonly challenge: string; // Challenge (stored in Redis for verification)
}

/**
 * WebAuthn Authentication Complete Request
 */
export interface WebAuthnAuthenticationCompleteRequest {
  readonly userId?: string; // Optional for discoverable credentials (will be extracted from userHandle)
  readonly credential: {
    readonly id: string;
    readonly rawId: string;
    readonly response: {
      readonly clientDataJSON: string;
      readonly authenticatorData: string;
      readonly signature: string;
      readonly userHandle?: string; // Contains userId in discoverable credential mode
    };
    readonly type: string;
    readonly clientExtensionResults?: Record<string, unknown>;
    readonly authenticatorAttachment?: 'platform' | 'cross-platform';
  };
}

/**
 * WebAuthn Authentication Complete Response
 */
export interface WebAuthnAuthenticationCompleteResponse {
  readonly success: boolean;
  readonly userId: string; // User ID (extracted from userHandle in discoverable mode)
  readonly credentialId: string;
  readonly authenticatedAt: Date;
}

/**
 * WebAuthn Credential List Item (for user display)
 */
export interface WebAuthnCredentialListItem {
  readonly id: string; // UUID
  readonly credentialId: string; // Credential ID
  readonly deviceName: string; // Device name
  readonly createdAt: Date;
  readonly lastUsedAt: Date;
}

/**
 * WebAuthn Error Types
 */
export type WebAuthnErrorType =
  | 'REGISTRATION_FAILED' // Registration process failed
  | 'AUTHENTICATION_FAILED' // Authentication process failed
  | 'CREDENTIAL_NOT_FOUND' // Credential not found
  | 'CHALLENGE_NOT_FOUND' // Challenge not found in Redis
  | 'CHALLENGE_EXPIRED' // Challenge expired
  | 'INVALID_CREDENTIAL' // Invalid credential data
  | 'DEVICE_LIMIT_EXCEEDED' // Max 5 devices limit exceeded
  | 'VERIFICATION_FAILED' // Signature verification failed
  | 'COUNTER_MISMATCH' // Counter value mismatch (replay attack detected)
  | 'REPOSITORY_ERROR' // Database error
  | 'NOT_ENROLLED'; // User has no WebAuthn credentials

export interface WebAuthnError {
  readonly type: WebAuthnErrorType;
  readonly message: string;
  readonly timestamp: Date;
}

/**
 * WebAuthn Service Interface
 */
export interface IWebAuthnService {
  /**
   * Start WebAuthn registration (generate challenge and options)
   *
   * @param userId User ID
   * @param userEmail User email (used as userName in WebAuthn)
   * @param rpName Relying Party name (e.g. "Auth System")
   * @param rpId Relying Party ID (e.g. "localhost" or "example.com")
   * @returns Registration options and challenge
   */
  startRegistration(
    userId: string,
    userEmail: string,
    rpName: string,
    rpId: string
  ): Promise<Result<WebAuthnRegistrationStartResponse, WebAuthnError>>;

  /**
   * Complete WebAuthn registration (verify and save credential)
   *
   * Note: Challenge is retrieved internally from Redis using userId
   *
   * @param request Registration completion request
   * @param rpId Relying Party ID
   * @param origin Expected origin (e.g. "http://localhost:3000")
   * @returns Registration result
   */
  completeRegistration(
    request: WebAuthnRegistrationCompleteRequest,
    rpId: string,
    origin: string
  ): Promise<Result<WebAuthnRegistrationCompleteResponse, WebAuthnError>>;

  /**
   * Start WebAuthn authentication (generate challenge and options)
   * Supports both traditional (with userId) and discoverable credential (passwordless) modes
   *
   * @param userId User ID (optional for discoverable credential mode)
   * @param rpId Relying Party ID
   * @returns Authentication options and challenge
   */
  startAuthentication(
    userId: string | undefined,
    rpId: string
  ): Promise<Result<WebAuthnAuthenticationStartResponse, WebAuthnError>>;

  /**
   * Complete WebAuthn authentication (verify signature)
   *
   * Note: Challenge is retrieved internally from Redis using userId
   *
   * @param request Authentication completion request
   * @param rpId Relying Party ID
   * @param origin Expected origin
   * @returns Authentication result
   */
  completeAuthentication(
    request: WebAuthnAuthenticationCompleteRequest,
    rpId: string,
    origin: string
  ): Promise<Result<WebAuthnAuthenticationCompleteResponse, WebAuthnError>>;

  /**
   * Get user's WebAuthn credentials
   *
   * @param userId User ID
   * @returns List of credentials
   */
  getCredentials(
    userId: string
  ): Promise<Result<WebAuthnCredentialListItem[], WebAuthnError>>;

  /**
   * Delete a WebAuthn credential
   *
   * @param userId User ID
   * @param credentialId Credential ID
   * @returns Success flag
   */
  deleteCredential(
    userId: string,
    credentialId: string
  ): Promise<Result<boolean, WebAuthnError>>;

  /**
   * Update credential name
   *
   * @param userId User ID
   * @param credentialId Credential ID
   * @param name New device name
   * @returns Success flag
   */
  updateCredentialName(
    userId: string,
    credentialId: string,
    name: string
  ): Promise<Result<boolean, WebAuthnError>>;
}

/**
 * WebAuthn Credential Repository Interface
 */
export interface IWebAuthnCredentialRepository {
  /**
   * Create a new credential
   */
  create(credential: Omit<WebAuthnCredential, 'id' | 'createdAt' | 'lastUsedAt'>): Promise<Result<WebAuthnCredential, Error>>;

  /**
   * Find credential by UUID (primary key)
   */
  findById(id: string): Promise<Result<WebAuthnCredential | null, Error>>;

  /**
   * Find credential by credential ID (base64url encoded)
   */
  findByCredentialId(credentialId: string): Promise<Result<WebAuthnCredential | null, Error>>;

  /**
   * Find all credentials for a user
   */
  findByUserId(userId: string): Promise<Result<WebAuthnCredential[], Error>>;

  /**
   * Update credential counter (after successful authentication)
   */
  updateCounter(credentialId: string, counter: number): Promise<Result<boolean, Error>>;

  /**
   * Update credential name
   */
  updateName(id: string, deviceName: string): Promise<Result<boolean, Error>>;

  /**
   * Update last used timestamp
   */
  updateLastUsed(credentialId: string): Promise<Result<boolean, Error>>;

  /**
   * Delete a credential by UUID
   */
  delete(id: string): Promise<Result<boolean, Error>>;

  /**
   * Count credentials for a user (for device limit check)
   */
  countByUserId(userId: string): Promise<Result<number, Error>>;
}

/**
 * Authenticator Transport types (from WebAuthn spec)
 */
export type AuthenticatorTransport = 'usb' | 'nfc' | 'ble' | 'internal' | 'hybrid';

/**
 * WebAuthn Error Messages (Japanese Localization)
 */
export const WEBAUTHN_ERROR_MESSAGES_JA: Record<WebAuthnErrorType, string> = {
  REGISTRATION_FAILED: '認証器の登録に失敗しました',
  AUTHENTICATION_FAILED: '認証に失敗しました',
  CREDENTIAL_NOT_FOUND: '認証情報が見つかりません',
  CHALLENGE_NOT_FOUND: 'チャレンジが見つからないか、有効期限が切れています',
  CHALLENGE_EXPIRED: 'チャレンジの有効期限が切れています。最初からやり直してください',
  INVALID_CREDENTIAL: '無効な認証情報です',
  DEVICE_LIMIT_EXCEEDED: 'デバイスの登録上限（5台）に達しています',
  VERIFICATION_FAILED: '署名の検証に失敗しました',
  COUNTER_MISMATCH: 'リプレイアタックの可能性が検出されました',
  REPOSITORY_ERROR: 'データベースエラーが発生しました',
  NOT_ENROLLED: 'WebAuthn認証情報が登録されていません',
};
