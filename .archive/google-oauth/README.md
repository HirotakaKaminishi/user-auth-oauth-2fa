# Google OAuth - Archived

## 理由

Google OAuthは動作確認に**GCP（Google Cloud Platform）アカウント**が必須です。

GCPアカウントなしではテストできないため、実装をアーカイブしました。

## アーカイブ内容

- `google-oauth-strategy.ts` - Google OAuth 2.0 Strategy実装
- `google-oauth-strategy.test.ts` - ユニットテスト（11テスト、全て合格済み）
- `GOOGLE-OAUTH-SETUP.md` - セットアップガイド

## 再有効化する場合

将来GCPアカウントを取得した場合、以下の手順で再有効化できます：

1. ファイルを元の場所に戻す
   ```bash
   mv .archive/google-oauth/google-oauth-strategy.ts src/oauth/
   mv .archive/google-oauth/google-oauth-strategy.test.ts src/__tests__/oauth/
   mv .archive/google-oauth/GOOGLE-OAUTH-SETUP.md ./
   ```

2. `src/server.ts`でGoogleOAuthStrategyのコメントアウトを解除

3. `src/controllers/oauth-controller.ts`のgetDefaultScopesでgoogleケースを復元

4. `.env`ファイルでGoogle OAuth設定を有効化

5. `GOOGLE-OAUTH-SETUP.md`に従ってGCPで認証情報を取得

## 現在の代替策

- **GitHub OAuth**: 簡単に設定可能（推奨）
- **Microsoft OAuth**: Microsoftアカウントで設定可能

---

アーカイブ日: 2025-10-21
