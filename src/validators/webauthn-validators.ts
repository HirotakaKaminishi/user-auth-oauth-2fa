/**
 * WebAuthn API Request/Response Validators
 * Task 8: API Endpoints - WebAuthn
 *
 * Zodスキーマを使用したリクエストバリデーション
 */

import { z } from 'zod';

/**
 * POST /api/v1/webauthn/register/start
 * メールアドレスのみで登録開始（ユーザーIDは自動生成）
 */
export const registerStartRequestSchema = z.object({
  body: z.object({
    userEmail: z.string().email('メールアドレスの形式が正しくありません'),
  }),
});

export type RegisterStartRequest = z.infer<typeof registerStartRequestSchema>;

/**
 * POST /api/v1/webauthn/register/complete
 */
export const registerCompleteRequestSchema = z.object({
  body: z.object({
    userId: z.string().uuid('ユーザーIDの形式が正しくありません'),
    credential: z.object({
      id: z.string(),
      rawId: z.string(),
      response: z.object({
        clientDataJSON: z.string(),
        attestationObject: z.string(),
        transports: z.array(z.enum(['usb', 'nfc', 'ble', 'internal', 'hybrid'])).optional(),
      }),
      type: z.literal('public-key'),
      clientExtensionResults: z.record(z.unknown()).optional(),
      authenticatorAttachment: z.enum(['platform', 'cross-platform']).optional(),
    }),
    deviceName: z.string().min(1, 'デバイス名は1文字以上である必要があります').max(255, 'デバイス名は255文字以下である必要があります').optional(),
  }),
});

export type RegisterCompleteRequest = z.infer<typeof registerCompleteRequestSchema>;

/**
 * POST /api/v1/webauthn/authenticate/start
 * Discoverable credentials (passwordless) または従来型 (メールアドレス指定) での認証開始
 * userEmail が省略された場合は discoverable credentials モードで動作します
 */
export const authenticateStartRequestSchema = z.object({
  body: z.object({
    userEmail: z.string().email('メールアドレスの形式が正しくありません').optional(),
  }),
});

export type AuthenticateStartRequest = z.infer<typeof authenticateStartRequestSchema>;

/**
 * POST /api/v1/webauthn/authenticate/complete
 * userId は discoverable credentials モードでは省略可能（userHandle から抽出されます）
 */
export const authenticateCompleteRequestSchema = z.object({
  body: z.object({
    userId: z.string().uuid('ユーザーIDの形式が正しくありません').optional(),
    credential: z.object({
      id: z.string(),
      rawId: z.string(),
      response: z.object({
        clientDataJSON: z.string(),
        authenticatorData: z.string(),
        signature: z.string(),
        userHandle: z.string().optional(),
      }),
      type: z.literal('public-key'),
      clientExtensionResults: z.record(z.unknown()).optional(),
      authenticatorAttachment: z.enum(['platform', 'cross-platform']).optional(),
    }),
  }),
});

export type AuthenticateCompleteRequest = z.infer<typeof authenticateCompleteRequestSchema>;

/**
 * GET /api/v1/webauthn/credentials
 * メールアドレスまたはユーザーIDで認証情報を取得
 * どちらか一方は必須
 */
export const getCredentialsRequestSchema = z.object({
  query: z.object({
    userEmail: z.string().email('メールアドレスの形式が正しくありません').optional(),
    userId: z.string().uuid('ユーザーIDの形式が正しくありません').optional(),
  }).refine(
    (data) => data.userEmail || data.userId,
    {
      message: 'userEmail または userId のいずれかが必要です',
    }
  ),
});

export type GetCredentialsRequest = z.infer<typeof getCredentialsRequestSchema>;

/**
 * DELETE /api/v1/webauthn/credentials/:id
 * メールアドレスまたはユーザーIDで所有者を確認して削除
 */
export const deleteCredentialRequestSchema = z.object({
  params: z.object({
    id: z.string().uuid('認証情報IDの形式が正しくありません'),
  }),
  query: z.object({
    userEmail: z.string().email('メールアドレスの形式が正しくありません').optional(),
    userId: z.string().uuid('ユーザーIDの形式が正しくありません').optional(),
  }).refine(
    (data) => data.userEmail || data.userId,
    {
      message: 'userEmail または userId のいずれかが必要です',
    }
  ),
});

export type DeleteCredentialRequest = z.infer<typeof deleteCredentialRequestSchema>;

/**
 * PATCH /api/v1/webauthn/credentials/:id
 * メールアドレスまたはユーザーIDで所有者を確認して更新
 */
export const updateCredentialNameRequestSchema = z.object({
  params: z.object({
    id: z.string().uuid('認証情報IDの形式が正しくありません'),
  }),
  body: z.object({
    userEmail: z.string().email('メールアドレスの形式が正しくありません').optional(),
    userId: z.string().uuid('ユーザーIDの形式が正しくありません').optional(),
    name: z.string().min(1, 'デバイス名は1文字以上である必要があります').max(255, 'デバイス名は255文字以下である必要があります'),
  }).refine(
    (data) => data.userEmail || data.userId,
    {
      message: 'userEmail または userId のいずれかが必要です',
    }
  ),
});

export type UpdateCredentialNameRequest = z.infer<typeof updateCredentialNameRequestSchema>;

