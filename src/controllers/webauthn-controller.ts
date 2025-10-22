/**
 * WebAuthn API Controller
 * Task 8: API Endpoints - WebAuthn
 *
 * WebAuthn認証のHTTPエンドポイント処理
 */

import { Request, Response } from 'express';
import { IWebAuthnService } from '../types/webauthn';
import { UserRepository } from '../repositories/user-repository.interface';
import { logger } from '../config/logger';
import {
  registerStartRequestSchema,
  registerCompleteRequestSchema,
  authenticateStartRequestSchema,
  authenticateCompleteRequestSchema,
  getCredentialsRequestSchema,
  deleteCredentialRequestSchema,
  updateCredentialNameRequestSchema,
} from '../validators/webauthn-validators';

/**
 * WebAuthn Controller
 */
export class WebAuthnController {
  constructor(
    private readonly webAuthnService: IWebAuthnService,
    private readonly userRepository: UserRepository,
    private readonly rpName: string,
    private readonly rpId: string,
    private readonly origin: string
  ) {}

  /**
   * POST /api/v1/webauthn/register/start
   * WebAuthn登録を開始し、チャレンジとオプションを返す
   * メールアドレスから自動的にユーザーを検索または作成します
   */
  async registerStart(req: Request, res: Response): Promise<void> {
    try {
      // リクエストバリデーション
      const validation = registerStartRequestSchema.safeParse({ body: req.body });
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            message: 'リクエストデータが正しくありません',
            details: validation.error.errors,
          },
        });
        return;
      }

      const { userEmail } = validation.data.body;

      logger.info('Starting WebAuthn registration', { userEmail });

      // メールアドレスでユーザーを検索または作成
      let userId: string;
      const existingUser = await this.userRepository.findByEmail(userEmail);

      if (!existingUser.success) {
        logger.error('Failed to query user by email', { userEmail, error: existingUser.error });
        res.status(500).json({
          success: false,
          error: {
            type: 'INTERNAL_ERROR',
            message: '予期しないエラーが発生しました',
          },
        });
        return;
      }

      let isExistingUser = false;
      let existingCredentialsCount = 0;

      if (existingUser.value) {
        // ユーザーが存在する場合
        userId = existingUser.value.id;
        isExistingUser = true;
        logger.info('Existing user found for WebAuthn registration', { userId, userEmail });

        // 既存の認証情報をチェック
        const credentialsResult = await this.webAuthnService.getCredentials(userId);
        if (credentialsResult.success) {
          existingCredentialsCount = credentialsResult.value.length;
        }

        if (existingCredentialsCount > 0) {
          logger.warn('User already has WebAuthn credentials', {
            userId,
            userEmail,
            credentialsCount: existingCredentialsCount,
          });
          res.status(409).json({
            success: false,
            error: {
              type: 'USER_ALREADY_REGISTERED',
              message: `このメールアドレスは既に登録されています（登録済みデバイス: ${existingCredentialsCount}個）`,
              details: {
                isExistingUser: true,
                existingCredentialsCount,
                userEmail,
              },
            },
          });
          return;
        }
      } else {
        // ユーザーが存在しない場合は新規作成
        const createResult = await this.userRepository.create(
          userEmail,
          userEmail.split('@')[0] // メールアドレスのローカル部分を名前として使用
        );

        if (!createResult.success) {
          logger.error('Failed to create new user', { userEmail, error: createResult.error });
          res.status(500).json({
            success: false,
            error: {
              type: 'INTERNAL_ERROR',
              message: 'ユーザーの作成に失敗しました',
            },
          });
          return;
        }

        userId = createResult.value.id;
        logger.info('New user created for WebAuthn registration', { userId, userEmail });
      }

      // WebAuthn登録開始
      const result = await this.webAuthnService.startRegistration(
        userId,
        userEmail,
        this.rpName,
        this.rpId
      );

      if (!result.success) {
        logger.warn('WebAuthn registration start failed', {
          userId,
          error: result.error,
        });

        res.status(400).json({
          success: false,
          error: {
            type: result.error.type,
            message: result.error.message,
            timestamp: result.error.timestamp,
          },
        });
        return;
      }

      logger.info('WebAuthn registration started successfully', { userId, userEmail });

      res.status(200).json({
        success: true,
        data: {
          userId, // フロントエンドが登録完了時に使用（ユーザーには非表示）
          options: result.value.options,
          challenge: result.value.challenge,
          isExistingUser,
          existingCredentialsCount,
        },
      });
    } catch (error) {
      logger.error('Unexpected error in registerStart', { error });
      res.status(500).json({
        success: false,
        error: {
          type: 'INTERNAL_ERROR',
          message: '予期しないエラーが発生しました',
        },
      });
    }
  }

  /**
   * POST /api/v1/webauthn/register/complete
   * WebAuthn登録を完了し、認証器を保存
   */
  async registerComplete(req: Request, res: Response): Promise<void> {
    try {
      // リクエストバリデーション
      const validation = registerCompleteRequestSchema.safeParse({ body: req.body });
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            message: 'リクエストデータが正しくありません',
            details: validation.error.errors,
          },
        });
        return;
      }

      const { userId, credential, deviceName } = validation.data.body;

      logger.info('Completing WebAuthn registration', { userId });

      // 登録完了処理（チャレンジは内部でRedisから取得）
      const result = await this.webAuthnService.completeRegistration(
        {
          userId,
          credential: credential as any, // 型互換性のため
          deviceName,
        },
        this.rpId,
        this.origin
      );

      if (!result.success) {
        logger.warn('WebAuthn registration completion failed', {
          userId,
          error: result.error,
        });

        res.status(400).json({
          success: false,
          error: {
            type: result.error.type,
            message: result.error.message,
            timestamp: result.error.timestamp,
          },
        });
        return;
      }

      logger.info('WebAuthn registration completed successfully', {
        userId,
        credentialId: result.value.credentialId,
      });

      res.status(201).json({
        success: true,
        data: {
          credentialId: result.value.credentialId,
          deviceName: result.value.deviceName,
          createdAt: result.value.createdAt,
        },
      });
    } catch (error) {
      logger.error('Unexpected error in registerComplete', { error });
      res.status(500).json({
        success: false,
        error: {
          type: 'INTERNAL_ERROR',
          message: '予期しないエラーが発生しました',
        },
      });
    }
  }

  /**
   * POST /api/v1/webauthn/authenticate/start
   * WebAuthn認証を開始し、チャレンジとオプションを返す
   *
   * Discoverable Credentials (Passwordless) モード:
   *   userEmail を省略すると、認証器に保存された Resident Key から自動的にユーザーを特定します
   *
   * 従来型モード:
   *   userEmail を指定すると、そのメールアドレスのユーザーの認証情報のみを許可します
   */
  async authenticateStart(req: Request, res: Response): Promise<void> {
    try {
      // リクエストバリデーション
      const validation = authenticateStartRequestSchema.safeParse({ body: req.body });
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            message: 'リクエストデータが正しくありません',
            details: validation.error.errors,
          },
        });
        return;
      }

      const { userEmail } = validation.data.body || {};

      // Discoverable Credentials モード (userEmail なし)
      if (!userEmail) {
        logger.info('Starting WebAuthn authentication in discoverable mode');

        // userIdなしで認証開始（認証器がResident Keyから自動選択）
        const result = await this.webAuthnService.startAuthentication(undefined, this.rpId);

        if (!result.success) {
          logger.warn('WebAuthn authentication start failed (discoverable mode)', {
            error: result.error,
          });

          res.status(400).json({
            success: false,
            error: {
              type: result.error.type,
              message: result.error.message,
              timestamp: result.error.timestamp,
            },
          });
          return;
        }

        logger.info('WebAuthn authentication started successfully (discoverable mode)');

        res.status(200).json({
          success: true,
          data: {
            options: result.value.options,
            challenge: result.value.challenge,
          },
        });
        return;
      }

      // 従来型モード (userEmail あり)
      logger.info('Starting WebAuthn authentication in traditional mode', { userEmail });

      // メールアドレスでユーザーを検索
      const existingUser = await this.userRepository.findByEmail(userEmail);

      if (!existingUser.success) {
        logger.error('Failed to query user by email', { userEmail, error: existingUser.error });
        res.status(500).json({
          success: false,
          error: {
            type: 'INTERNAL_ERROR',
            message: '予期しないエラーが発生しました',
          },
        });
        return;
      }

      if (!existingUser.value) {
        logger.warn('User not found for authentication', { userEmail });
        res.status(404).json({
          success: false,
          error: {
            type: 'USER_NOT_FOUND',
            message: 'このメールアドレスは登録されていません',
          },
        });
        return;
      }

      const userId = existingUser.value.id;

      // WebAuthn認証開始
      const result = await this.webAuthnService.startAuthentication(userId, this.rpId);

      if (!result.success) {
        logger.warn('WebAuthn authentication start failed (traditional mode)', {
          userId,
          userEmail,
          error: result.error,
        });

        res.status(400).json({
          success: false,
          error: {
            type: result.error.type,
            message: result.error.message,
            timestamp: result.error.timestamp,
          },
        });
        return;
      }

      logger.info('WebAuthn authentication started successfully (traditional mode)', { userId, userEmail });

      res.status(200).json({
        success: true,
        data: {
          userId, // フロントエンドが認証完了時に使用（従来型モードのみ）
          options: result.value.options,
          challenge: result.value.challenge,
        },
      });
    } catch (error) {
      logger.error('Unexpected error in authenticateStart', { error });
      res.status(500).json({
        success: false,
        error: {
          type: 'INTERNAL_ERROR',
          message: '予期しないエラーが発生しました',
        },
      });
    }
  }

  /**
   * POST /api/v1/webauthn/authenticate/complete
   * WebAuthn認証を完了し、署名を検証
   */
  async authenticateComplete(req: Request, res: Response): Promise<void> {
    try {
      // リクエストバリデーション
      const validation = authenticateCompleteRequestSchema.safeParse({ body: req.body });
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            message: 'リクエストデータが正しくありません',
            details: validation.error.errors,
          },
        });
        return;
      }

      const { userId, credential } = validation.data.body;

      logger.info('Completing WebAuthn authentication', { userId });

      // 認証完了処理（チャレンジは内部でRedisから取得）
      const result = await this.webAuthnService.completeAuthentication(
        {
          userId,
          credential: credential as any, // 型互換性のため
        },
        this.rpId,
        this.origin
      );

      if (!result.success) {
        logger.warn('WebAuthn authentication completion failed', {
          userId,
          error: result.error,
        });

        res.status(401).json({
          success: false,
          error: {
            type: result.error.type,
            message: result.error.message,
            timestamp: result.error.timestamp,
          },
        });
        return;
      }

      // result.value.userId は userHandle から抽出されたもの（discoverable mode）または
      // リクエストで提供されたもの（traditional mode）
      const authenticatedUserId = result.value.userId;

      logger.info('WebAuthn authentication completed successfully', {
        userId: authenticatedUserId,
        credentialId: result.value.credentialId,
      });

      res.status(200).json({
        success: true,
        data: {
          userId: authenticatedUserId, // Discoverable mode ではこの値がフロントエンドで必要
          credentialId: result.value.credentialId,
          authenticatedAt: result.value.authenticatedAt,
        },
      });
    } catch (error) {
      logger.error('Unexpected error in authenticateComplete', { error });
      res.status(500).json({
        success: false,
        error: {
          type: 'INTERNAL_ERROR',
          message: '予期しないエラーが発生しました',
        },
      });
    }
  }

  /**
   * GET /api/v1/webauthn/credentials
   * ユーザーの登録済みWebAuthn認証器一覧を取得
   * userEmail または userId のいずれかで取得可能
   */
  async getCredentials(req: Request, res: Response): Promise<void> {
    try {
      // リクエストバリデーション
      const validation = getCredentialsRequestSchema.safeParse({ query: req.query });
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            message: 'リクエストデータが正しくありません',
            details: validation.error.errors,
          },
        });
        return;
      }

      const { userEmail, userId: queryUserId } = validation.data.query;

      logger.info('Getting WebAuthn credentials', { userEmail, userId: queryUserId });

      let userId: string;

      // userId が直接提供された場合（認証後の管理画面など）
      if (queryUserId) {
        userId = queryUserId;
      } else if (userEmail) {
        // メールアドレスでユーザーを検索
        const existingUser = await this.userRepository.findByEmail(userEmail);

        if (!existingUser.success) {
          logger.error('Failed to query user by email', { userEmail, error: existingUser.error });
          res.status(500).json({
            success: false,
            error: {
              type: 'INTERNAL_ERROR',
              message: '予期しないエラーが発生しました',
            },
          });
          return;
        }

        if (!existingUser.value) {
          logger.warn('User not found for credentials', { userEmail });
          res.status(404).json({
            success: false,
            error: {
              type: 'USER_NOT_FOUND',
              message: 'このメールアドレスは登録されていません',
            },
          });
          return;
        }

        userId = existingUser.value.id;
      } else {
        // This should never happen due to validator refine check
        res.status(400).json({
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            message: 'userEmail または userId のいずれかが必要です',
          },
        });
        return;
      }

      const result = await this.webAuthnService.getCredentials(userId);

      if (!result.success) {
        logger.warn('Failed to get WebAuthn credentials', {
          userId,
          error: result.error,
        });

        res.status(400).json({
          success: false,
          error: {
            type: result.error.type,
            message: result.error.message,
            timestamp: result.error.timestamp,
          },
        });
        return;
      }

      logger.info('Retrieved WebAuthn credentials successfully', {
        userId,
        count: result.value.length,
      });

      res.status(200).json({
        success: true,
        data: {
          credentials: result.value,
        },
      });
    } catch (error) {
      logger.error('Unexpected error in getCredentials', { error });
      res.status(500).json({
        success: false,
        error: {
          type: 'INTERNAL_ERROR',
          message: '予期しないエラーが発生しました',
        },
      });
    }
  }

  /**
   * DELETE /api/v1/webauthn/credentials/:id
   * WebAuthn認証器を削除
   */
  async deleteCredential(req: Request, res: Response): Promise<void> {
    try {
      // リクエストバリデーション
      const validation = deleteCredentialRequestSchema.safeParse({
        params: req.params,
        query: req.query,
      });
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            message: 'リクエストデータが正しくありません',
            details: validation.error.errors,
          },
        });
        return;
      }

      const { id: credentialId } = validation.data.params;
      const { userEmail, userId: queryUserId } = validation.data.query;

      logger.info('Deleting WebAuthn credential', { userEmail, userId: queryUserId, credentialId });

      let userId: string;

      // userId が直接提供された場合（認証後の管理画面など）
      if (queryUserId) {
        userId = queryUserId;
      } else if (userEmail) {
        // メールアドレスでユーザーを検索
        const existingUser = await this.userRepository.findByEmail(userEmail);

        if (!existingUser.success) {
          logger.error('Failed to query user by email', { userEmail, error: existingUser.error });
          res.status(500).json({
            success: false,
            error: {
              type: 'INTERNAL_ERROR',
              message: '予期しないエラーが発生しました',
            },
          });
          return;
        }

        if (!existingUser.value) {
          logger.warn('User not found for credential deletion', { userEmail });
          res.status(404).json({
            success: false,
            error: {
              type: 'USER_NOT_FOUND',
              message: 'このメールアドレスは登録されていません',
            },
          });
          return;
        }

        userId = existingUser.value.id;
      } else {
        // This should never happen due to validator refine check
        res.status(400).json({
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            message: 'userEmail または userId のいずれかが必要です',
          },
        });
        return;
      }

      const result = await this.webAuthnService.deleteCredential(userId, credentialId);

      if (!result.success) {
        logger.warn('Failed to delete WebAuthn credential', {
          userId,
          credentialId,
          error: result.error,
        });

        res.status(400).json({
          success: false,
          error: {
            type: result.error.type,
            message: result.error.message,
            timestamp: result.error.timestamp,
          },
        });
        return;
      }

      logger.info('WebAuthn credential deleted successfully', {
        userId,
        credentialId,
      });

      res.status(200).json({
        success: true,
        data: {
          deleted: result.value,
        },
      });
    } catch (error) {
      logger.error('Unexpected error in deleteCredential', { error });
      res.status(500).json({
        success: false,
        error: {
          type: 'INTERNAL_ERROR',
          message: '予期しないエラーが発生しました',
        },
      });
    }
  }

  /**
   * PUT /api/v1/webauthn/credentials/:id
   * WebAuthn認証器の名前を更新
   */
  async updateCredentialName(req: Request, res: Response): Promise<void> {
    try {
      // リクエストバリデーション
      const validation = updateCredentialNameRequestSchema.safeParse({
        params: req.params,
        body: req.body,
      });
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            message: 'リクエストデータが正しくありません',
            details: validation.error.errors,
          },
        });
        return;
      }

      const { id: credentialId } = validation.data.params;
      const { userEmail, userId: bodyUserId, name } = validation.data.body;

      logger.info('Updating WebAuthn credential name', {
        userEmail,
        userId: bodyUserId,
        credentialId,
        name,
      });

      let userId: string;

      // userId が直接提供された場合（認証後の管理画面など）
      if (bodyUserId) {
        userId = bodyUserId;
      } else if (userEmail) {
        // メールアドレスでユーザーを検索
        const existingUser = await this.userRepository.findByEmail(userEmail);

        if (!existingUser.success) {
          logger.error('Failed to query user by email', { userEmail, error: existingUser.error });
          res.status(500).json({
            success: false,
            error: {
              type: 'INTERNAL_ERROR',
              message: '予期しないエラーが発生しました',
            },
          });
          return;
        }

        if (!existingUser.value) {
          logger.warn('User not found for credential update', { userEmail });
          res.status(404).json({
            success: false,
            error: {
              type: 'USER_NOT_FOUND',
              message: 'このメールアドレスは登録されていません',
            },
          });
          return;
        }

        userId = existingUser.value.id;
      } else {
        // This should never happen due to validator refine check
        res.status(400).json({
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            message: 'userEmail または userId のいずれかが必要です',
          },
        });
        return;
      }

      const result = await this.webAuthnService.updateCredentialName(
        userId,
        credentialId,
        name
      );

      if (!result.success) {
        logger.warn('Failed to update WebAuthn credential name', {
          userId,
          credentialId,
          error: result.error,
        });

        res.status(400).json({
          success: false,
          error: {
            type: result.error.type,
            message: result.error.message,
            timestamp: result.error.timestamp,
          },
        });
        return;
      }

      logger.info('WebAuthn credential name updated successfully', {
        userId,
        credentialId,
        name,
      });

      res.status(200).json({
        success: true,
        data: {
          updated: result.value,
        },
      });
    } catch (error) {
      logger.error('Unexpected error in updateCredentialName', { error });
      res.status(500).json({
        success: false,
        error: {
          type: 'INTERNAL_ERROR',
          message: '予期しないエラーが発生しました',
        },
      });
    }
  }
}
