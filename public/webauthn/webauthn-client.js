/**
 * WebAuthn Client Library
 * ブラウザのWebAuthn APIとサーバーAPIを接続
 */

// UUID v4 生成関数
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// エラーメッセージの日本語化マッピング
function translateErrorMessage(errorMessage) {
  if (!errorMessage) return '不明なエラーが発生しました';

  const translations = {
    // WebAuthn API エラー
    'The operation either timed out or was not allowed': '操作がタイムアウトしたか、許可されませんでした',
    'An unknown error occurred while talking to the credential manager': '認証情報マネージャーとの通信中に不明なエラーが発生しました',
    'Request interrupted by user': 'ユーザーによって操作がキャンセルされました',
    'The authenticator was previously registered': 'この認証器は既に登録されています',
    'User verification is required': 'ユーザー検証が必要です',
    'This request has been cancelled': 'リクエストがキャンセルされました',
    'The relying party ID is not a registrable domain suffix': 'Relying Party IDが登録可能なドメインではありません',
    'No credentials available': '利用可能な認証情報がありません',
    'Credential creation was cancelled': '認証情報の作成がキャンセルされました',
    'Authentication was cancelled': '認証がキャンセルされました',
    'Passthrough is not supported': 'パススルーはサポートされていません',
    'The operation is insecure': '操作が安全ではありません',
    'The operation was aborted': '操作が中断されました',
    'A mutation operation was attempted on a database that did not allow mutations': 'データベースへの変更が許可されていません',
    // Validation エラー
    'Required': '必須項目です',
    'Invalid': '無効な値です',
    'Invalid user ID format': 'ユーザーIDの形式が正しくありません',
    'Invalid email format': 'メールアドレスの形式が正しくありません',
    'Invalid credential ID format': '認証情報IDの形式が正しくありません',
    'Invalid request data': 'リクエストデータが正しくありません',
    'String must contain at least': '文字数が不足しています',
    'String must contain at most': '文字数が多すぎます',
    // サーバーエラー（既に日本語化されているがフォールバック用）
    'Failed to start registration': '登録の開始に失敗しました',
    'Failed to complete registration': '登録の完了に失敗しました',
    'Failed to start authentication': '認証の開始に失敗しました',
    'Failed to complete authentication': '認証の完了に失敗しました',
    'Failed to get credentials': '認証情報の取得に失敗しました',
    'Failed to delete credential': '認証情報の削除に失敗しました',
    'Failed to update credential name': '認証情報名の更新に失敗しました',
    'USER_ALREADY_REGISTERED': 'このメールアドレスは既に登録されています',
  };

  // エラーメッセージの部分一致検索
  let translatedMessage = errorMessage;
  for (const [en, ja] of Object.entries(translations)) {
    if (translatedMessage.includes(en)) {
      translatedMessage = translatedMessage.replace(en, ja);
    }
  }

  return translatedMessage;
}

/**
 * WebAuthn API サポートチェック
 * @returns {boolean} WebAuthn APIがサポートされているか
 */
function isWebAuthnSupported() {
  return (
    window.PublicKeyCredential !== undefined &&
    navigator.credentials !== undefined &&
    typeof navigator.credentials.create === 'function' &&
    typeof navigator.credentials.get === 'function'
  );
}

