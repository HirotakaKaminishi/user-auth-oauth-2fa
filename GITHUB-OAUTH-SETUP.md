# GitHub OAuth セットアップガイド（5分）

## 📋 設定手順

### 1. GitHub OAuth App作成

1. **GitHub Developer Settings**にアクセス
   https://github.com/settings/developers

2. **"OAuth Apps"** → **"New OAuth App"** をクリック

3. 以下の情報を入力:

   **Application name**
   ```
   Auth System (Local Dev)
   ```

   **Homepage URL**
   ```
   http://localhost:3000
   ```

   **Application description** (任意)
   ```
   OAuth 2.0 authentication system development
   ```

   **Authorization callback URL** ⚠️ 重要
   ```
   http://localhost:3000/api/v1/auth/oauth/github/callback
   ```

4. **"Register application"** をクリック

### 2. クライアント認証情報の取得

1. アプリ作成後、自動的に詳細ページに移動します

2. **Client ID** が表示されています → コピー

3. **"Generate a new client secret"** をクリック

4. **Client Secret** が表示されます → **すぐにコピー**
   ⚠️ このページを離れると二度と表示されません

### 3. .env ファイルの更新

プロジェクトの `.env` ファイルを開き、以下を更新:

```bash
# OAuth - GitHub
GITHUB_CLIENT_ID=（コピーしたClient ID）
GITHUB_CLIENT_SECRET=（コピーしたClient Secret）
GITHUB_CALLBACK_URL=http://localhost:3000/api/v1/auth/oauth/github/callback
```

**例**:
```bash
GITHUB_CLIENT_ID=Ov23liAbCdEfGhIjKl
GITHUB_CLIENT_SECRET=1234567890abcdef1234567890abcdef12345678
GITHUB_CALLBACK_URL=http://localhost:3000/api/v1/auth/oauth/github/callback
```

### 4. サーバー再起動

```bash
# サーバーが起動中の場合は自動リロード
# または手動で再起動:
npm run dev
```

### 5. 動作確認

1. ブラウザで以下にアクセス:
   ```
   http://localhost:3000
   ```

2. **"Login with GitHub"** ボタンをクリック

3. GitHubの認証画面が表示されます:
   - アプリの権限確認
   - **"Authorize"** をクリック

4. 成功すると、ユーザー情報が返されます:
   ```json
   {
     "success": true,
     "user": {
       "id": "...",
       "email": "your@email.com",
       "name": "Your Name",
       "emailVerified": true
     },
     "message": "Login successful"
   }
   ```

---

## 🔍 トラブルシューティング

### エラー: "The redirect_uri MUST match the registered callback URL"

**原因**: コールバックURLが一致していません

**解決策**:
1. GitHubのOAuth App設定を確認
2. コールバックURLが完全一致することを確認:
   ```
   http://localhost:3000/api/v1/auth/oauth/github/callback
   ```
3. ポート番号、スキーム（http/https）、パスが全て一致すること

### エラー: "Bad credentials"

**原因**: Client SecretまたはClient IDが間違っています

**解決策**:
1. `.env`ファイルのGITHUB_CLIENT_IDとGITHUB_CLIENT_SECRETを再確認
2. 余分なスペースや改行がないか確認
3. 必要に応じて新しいClient Secretを生成

### サーバーログで確認

```bash
# サーバー起動時に以下が表示されるはず:
✅ GitHub OAuth registered
```

表示されない場合:
- `.env`ファイルが正しく設定されているか確認
- `GITHUB_CLIENT_ID`と`GITHUB_CLIENT_SECRET`が両方設定されているか確認

---

## ✅ 確認ポイント

- [ ] GitHub OAuth Appを作成
- [ ] Client IDとClient Secretを取得
- [ ] `.env`ファイルを更新
- [ ] コールバックURLが完全一致
- [ ] サーバーログで"GitHub OAuth registered"を確認
- [ ] http://localhost:3000 でログインボタンをテスト

---

所要時間: 約5分
