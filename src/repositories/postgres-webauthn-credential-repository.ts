/**
 * PostgreSQL WebAuthn Credential Repository
 * Task 5.5: WebAuthn (FIDO2) Authentication
 *
 * FIDO2/WebAuthn認証器のCRUD操作を管理
 */

import { Pool } from 'pg';
import { Result, Ok, Err } from '../types/result';
import {
  WebAuthnCredential,
  IWebAuthnCredentialRepository,
  AuthenticatorTransport,
} from '../types/webauthn';
import { logger } from '../config/logger';

export class PostgresWebAuthnCredentialRepository implements IWebAuthnCredentialRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * 新しい認証器を登録
   */
  async create(
    credential: Omit<WebAuthnCredential, 'id' | 'createdAt' | 'lastUsedAt'>
  ): Promise<Result<WebAuthnCredential, Error>> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // ユーザーが存在しない場合は作成（WebAuthn専用ユーザー）
      const ensureUserQuery = `
        INSERT INTO users (id, email, email_verified, name)
        VALUES ($1, $2, false, $3)
        ON CONFLICT (id) DO NOTHING
      `;

      // userIdをメールアドレスとして使用
      await client.query(ensureUserQuery, [
        credential.userId,
        `webauthn-${credential.userId}@local`,
        'WebAuthn User', // デフォルトの名前
      ]);

      // WebAuthn認証情報を作成
      const query = `
        INSERT INTO webauthn_credentials (
          user_id, credential_id, public_key, counter,
          transports, device_name, aaguid
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING
          id, user_id, credential_id, public_key, counter,
          transports, device_name, aaguid, created_at, last_used_at
      `;

      const values = [
        credential.userId,
        credential.credentialId,
        credential.publicKey,
        credential.counter,
        credential.transports || null,
        credential.deviceName,
        credential.aaguid || null,
      ];

      const result = await client.query(query, values);
      const row = result.rows[0];

      if (!row) {
        throw new Error('Failed to create WebAuthn credential');
      }

      await client.query('COMMIT');

      return Ok({
        id: row.id,
        userId: row.user_id,
        credentialId: row.credential_id,
        publicKey: row.public_key,
        counter: row.counter,
        transports: row.transports as AuthenticatorTransport[] | undefined,
        deviceName: row.device_name,
        aaguid: row.aaguid,
        createdAt: row.created_at,
        lastUsedAt: row.last_used_at,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create WebAuthn credential', { error, userId: credential.userId });
      return Err(error instanceof Error ? error : new Error('Unknown error'));
    } finally {
      client.release();
    }
  }

  /**
   * UUIDでCredentialを検索
   */
  async findById(id: string): Promise<Result<WebAuthnCredential | null, Error>> {
    try {
      const query = `
        SELECT
          id, user_id, credential_id, public_key, counter,
          transports, device_name, aaguid, created_at, last_used_at
        FROM webauthn_credentials
        WHERE id = $1
      `;

      const result = await this.pool.query(query, [id]);
      const row = result.rows[0];

      if (!row) {
        return Ok(null);
      }

      return Ok({
        id: row.id,
        userId: row.user_id,
        credentialId: row.credential_id,
        publicKey: row.public_key,
        counter: row.counter,
        transports: row.transports as AuthenticatorTransport[] | undefined,
        deviceName: row.device_name,
        aaguid: row.aaguid,
        createdAt: row.created_at,
        lastUsedAt: row.last_used_at,
      });
    } catch (error) {
      logger.error('Failed to find WebAuthn credential by ID', { error, id });
      return Err(error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  /**
   * Credential IDでCredentialを検索
   */
  async findByCredentialId(credentialId: string): Promise<Result<WebAuthnCredential | null, Error>> {
    try {
      const query = `
        SELECT
          id, user_id, credential_id, public_key, counter,
          transports, device_name, aaguid, created_at, last_used_at
        FROM webauthn_credentials
        WHERE credential_id = $1
      `;

      const result = await this.pool.query(query, [credentialId]);
      const row = result.rows[0];

      if (!row) {
        return Ok(null);
      }

      return Ok({
        id: row.id,
        userId: row.user_id,
        credentialId: row.credential_id,
        publicKey: row.public_key,
        counter: row.counter,
        transports: row.transports as AuthenticatorTransport[] | undefined,
        deviceName: row.device_name,
        aaguid: row.aaguid,
        createdAt: row.created_at,
        lastUsedAt: row.last_used_at,
      });
    } catch (error) {
      logger.error('Failed to find WebAuthn credential by credential ID', { error, credentialId });
      return Err(error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  /**
   * ユーザーの全Credentialを取得
   */
  async findByUserId(userId: string): Promise<Result<WebAuthnCredential[], Error>> {
    try {
      const query = `
        SELECT
          id, user_id, credential_id, public_key, counter,
          transports, device_name, aaguid, created_at, last_used_at
        FROM webauthn_credentials
        WHERE user_id = $1
        ORDER BY created_at DESC
      `;

      const result = await this.pool.query(query, [userId]);

      const credentials: WebAuthnCredential[] = result.rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        credentialId: row.credential_id,
        publicKey: row.public_key,
        counter: row.counter,
        transports: row.transports as AuthenticatorTransport[] | undefined,
        deviceName: row.device_name,
        aaguid: row.aaguid,
        createdAt: row.created_at,
        lastUsedAt: row.last_used_at,
      }));

      return Ok(credentials);
    } catch (error) {
      logger.error('Failed to find WebAuthn credentials by user ID', { error, userId });
      return Err(error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  /**
   * カウンター値を更新（認証成功時）
   */
  async updateCounter(credentialId: string, counter: number): Promise<Result<boolean, Error>> {
    try {
      const query = `
        UPDATE webauthn_credentials
        SET counter = $1
        WHERE credential_id = $2
      `;

      const result = await this.pool.query(query, [counter, credentialId]);

      return Ok(result.rowCount !== null && result.rowCount > 0);
    } catch (error) {
      logger.error('Failed to update WebAuthn credential counter', { error, credentialId, counter });
      return Err(error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  /**
   * デバイス名を更新
   */
  async updateName(id: string, deviceName: string): Promise<Result<boolean, Error>> {
    try {
      const query = `
        UPDATE webauthn_credentials
        SET device_name = $1
        WHERE id = $2
      `;

      const result = await this.pool.query(query, [deviceName, id]);

      return Ok(result.rowCount !== null && result.rowCount > 0);
    } catch (error) {
      logger.error('Failed to update WebAuthn credential name', { error, id, deviceName });
      return Err(error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  /**
   * 最終使用日時を更新
   */
  async updateLastUsed(credentialId: string): Promise<Result<boolean, Error>> {
    try {
      const query = `
        UPDATE webauthn_credentials
        SET last_used_at = NOW()
        WHERE credential_id = $1
      `;

      const result = await this.pool.query(query, [credentialId]);

      return Ok(result.rowCount !== null && result.rowCount > 0);
    } catch (error) {
      logger.error('Failed to update WebAuthn credential last used', { error, credentialId });
      return Err(error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  /**
   * Credentialを削除
   */
  async delete(id: string): Promise<Result<boolean, Error>> {
    try {
      const query = `
        DELETE FROM webauthn_credentials
        WHERE id = $1
      `;

      const result = await this.pool.query(query, [id]);

      return Ok(result.rowCount !== null && result.rowCount > 0);
    } catch (error) {
      logger.error('Failed to delete WebAuthn credential', { error, id });
      return Err(error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  /**
   * ユーザーのCredential数をカウント（デバイス制限チェック用）
   */
  async countByUserId(userId: string): Promise<Result<number, Error>> {
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM webauthn_credentials
        WHERE user_id = $1
      `;

      const result = await this.pool.query(query, [userId]);
      const count = parseInt(result.rows[0]?.count || '0', 10);

      return Ok(count);
    } catch (error) {
      logger.error('Failed to count WebAuthn credentials', { error, userId });
      return Err(error instanceof Error ? error : new Error('Unknown error'));
    }
  }
}