// Base64URL encoding/decoding utilities
function bufferToBase64URL(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64URLToBuffer(base64URL) {
  const base64 = base64URL
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * WebAuthn登録フロー
 *
 * @param {string} userEmail - ユーザーメールアドレス
 * @param {string} [deviceName] - デバイス名（任意）
 * @returns {Promise<{success: boolean, credentialId?: string, deviceName?: string, error?: string}>}
 */
async function registerWebAuthn(userEmail, deviceName) {
  try {
    // WebAuthn APIサポートチェック
    if (!isWebAuthnSupported()) {
      throw new Error('お使いのブラウザはWebAuthn/パスキーをサポートしていません。Chrome、Safari、Edge、Firefoxの最新版をお使いください。');
    }

    // Step 1: サーバーから登録オプションを取得
    console.log('[WebAuthn] Starting registration for email:', userEmail);

    const startResponse = await fetch('/api/v1/webauthn/register/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userEmail }),
    });

    if (!startResponse.ok) {
      const errorData = await startResponse.json();
      throw new Error(errorData.error?.message || '登録の開始に失敗しました');
    }

    const { data } = await startResponse.json();
    const { userId, options, challenge } = data;

    console.log('[WebAuthn] Received registration options:', options);

    // Step 2: ブラウザのWebAuthn APIを呼び出し
    // Base64URLデコードが必要なフィールドを変換
    const publicKeyCredentialCreationOptions = {
      challenge: base64URLToBuffer(options.challenge),
      rp: options.rp,
      user: {
        id: base64URLToBuffer(options.user.id),
        name: options.user.name,
        displayName: options.user.displayName,
      },
      pubKeyCredParams: options.pubKeyCredParams,
      timeout: options.timeout,
      attestation: options.attestation,
      excludeCredentials: (options.excludeCredentials || []).map(cred => ({
        ...cred,
        id: base64URLToBuffer(cred.id),
      })),
      authenticatorSelection: options.authenticatorSelection,
      extensions: options.extensions,
    };

    console.log('[WebAuthn] Calling navigator.credentials.create()...');

    const credential = await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions,
    });

    if (!credential) {
      throw new Error('認証器の登録がキャンセルされました');
    }

    console.log('[WebAuthn] Credential created:', credential);

    // Step 3: 認証情報をサーバーに送信
    const credentialJSON = {
      id: credential.id,
      rawId: bufferToBase64URL(credential.rawId),
      response: {
        clientDataJSON: bufferToBase64URL(credential.response.clientDataJSON),
        attestationObject: bufferToBase64URL(credential.response.attestationObject),
        transports: credential.response.getTransports?.() || [],
      },
      type: credential.type,
      clientExtensionResults: credential.getClientExtensionResults(),
      authenticatorAttachment: credential.authenticatorAttachment,
    };

    console.log('[WebAuthn] Sending credential to server...');

    const completeResponse = await fetch('/api/v1/webauthn/register/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        credential: credentialJSON,
        deviceName,
      }),
    });

    if (!completeResponse.ok) {
      const errorData = await completeResponse.json();
      throw new Error(errorData.error?.message || '登録の完了に失敗しました');
    }

    const result = await completeResponse.json();

    console.log('[WebAuthn] Registration successful:', result.data);

    return {
      success: true,
      credentialId: result.data.credentialId,
      deviceName: result.data.deviceName,
    };

  } catch (error) {
    console.error('[WebAuthn] Registration error:', error);
    return {
      success: false,
      error: translateErrorMessage(error.message),
    };
  }
}

/**
 * WebAuthn認証フロー (Discoverable Credentials / Passwordless)
 * 入力不要！デバイスの Resident Key から自動的にユーザーを特定します
 *
 * @returns {Promise<{success: boolean, userId?: string, credentialId?: string, error?: string}>}
 */
