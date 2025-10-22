# OAuth プロバイダー

このプロジェクトで利用可能なOAuthプロバイダーの一覧です。

## ✅ 利用可能なプロバイダー

### 1. GitHub OAuth

**ステータス**: 有効  
**必要なアカウント**: GitHubアカウント（無料）  
**設定の難易度**: ⭐ 簡単  

**セットアップ手順**:
1. https://github.com/settings/developers にアクセス
2. "New OAuth App" をクリック
3. 以下を入力:
   - Homepage URL: `http://localhost:3000`
   - Callback URL: `http://localhost:3000/api/v1/auth/oauth/github/callback`
4. クライアントIDとシークレットを`.env`に設定

**エンドポイント**:
- ログイン: `GET /api/v1/auth/oauth/github/login`
- コールバック: `GET /api/v1/auth/oauth/github/callback`

---

### 2. Microsoft OAuth

**ステータス**: 有効  
**必要なアカウント**: Microsoftアカウント（無料）  
**設定の難易度**: ⭐⭐ 普通  

**セットアップ手順**:
1. https://portal.azure.com にアクセス
2. Azure Active Directoryでアプリを登録
3. リダイレクトURI: `http://localhost:3000/api/v1/auth/oauth/microsoft/callback`
4. クライアントIDとシークレットを`.env`に設定

**エンドポイント**:
- ログイン: `GET /api/v1/auth/oauth/microsoft/login`
- コールバック: `GET /api/v1/auth/oauth/microsoft/callback`

**テナント設定**:
- `common`: 個人・組織両方のアカウント（デフォルト）
- `organizations`: 組織アカウントのみ
- `consumers`: 個人アカウントのみ

---

## ❌ 無効化されたプロバイダー

### Google OAuth (アーカイブ済み)

**ステータス**: 無効（`.archive/google-oauth/`に移動）  
**理由**: GCP（Google Cloud Platform）アカウントが動作確認に必須のため  
**再有効化**: `.archive/google-oauth/README.md`を参照  

---

## 推奨プロバイダー

テストや開発には**GitHub OAuth**をお勧めします：

✅ 設定が最も簡単  
✅ 開発者なら既にアカウントを持っている  
✅ 5分で動作確認可能  

---

## 環境変数設定例

```bash
# GitHub OAuth (推奨)
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_CALLBACK_URL=http://localhost:3000/api/v1/auth/oauth/github/callback

# Microsoft OAuth
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
MICROSOFT_CALLBACK_URL=http://localhost:3000/api/v1/auth/oauth/microsoft/callback
MICROSOFT_TENANT=common
```

---

## 実装状況

| プロバイダー | Strategy実装 | テスト | サーバー統合 | ステータス |
|------------|------------|--------|------------|-----------|
| GitHub     | ✅         | ✅ 8/8  | ✅         | 有効      |
| Microsoft  | ✅         | ✅ 15/15| ✅         | 有効      |
| Google     | ✅         | ✅ 11/11| ⚠️ 無効   | アーカイブ |

---

最終更新: 2025-10-21
