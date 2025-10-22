# Google OAuth 認証セットアップガイド

このガイドでは、実装したGoogle OAuth認証機能を実際に動作させる手順を説明します。

## 📋 前提条件

- Googleアカウント
- Google Cloud Consoleへのアクセス
- 実装済みのOAuth Strategy（本プロジェクト）

---

## 🔧 Step 1: Google Cloud Consoleでプロジェクト作成

### 1-1. Google Cloud Consoleにアクセス
https://console.cloud.google.com/

### 1-2. 新規プロジェクト作成
1. 左上のプロジェクト選択ドロップダウンをクリック
2. 「新しいプロジェクト」をクリック
3. プロジェクト名を入力（例: `my-auth-app`）
4. 「作成」をクリック

### 1-3. OAuth同意画面の設定
1. 左メニュー「APIとサービス」→「OAuth同意画面」を選択
2. **User Type**: 「外部」を選択（個人開発の場合）
3. 「作成」をクリック

**OAuth同意画面情報を入力**:
- **アプリ名**: `My Auth App` （任意の名前）
- **ユーザーサポートメール**: 自分のGmailアドレス
- **デベロッパーの連絡先情報**: 自分のGmailアドレス
- 「保存して次へ」をクリック

**スコープの追加**:
- 「スコープを追加または削除」をクリック
- 以下のスコープを選択:
  - `openid`
  - `https://www.googleapis.com/auth/userinfo.email`
  - `https://www.googleapis.com/auth/userinfo.profile`
- 「更新」→「保存して次へ」

**テストユーザーの追加**（開発中のみ）:
- 「ADD USERS」をクリック
- 自分のGmailアドレスを追加
- 「保存して次へ」

「概要」画面で「ダッシュボードに戻る」をクリック

### 1-4. OAuth 2.0 認証情報の作成
1. 左メニュー「認証情報」をクリック
2. 上部の「認証情報を作成」→「OAuth クライアントID」を選択

**アプリケーションの種類**: 「ウェブアプリケーション」を選択

**名前**: `Web Client` （任意の名前）

**承認済みのリダイレクトURI**に以下を追加:
```
http://localhost:3000/api/v1/auth/oauth/google/callback
```

「作成」をクリック

### 1-5. クライアントIDとシークレットをコピー
ポップアップに表示される以下をコピーして保存:
- **クライアントID**: `123456789-abcdefg.apps.googleusercontent.com`
- **クライアントシークレット**: `GOCSPX-xxxxxxxxxxxxx`

⚠️ **重要**: これらの情報は外部に公開しないでください

---

## 🔐 Step 2: 環境変数の設定

プロジェクトの `.env` ファイルを編集します:

```bash
cd /data/data/com.termux/files/home/cc-sdd-test
nano .env
```

以下の行を**実際の値に置き換え**てください:

```bash
# OAuth - Google
GOOGLE_CLIENT_ID=あなたのクライアントID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=あなたのクライアントシークレット
GOOGLE_CALLBACK_URL=http://localhost:3000/api/v1/auth/oauth/google/callback
```

保存して閉じます（Ctrl+O → Enter → Ctrl+X）

---

## 🚀 Step 3: OAuth APIエンドポイントの実装

以下のコマンドで自動的にAPIエンドポイントが実装されます:

```bash
# OAuth controller実装スクリプトを実行（次のステップで実装）
npm run setup:oauth
```

実装されるエンドポイント:
- `GET /api/v1/auth/oauth/google/login` - Google認証開始
- `GET /api/v1/auth/oauth/google/callback` - Googleからのコールバック
- `GET /api/v1/auth/me` - ログイン中のユーザー情報取得
- `POST /api/v1/auth/logout` - ログアウト

---

## 🧪 Step 4: 動作確認

### 4-1. サーバー起動

```bash
# PostgreSQLとRedisが起動していることを確認
redis-cli ping  # PONG が返ればOK
psql -U auth_user -d auth_db -c "SELECT 1"  # 1 が返ればOK

# 開発サーバー起動
npm run dev
```

### 4-2. ブラウザでテスト

以下のURLにアクセス:
```
http://localhost:3000/api/v1/auth/oauth/google/login
```