async function authenticateWebAuthnDiscoverable() {
  try {
    // WebAuthn APIサポートチェック
    if (!isWebAuthnSupported()) {
      throw new Error('お使いのブラウザはWebAuthn/パスキーをサポートしていません。Chrome、Safari、Edge、Firefoxの最新版をお使いください。');
    }

    // Step 1: サーバーから認証オプションを取得（userEmail なし）
    console.log('[WebAuthn] Starting discoverable authentication (passwordless)');

    const startResponse = await fetch('/api/v1/webauthn/authenticate/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}), // Empty body - no userEmail needed!
    });

    if (!startResponse.ok) {
      const errorData = await startResponse.json();
      throw new Error(errorData.error?.message || '認証の開始に失敗しました');
    }

    const { data } = await startResponse.json();
    const { options } = data;

    console.log('[WebAuthn] Received authentication options (discoverable):', options);

    // Step 2: ブラウザのWebAuthn APIを呼び出し
    const publicKeyCredentialRequestOptions = {
      challenge: base64URLToBuffer(options.challenge),
      timeout: options.timeout,
      rpId: options.rpId,
      allowCredentials: [], // Empty = discoverable mode!
      userVerification: options.userVerification,
      extensions: options.extensions,
    };

    console.log('[WebAuthn] Calling navigator.credentials.get() (discoverable mode)...');

    const assertion = await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
    });

    if (!assertion) {
      throw new Error('認証がキャンセルされました');
    }

    console.log('[WebAuthn] Assertion created:', assertion);

    // Step 3: 認証情報をサーバーに送信（userIdは不要 - userHandleから抽出される）
    const assertionJSON = {
      id: assertion.id,
      rawId: bufferToBase64URL(assertion.rawId),
      response: {
        clientDataJSON: bufferToBase64URL(assertion.response.clientDataJSON),
        authenticatorData: bufferToBase64URL(assertion.response.authenticatorData),
        signature: bufferToBase64URL(assertion.response.signature),
        userHandle: assertion.response.userHandle
          ? bufferToBase64URL(assertion.response.userHandle)
          : undefined,
      },
      type: assertion.type,
      clientExtensionResults: assertion.getClientExtensionResults(),
      authenticatorAttachment: assertion.authenticatorAttachment,
    };

    console.log('[WebAuthn] Sending assertion to server (discoverable mode)...');

    const completeResponse = await fetch('/api/v1/webauthn/authenticate/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        credential: assertionJSON,
        // No userId - will be extracted from userHandle!
      }),
    });

    if (!completeResponse.ok) {
      const errorData = await completeResponse.json();
      throw new Error(errorData.error?.message || '認証の完了に失敗しました');
    }

    const result = await completeResponse.json();

    console.log('[WebAuthn] Authentication successful (discoverable):', result.data);

    return {
      success: true,
      userId: result.data.userId, // Extracted from userHandle by the server!
      credentialId: result.data.credentialId,
    };

  } catch (error) {
    console.error('[WebAuthn] Authentication error (discoverable):', error);
    return {
      success: false,
      error: translateErrorMessage(error.message),
    };
  }
}

/**
 * WebAuthn認証フロー (Traditional - with email)
 *
 * @param {string} userEmail - ユーザーメールアドレス
 * @returns {Promise<{success: boolean, credentialId?: string, error?: string}>}
 */
async function authenticateWebAuthn(userEmail) {
  try {
    // WebAuthn APIサポートチェック
    if (!isWebAuthnSupported()) {
      throw new Error('お使いのブラウザはWebAuthn/パスキーをサポートしていません。Chrome、Safari、Edge、Firefoxの最新版をお使いください。');
    }

    // Step 1: サーバーから認証オプションを取得
    console.log('[WebAuthn] Starting authentication for email:', userEmail);

    const startResponse = await fetch('/api/v1/webauthn/authenticate/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userEmail }),
    });

    if (!startResponse.ok) {
      const errorData = await startResponse.json();
      throw new Error(errorData.error?.message || '認証の開始に失敗しました');
    }

    const { data } = await startResponse.json();
    const { userId, options } = data;

    console.log('[WebAuthn] Received authentication options:', options);

    // Step 2: ブラウザのWebAuthn APIを呼び出し
    const publicKeyCredentialRequestOptions = {
      challenge: base64URLToBuffer(options.challenge),
      timeout: options.timeout,
      rpId: options.rpId,
      allowCredentials: (options.allowCredentials || []).map(cred => ({
        ...cred,
        id: base64URLToBuffer(cred.id),
      })),
      userVerification: options.userVerification,
      extensions: options.extensions,
    };

    console.log('[WebAuthn] Calling navigator.credentials.get()...');

    const assertion = await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
    });

    if (!assertion) {
      throw new Error('認証がキャンセルされました');
    }

    console.log('[WebAuthn] Assertion created:', assertion);

    // Step 3: 認証情報をサーバーに送信
    const assertionJSON = {
      id: assertion.id,
      rawId: bufferToBase64URL(assertion.rawId),
      response: {
        clientDataJSON: bufferToBase64URL(assertion.response.clientDataJSON),
        authenticatorData: bufferToBase64URL(assertion.response.authenticatorData),
        signature: bufferToBase64URL(assertion.response.signature),
        userHandle: assertion.response.userHandle
          ? bufferToBase64URL(assertion.response.userHandle)
          : undefined,
      },
      type: assertion.type,
      clientExtensionResults: assertion.getClientExtensionResults(),
      authenticatorAttachment: assertion.authenticatorAttachment,
    };

    console.log('[WebAuthn] Sending assertion to server...');

    const completeResponse = await fetch('/api/v1/webauthn/authenticate/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        credential: assertionJSON,
      }),
    });

    if (!completeResponse.ok) {
      const errorData = await completeResponse.json();
      throw new Error(errorData.error?.message || '認証の完了に失敗しました');
    }

    const result = await completeResponse.json();

    console.log('[WebAuthn] Authentication successful:', result.data);

    return {
      success: true,
      credentialId: result.data.credentialId,
    };

  } catch (error) {
    console.error('[WebAuthn] Authentication error:', error);
    return {
      success: false,
      error: translateErrorMessage(error.message),
    };
  }
}

