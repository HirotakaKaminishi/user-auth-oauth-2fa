# User Authentication System (OAuth 2.0 + TOTP 2FA + WebAuthn)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)

セキュアなユーザー認証システム - OAuth 2.0、TOTP 2要素認証、FIDO2/WebAuthn（パスワードレス認証）を統合した包括的な認証ソリューション。

## ✨ 主要機能

### 🔐 Multi-Factor Authentication
- **OAuth 2.0**: Google、GitHub、Microsoft プロバイダー対応
- **TOTP 2FA**: Time-based One-Time Password による2要素認証
- **WebAuthn/FIDO2**: 生体認証（指紋、顔認証）、セキュリティキー対応

### 🛡️ セキュリティ
- HTTPOnly/Secure Cookie
- CSRF保護（state パラメータ）
- リプレイ攻撃防止（counter 値検証）
- レート制限
- TLS/HTTPS暗号化

### 🎯 高度な機能
- **Discoverable Credentials**: パスワードレス認証（Resident Key）
- **重複登録防止**: 409 Conflict エラー、管理ページ誘導
- **Dual Parameter Support**: userEmail | userId 両対応

## 📋 技術スタック

- **言語**: TypeScript 5.0
- **ランタイム**: Node.js 20.x
- **フレームワーク**: Express.js
- **データベース**: PostgreSQL 16
- **キャッシュ**: Redis 7.x
- **認証**: @simplewebauthn/server, Passport.js
- **バリデーション**: Zod
- **テスト**: Jest

## 🚀 クイックスタート

### 前提条件

- Node.js 20.x 以上
- PostgreSQL 16 以上
- Redis 7.x 以上

### インストール

\`\`\`bash
# リポジトリのクローン
git clone https://github.com/YOUR_USERNAME/user-auth-oauth-2fa.git
cd user-auth-oauth-2fa

# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env
# .env ファイルを編集して適切な値を設定

# データベースマイグレーション
npm run migrate

# 開発サーバーの起動
npm run dev
\`\`\`

## 📚 API エンドポイント

### WebAuthn / FIDO2

| Method | Endpoint | 説明 |
|--------|----------|------|
| POST | \`/webauthn/register/start\` | 認証器登録開始 |
| POST | \`/webauthn/register/complete\` | 認証器登録完了 |
| POST | \`/webauthn/authenticate/start\` | 認証開始 |
| POST | \`/webauthn/authenticate/complete\` | 認証完了 |
| GET | \`/webauthn/credentials\` | 認証情報一覧取得 |
| DELETE | \`/webauthn/credentials/:id\` | 認証情報削除 |
| PATCH | \`/webauthn/credentials/:id\` | 認証情報名更新 |

## 📖 ドキュメント

- **[CLAUDE.md](CLAUDE.md)**: cc-sdd（Spec-Driven Development）フレームワークの詳細
- **[仕様書](.kiro/specs/user-auth-oauth-2fa/)**: 包括的な要件定義、設計書、タスク一覧

### cc-sdd (Spec-Driven Development)

このプロジェクトは **cc-sdd（Kiroフレームワーク）** を使用した仕様駆動開発で構築されています。

- **Requirements**: 12の要件定義（89行）
- **Design**: 包括的な技術設計書（1,762行）
- **Tasks**: 実装タスク一覧（426行）
- **整合性**: 100%（仕様と実装の完全一致）

## 🔒 セキュリティ

### セキュリティ機能

- ✅ HTTPOnly/Secure Cookie
- ✅ CSRF保護
- ✅ リプレイ攻撃防止（WebAuthn counter）
- ✅ レート制限（1分間10リクエスト）
- ✅ bcrypt パスワードハッシュ
- ✅ TLS/HTTPS必須（本番環境）

## 📄 ライセンス

このプロジェクトは MIT ライセンスの下で公開されています。

## 🙏 謝辞

- [cc-sdd (Kiro Framework)](https://github.com/gotalab/cc-sdd) - Spec-Driven Development フレームワーク
- [@simplewebauthn](https://simplewebauthn.dev/) - WebAuthn ライブラリ
- [Passport.js](http://www.passportjs.org/) - 認証ミドルウェア

---

Made with ❤️ using [cc-sdd](https://github.com/gotalab/cc-sdd) and [Claude Code](https://claude.com/claude-code)