**期待される動作**:
1. Googleのログイン画面にリダイレクト
2. Googleアカウントでログイン
3. アプリへのアクセス許可画面が表示
4. 「許可」をクリック
5. コールバックURLに戻り、ユーザー情報が表示される

### 4-3. cURLでテスト（ヘッドレス）

```bash
# Step 1: 認証URLを取得
curl -v http://localhost:3000/api/v1/auth/oauth/google/login

# Locationヘッダーに表示されるURLをブラウザで開く
# → Googleログイン → 許可 → コールバックURL取得

# Step 2: コールバックURLのcodeとstateパラメータを使って手動でコールバック
curl "http://localhost:3000/api/v1/auth/oauth/google/callback?code=<取得したcode>&state=<取得したstate>" \
  -H "Cookie: csrf_state=<ステップ1で取得したcookie>"
```

### 4-4. ユーザー情報確認

```bash
# セッションCookieを使ってログイン状態確認
curl http://localhost:3000/api/v1/auth/me \
  -H "Cookie: session_id=<ログイン時に取得したセッションID>"
```

---

## 🔍 トラブルシューティング

### エラー: "redirect_uri_mismatch"
**原因**: Google Cloud Consoleで設定したリダイレクトURIと実際のURIが一致しない

**解決策**:
1. Google Cloud Console → 認証情報 → OAuth 2.0 クライアントID
2. 承認済みのリダイレクトURIを確認
3. 完全一致していることを確認（末尾の`/`も含めて）

### エラー: "Access blocked: This app's request is invalid"
**原因**: OAuth同意画面の設定が不完全

**解決策**:
1. OAuth同意画面 → 公開ステータスが「テスト中」になっているか確認
2. テストユーザーに自分のGmailアドレスが追加されているか確認

### エラー: "invalid_grant"
**原因**: 認証コードの有効期限切れ（10分）

**解決策**:
- 認証フローを最初からやり直す
- コード取得からコールバックまでの時間を短縮

### データベース接続エラー
**原因**: PostgreSQL/Redisが起動していない

**解決策**:
```bash
# PostgreSQL起動確認
pg_ctl -D $PREFIX/var/lib/postgresql status

# 起動していない場合
pg_ctl -D $PREFIX/var/lib/postgresql -l logfile start

# Redis起動確認
redis-cli ping

# 起動していない場合
redis-server --daemonize yes --ignore-warnings ARM64-COW-BUG
```

---

## 📊 データベース確認

ログインに成功したら、データベースを確認:

```bash
psql -U auth_user -d auth_db

# ユーザー一覧
SELECT id, email, name, email_verified FROM users;

# OAuth接続一覧
SELECT user_id, provider, provider_id, created_at FROM oauth_connections;

# 終了
\q
```

---

## 🔐 セキュリティ上の注意

### 開発環境（localhost）
- ✅ HTTPでも動作（Cookieの`Secure`属性がfalse）
- ✅ 自己署名証明書不要

### 本番環境
- ⚠️ **必ずHTTPS化が必要**
- ⚠️ `NODE_ENV=production` を設定
- ⚠️ セッションシークレット・暗号化キーを安全に管理
- ⚠️ Google Cloud Consoleで本番用のリダイレクトURIを追加

---

## 📚 参考リンク

- [Google OAuth 2.0 公式ドキュメント](https://developers.google.com/identity/protocols/oauth2)
- [Google Cloud Console](https://console.cloud.google.com/)
- [OAuth 2.0 RFC 6749](https://datatracker.ietf.org/doc/html/rfc6749)
- [PKCE RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636)

---

## 🎯 次のステップ

Google認証が動作したら:
1. GitHub OAuth認証も同様に設定（GitHub Developer Settings）
2. Microsoft認証の実装（Azure AD）
3. 2要素認証（TOTP）の追加
4. WebAuthn/FIDO2認証の追加

実装状況:
- ✅ Google OAuth Strategy
- ✅ GitHub OAuth Strategy
- ⏳ Microsoft OAuth Strategy
- ⏳ 2FA (TOTP)
- ⏳ WebAuthn (FIDO2)