/**
 * 認証情報一覧を取得 (userId ベース)
 * 認証後に使用 - userIdで直接取得できます
 *
 * @param {string} userId - ユーザーID (UUID)
 * @returns {Promise<{success: boolean, credentials?: Array, error?: string}>}
 */
async function getCredentialsByUserId(userId) {
  try {
    console.log('[WebAuthn] Getting credentials for userId:', userId);

    const response = await fetch(`/api/v1/webauthn/credentials?userId=${encodeURIComponent(userId)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || '認証情報の取得に失敗しました');
    }

    const { data } = await response.json();
    console.log('[WebAuthn] Got credentials:', data.credentials);

    return {
      success: true,
      credentials: data.credentials,
    };

  } catch (error) {
    console.error('[WebAuthn] Get credentials error:', error);
    return {
      success: false,
      error: translateErrorMessage(error.message),
    };
  }
}

/**
 * 認証情報一覧を取得
 *
 * @param {string} userEmail - ユーザーメールアドレス
 * @returns {Promise<{success: boolean, credentials?: Array, error?: string}>}
 */
async function getCredentials(userEmail) {
  try {
    console.log('[WebAuthn] Getting credentials for email:', userEmail);

    const response = await fetch(`/api/v1/webauthn/credentials?userEmail=${encodeURIComponent(userEmail)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || '認証情報の取得に失敗しました');
    }

    const { data } = await response.json();
    console.log('[WebAuthn] Got credentials:', data.credentials);

    return {
      success: true,
      credentials: data.credentials,
    };

  } catch (error) {
    console.error('[WebAuthn] Get credentials error:', error);
    return {
      success: false,
      error: translateErrorMessage(error.message),
    };
  }
}

/**
 * 認証情報を削除
 *
 * @param {string} userId - ユーザーID (UUID)
 * @param {string} credentialId - 認証情報ID (UUID)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function deleteCredential(userId, credentialId) {
  try {
    console.log('[WebAuthn] Deleting credential:', credentialId);

    const response = await fetch(`/api/v1/webauthn/credentials/${encodeURIComponent(credentialId)}?userId=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || '認証情報の削除に失敗しました');
    }

    console.log('[WebAuthn] Credential deleted');

    return { success: true };

  } catch (error) {
    console.error('[WebAuthn] Delete credential error:', error);
    return {
      success: false,
      error: translateErrorMessage(error.message),
    };
  }
}

/**
 * 認証情報名を更新
 *
 * @param {string} userId - ユーザーID (UUID)
 * @param {string} credentialId - 認証情報ID (UUID)
 * @param {string} name - 新しいデバイス名
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function updateCredentialName(userId, credentialId, name) {
  try {
    console.log('[WebAuthn] Updating credential name:', credentialId, name);

    const response = await fetch(`/api/v1/webauthn/credentials/${encodeURIComponent(credentialId)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, name }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || '認証情報名の更新に失敗しました');
    }

    console.log('[WebAuthn] Credential name updated');

    return { success: true };

  } catch (error) {
    console.error('[WebAuthn] Update credential name error:', error);
    return {
      success: false,
      error: translateErrorMessage(error.message),
    };
  }
}
