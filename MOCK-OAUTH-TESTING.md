# モックOAuthサーバー（開発/テスト専用）

**⚠️ 警告: 本番環境では使用しないでください**

## 概要

開発・テスト目的でGoogle OAuthをシミュレートする方法です。

## 簡易モックサーバー実装

```typescript
// src/dev/mock-oauth-server.ts
import express from 'express';

const app = express();
const PORT = 3001;

// 偽の認証エンドポイント
app.get('/oauth2/v2/auth', (req, res) => {
  const { redirect_uri, state } = req.query;
  // 自動的に認証成功として扱う
  res.redirect(`${redirect_uri}?code=mock-auth-code&state=${state}`);
});

// 偽のトークンエンドポイント
app.post('/oauth2/v2/token', (req, res) => {
  res.json({
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
    token_type: 'Bearer'
  });
});

// 偽のユーザー情報エンドポイント
app.get('/oauth2/v3/userinfo', (req, res) => {
  res.json({
    sub: 'mock-user-123',
    email: 'test@example.com',
    email_verified: true,
    name: 'Mock User',
    picture: 'https://example.com/avatar.jpg'
  });
});

app.listen(PORT, () => {
  console.log(`Mock OAuth server running on http://localhost:${PORT}`);
});
```

## 制限事項

- **開発専用**: 実際のGoogleアカウントでログインできません
- **セキュリティなし**: PKCE検証などをスキップ
- **テストデータ**: 常に同じユーザー情報を返します

## 推奨事項

本番環境やデモには、実際のOAuthプロバイダー（GitHub、Microsoft等）を使用してください。
