# Implementation Plan

## Overview
本実装計画は、OAuth 2.0 + PKCEおよびTOTPベースの2要素認証を実装し、セキュアなユーザー認証システムを構築します。すべてのタスクは要件定義と技術設計に基づいて段階的に実装されます。

---

- [ ] 1. プロジェクト基盤とインフラストラクチャのセットアップ
  - TypeScript 5.x strict modeでプロジェクトを初期化
  - Express.js 4.xサーバーを設定し、基本的なミドルウェア（CORS、ヘルメット、レート制限）を統合
  - PostgreSQL 14+データベース接続を確立し、マイグレーションツールを設定
  - Redis 7.xクラスタへの接続を設定し、セッションストア機能を検証
  - 環境変数管理（dotenv）と設定ファイル構造を構築
  - ロギング基盤（Winston/Pino）とエラートラッキング（Sentry統合）を実装
  - _Requirements: すべての要件に対する基盤が必要_

- [ ] 2. データベーススキーマとリポジトリ層の実装
- [ ] 2.1 PostgreSQLスキーマとテーブルを作成
  - usersテーブルを作成（id、email、name、picture、account_status、failed_login_attempts、locked_until）
  - oauth_connectionsテーブルを作成（provider、provider_id、connected_at、last_used_at、user_id外部キー）
  - two_factor_credentialsテーブルを作成（user_id主キー、secret_encrypted、recovery_codes_hashed、version）
  - audit_logsテーブルを作成（timestamp、user_id、event_type、ip_address、metadata、result）
  - 必要なインデックスを作成（email、provider + provider_id、timestamp DESC）
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.4_

- [ ] 2.2 UserRepositoryを実装
  - OAuth情報でユーザーを検索または自動作成する機能
  - ユーザーIDおよびEmailでの検索機能
  - ユーザー情報の更新機能（楽観的ロックを含む）
  - 2FA設定の更新機能（暗号化されたsecret、ハッシュ化されたrecovery codes）
  - OAuth接続の追加と更新機能
  - _Requirements: 1.2, 1.3, 2.1, 2.2, 2.5_

- [ ] 3. 暗号化とセキュリティユーティリティの実装
- [ ] 3.1 暗号化サービスを構築
  - AES-256-GCMでTOTP secretsを暗号化/復号化する機能
  - bcrypt（強度14）でリカバリーコードをハッシュ化/検証する機能
  - 暗号学的に安全なランダム文字列生成機能（セッションID、リカバリーコード用）
  - PKCE code_verifierの生成とcode_challengeのSHA256計算機能
  - _Requirements: 2.1, 2.5, 3.5_

- [ ] 3.2 セキュリティミドルウェアを実装
  - レート制限ミドルウェア（10 req/min per IP、エンドポイントごとに調整可能）
  - CSRF保護（stateパラメータ検証）
  - HTTPOnlyとSecure、SameSite=Lax属性でCookieを設定する機能
  - HTTPS強制とHSTSヘッダー設定
  - CSP（Content Security Policy）ヘッダー設定
  - _Requirements: 1.5, 3.1, 3.5, 4.2_

- [ ] 4. OAuthアダプターの実装
- [ ] 4.1 OAuth Strategy抽象層を構築
  - OAuthStrategyインターフェースを定義（buildAuthUrl、exchangeCode、getUserProfile、refreshToken）
  - Strategy Registryを実装し、プロバイダーごとにStrategyを登録/取得
  - PKCE対応の認証URL生成機能（code_challenge、state、scope、redirect_uri）
  - 認証コードをアクセストークンとリフレッシュトークンに交換する機能
  - _Requirements: 1.1, 1.2, 1.4, 5.1, 5.2_

- [ ] 4.2 Google OAuthStrategyを実装
  - Google OAuth 2.0エンドポイントへの認証URL生成
  - トークン交換リクエスト（client_id、client_secret、code_verifier使用）
  - userinfo エンドポイントからプロファイル取得（email、name、picture）
  - リフレッシュトークンを使用したアクセストークン更新機能
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 5.1_

- [ ] 4.3 GitHub OAuthStrategyを実装
  - GitHub OAuth認証URL生成（scopeに user:email を含める）
  - トークン交換とPKCE検証
  - GitHub APIからユーザープロファイル取得（login、email、name、avatar_url）
  - Email検証状態の確認（primary email）
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 5.1_

- [ ] 4.4 Microsoft OAuthStrategyを実装
  - Microsoft Identity Platform認証URL生成（common テナント使用）
  - OpenID Connect対応のトークン交換
  - Microsoft Graph APIからユーザープロファイル取得（id、mail、displayName、photo）
  - id_tokenの検証とクレーム抽出
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 5.1_

- [ ] 5. 2要素認証（2FA）サービスの実装
- [ ] 5.1 TOTPコア機能を実装
  - otpauthライブラリを統合し、TOTPインスタンス生成機能を構築
  - Base32エンコードされたsecretキーをランダム生成
  - 6桁TOTPコード生成機能（30秒ウィンドウ）
  - TOTPコード検証機能（±1ウィンドウ許容、時刻ずれ対応）
  - otpauth:// URI生成機能（QRコード用）
  - _Requirements: 2.1, 2.2_

- [ ] 5.2 2FA enrollmentフローを実装
  - ユーザーの2FA enrollment開始処理（secret生成、QRコードURL作成）
  - Enrollment検証処理（ユーザー入力コードの検証）
  - 検証成功時のrecovery code生成（8個の10桁英数字）
  - 暗号化されたsecretとハッシュ化されたrecovery codesをDBに保存
  - enrollment失敗時のロールバック処理
  - _Requirements: 2.1, 2.5_

- [ ] 5.3 ログイン時の2FA検証を実装
  - TOTP検証機能（失敗試行カウントの追跡）
  - リカバリーコード検証機能（使用済みコードの無効化）
  - 3回連続失敗時のアカウントロック機能（15分間、lockedUntilをセット）
  - アカウントロック解除の自動処理（時刻ベース）
  - 失敗試行のリセット機能（成功時）
  - _Requirements: 2.2, 2.3, 2.4_

- [ ] 5.4 2FA管理機能を実装
  - 2FA無効化機能（パスワード再確認は将来拡張として保留）
  - リカバリーコード再生成機能（古いコードの無効化）
  - 2FA設定状態の確認機能
  - _Requirements: 2.1, 2.5_

- [ ] 5.5 WebAuthn (FIDO2) 認証機能を実装
  - @simplewebauthn/serverライブラリを統合
  - 認証器登録開始機能（チャレンジ生成、RegistrationOptions作成）
  - 認証器登録検証機能（公開鍵検証、credential保存）
  - 認証開始機能（チャレンジ生成、AuthenticationOptions作成）
  - 認証検証機能（署名検証、カウンター検証、リプレイ攻撃防止）
  - 認証器一覧取得・削除・名前更新機能
  - Redis Challenge一時保存機能（TTL 5分）
  - WebAuthnCredentialRepositoryの実装（CRUD操作）
  - 最大5台デバイス制限の実装
  - TOTPとの併用可能な設計
  - 重複登録防止機能（409 Conflict、登録済みデバイス数表示、管理ページ誘導）
  - Discoverable Credentials（パスワードレス認証、userHandle自動抽出）
  - Dual Parameter Support（userEmail | userId の両方をAPIで受付）
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 6.12_

- [ ] 6. セッション管理サービスの実装
- [ ] 6.1 Redisセッションストアを構築
  - Redisクライアント（ioredis）接続とクラスタ設定
  - セッション作成機能（UUIDセッションID生成、Redis保存、7日TTL設定）
  - セッション検証機能（Redis検索、有効期限確認）
  - セッションリフレッシュ機能（最終アクセス時刻更新、TTL延長）
  - セッション破棄機能（Redis削除）
  - _Requirements: 3.1, 3.2, 3.4_

- [ ] 6.2 マルチデバイスセッション管理を実装
  - ユーザーの全セッション一覧取得機能（user:sessions:{userId} SET使用）
  - 現在のセッション以外をすべて破棄する機能
  - 新規ログイン時の既存セッション確認と選択的無効化
  - デバイス情報（User-Agent、IPアドレス）の記録と表示
  - _Requirements: 3.3_

- [ ] 6.3 HTTPOnly Cookieの生成と管理を実装
  - セッションCookie生成機能（HTTPOnly、Secure、SameSite=Lax属性）
  - Cookie名の設定（例: auth_session）
  - Cookie有効期限の設定（7日間）
  - Cookie削除機能（ログアウト時）
  - _Requirements: 3.1, 3.5_

- [ ] 7. 認証サービスのオーケストレーション実装
- [ ] 7.1 OAuth認証フロー開始を実装
  - OAuth認証URL生成リクエストの処理（provider、code_challenge、redirect_uri受け取り）
  - stateパラメータ生成とセッションへの保存（CSRF対策）
  - OAuthAdapterへの委譲とリダイレクトURL返却
  - _Requirements: 1.1, 1.5_

- [ ] 7.2 OAuthコールバック処理を実装
  - OAuthプロバイダーからのコールバック受信（auth_code、state受け取り）
  - stateパラメータの検証（セッションとの一致確認、CSRF防御）
  - code_verifier検証とトークン交換
  - ユーザープロファイル取得とUserRepository統合（findOrCreate）
  - 2FA有効性チェックと分岐処理（2FA有効なら一時セッション、無効なら完全セッション）
  - _Requirements: 1.2, 1.3, 1.5, 2.3_

- [ ] 7.3 2FA検証後の認証完了処理を実装
  - 一時セッショントークンの検証
  - 2FA検証結果の確認（TwoFAService統合）
  - 完全なセッション作成とHTTPOnly Cookie発行
  - 監査ログへの記録（成功/失敗イベント）
  - _Requirements: 2.2, 2.3, 3.1, 4.1_

- [ ] 7.4 セッション検証ミドルウェアを実装
  - すべての保護されたルートでセッションCookieを検証
  - SessionServiceへの委譲とユーザー情報の取得
  - セッション有効期限の確認と自動リフレッシュ（15分ごと）
  - 無効セッションの処理（401 Unauthorized返却）
  - リクエストコンテキストへのユーザー情報の注入
  - _Requirements: 3.2_

- [ ] 7.5 ログアウト処理を実装
  - セッションCookie取得と検証
  - SessionServiceへのセッション破棄要求
  - Cookie削除レスポンス
  - 監査ログへのログアウトイベント記録
  - _Requirements: 3.4, 4.4_

- [ ] 8. API エンドポイントの実装
- [ ] 8.1 OAuth認証エンドポイントを実装
  - POST /api/v1/auth/oauth/init エンドポイント（認証URL生成）
  - GET /api/v1/auth/oauth/{provider}/callback エンドポイント（コールバック処理）
  - リクエストバリデーション（code_challenge形式、provider値の検証）
  - エラーハンドリングと適切なHTTPステータスコード返却
  - _Requirements: 1.1, 1.2, 4.1_

- [ ] 8.2 2FA管理エンドポイントを実装
  - POST /api/v1/2fa/enroll エンドポイント（2FA設定開始、QRコード返却）
  - POST /api/v1/2fa/enroll/verify エンドポイント（enrollment検証、recovery codes返却）
  - POST /api/v1/2fa/verify エンドポイント（ログイン時の2FA検証）
  - POST /api/v1/2fa/disable エンドポイント（2FA無効化）
  - POST /api/v1/2fa/recovery-codes/regenerate エンドポイント（リカバリーコード再生成）
  - GET /api/v1/2fa/status エンドポイント（2FA設定状態確認）
  - _Requirements: 2.1, 2.2, 2.4, 2.5_

- [ ] 8.3 セッション管理エンドポイントを実装
  - GET /api/v1/sessions エンドポイント（ユーザーの全セッション一覧）
  - DELETE /api/v1/sessions/{sessionId} エンドポイント（特定セッション削除）
  - DELETE /api/v1/sessions/others エンドポイント（現在以外のセッション削除）
  - POST /api/v1/auth/logout エンドポイント（ログアウト）
  - _Requirements: 3.3, 3.4_

- [ ] 8.4 ユーザープロファイルエンドポイントを実装
  - GET /api/v1/users/me エンドポイント（現在のユーザー情報取得）
  - PATCH /api/v1/users/me エンドポイント（プロファイル更新）
  - GET /api/v1/users/me/oauth-connections エンドポイント（OAuth接続一覧）
  - DELETE /api/v1/users/me エンドポイント（アカウント削除、GDPR対応）
  - _Requirements: 1.3, 5.1_

- [ ] 9. エラーハンドリングとロギングの実装
- [ ] 9.1 エラーレスポンス標準化を実装
  - ErrorResponseフォーマット定義（code、message、details、requestId、timestamp）
  - 集約エラーハンドラーミドルウェア（すべての例外をキャッチ）
  - HTTPステータスコードマッピング（4xx、5xx）
  - ユーザーフレンドリーなエラーメッセージ生成（センシティブ情報の除外）
  - _Requirements: 4.1, 4.5_

- [ ] 9.2 監査ログシステムを実装
  - audit_logsテーブルへのイベント記録機能
  - ログイベントタイプの定義（oauth_login_success、2fa_failure、session_created等）
  - タイムスタンプ、ユーザーID、IPアドレス、User-Agent、結果（success/failure/error）の記録
  - メタデータのJSON形式での保存（プロバイダー情報、エラー詳細等）
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 9.3 セキュリティアラートシステムを実装
  - 不正ログイン試行の検知（3回連続失敗、異常なIPアドレス等）
  - リアルタイムアラート送信機能（Email、Slack、PagerDuty統合）
  - アラート閾値設定（10分間に5回失敗等）
  - アラート重複排除機能（同一ユーザー/IPで重複通知を防ぐ）
  - _Requirements: 4.3_

- [ ] 10. ヘルスチェックとモニタリングの実装
- [ ] 10.1 ヘルスチェックエンドポイントを実装
  - GET /health エンドポイント（全体的なヘルスステータス）
  - PostgreSQL接続確認（簡単なクエリ実行）
  - Redis接続確認（PINGコマンド）
  - OAuthプロバイダー疎通確認（オプション、軽量リクエスト）
  - ヘルスチェック結果のJSON形式返却（status、checks配列）
  - _Requirements: 4.1_

- [ ] 10.2 Prometheusメトリクス収集を実装
  - メトリクス収集ミドルウェア（prom-clientライブラリ使用）
  - 認証成功率メトリクス（oauth_login_success_total、oauth_login_failure_total）
  - 平均応答時間メトリクス（http_request_duration_seconds）
  - アクティブセッション数メトリクス（active_sessions_count）
  - 2FA検証成功率メトリクス（2fa_verification_success_total、2fa_verification_failure_total）
  - GET /metrics エンドポイント（Prometheus scrape用）
  - _Requirements: モニタリング要件（非機能要件）_

- [ ] 11. 単体テストの実装
- [ ] 11.1 OAuthAdapter単体テストを作成
  - exchangeAuthCode 正常系テスト（モックプロバイダーAPI）
  - exchangeAuthCode 異常系テスト（無効code_verifier、プロバイダーエラー）
  - fetchUserProfile 正常系/異常系テスト
  - refreshAccessToken 正常系/異常系テスト
  - PKCE検証テスト（code_challenge/code_verifierの一致確認）
  - _Requirements: 1.2, 1.4_

- [ ] 11.2 TwoFAService単体テストを作成
  - verifyTOTP 正常系テスト（有効なコード検証）
  - verifyTOTP 異常系テスト（無効コード、失敗カウント、アカウントロック）
  - verifyTOTP 時刻ずれテスト（±30秒許容確認）
  - enrollTwoFactor QRコード生成テスト
  - verifyRecoveryCode 正常系/異常系テスト（使用済みコード無効化確認）
  - _Requirements: 2.2, 2.4, 2.5_

- [ ] 11.3 SessionService単体テストを作成
  - createSession 正常系テスト（Redis保存、TTL設定確認）
  - createSession 異常系テスト（Redis接続失敗）
  - validateSession 正常系/異常系テスト（有効期限切れ検出）
  - destroySession テスト（Redis削除確認）
  - listUserSessions テスト（複数セッション取得）
  - _Requirements: 3.1, 3.2, 3.4_

- [ ] 11.4 AuthService単体テストを作成
  - handleOAuthCallback 正常系テスト（新規ユーザー作成、既存ユーザーログイン）
  - handleOAuthCallback state検証テスト（CSRF検出）
  - completeTwoFactorAuth 正常系/異常系テスト
  - validateSession テスト
  - 2FA分岐ロジックテスト（2FA有効/無効の処理確認）
  - _Requirements: 1.2, 1.3, 1.5, 2.3_

- [ ] 11.5 暗号化とセキュリティユーティリティのテスト
  - AES-256-GCM暗号化/復号化テスト
  - bcryptハッシュ化/検証テスト
  - PKCEパラメータ生成テスト（SHA256計算確認）
  - セッションID生成テスト（暗号学的ランダム性確認）
  - _Requirements: 2.1, 2.5, 3.5_

- [ ] 12. 統合テストの実装
- [ ] 12.1 OAuth + 2FA フルフローテストを作成
  - シナリオ: OAuthログイン → 2FA検証 → セッション作成
  - 各ステップでのDB状態確認（user作成、oauth_connection作成、セッション作成）
  - Cookie発行確認（HTTPOnly、Secure属性）
  - 監査ログ記録確認
  - _Requirements: 1.1, 1.2, 1.3, 2.3, 3.1_

- [ ] 12.2 マルチプロバイダーOAuthテストを作成
  - Google、GitHub、Microsoftの3プロバイダーでログイン試行
  - プロバイダーごとのプロファイル正規化確認
  - 同一Emailでの複数プロバイダー接続テスト
  - _Requirements: 5.1, 5.3_

- [ ] 12.3 セッション管理統合テストを作成
  - ログイン → セッション検証 → ログアウトフロー
  - セッションリフレッシュテスト（15分ごとの更新確認）
  - マルチデバイスセッション管理テスト（他デバイスログアウト）
  - _Requirements: 3.2, 3.3, 3.4_

- [ ] 12.4 アカウントロックアウトテストを作成
  - 3回連続TOTP失敗 → アカウントロック → 15分後解除
  - ロック状態のDB反映確認（locked_until設定）
  - ロック中のログイン試行拒否確認
  - 自動解除後のログイン成功確認
  - _Requirements: 2.4_

- [ ] 12.5 トークンリフレッシュテストを作成
  - Access Token期限切れシミュレーション → Refresh Token使用 → 新規Access Token取得
  - OAuthプロバイダーとの通信確認
  - トークン更新後の認証継続確認
  - _Requirements: 1.4_

- [ ] 13. E2Eテストの実装
- [ ] 13.1 初回ログイン + 2FA設定E2Eテストを作成
  - ブラウザ自動化（Playwright/Puppeteer）でOAuth選択 → 承認 → ダッシュボード遷移
  - 2FA有効化ボタンクリック → QRコード表示確認
  - TOTPコード入力 → リカバリーコードダウンロード確認
  - _Requirements: 1.1, 2.1, 2.5_

- [ ] 13.2 2FA有効ユーザーログインE2Eテストを作成
  - OAuthログイン → 2FAプロンプト表示確認
  - 無効なコード入力 → エラーメッセージ確認
  - 有効なコード入力 → ダッシュボード遷移
  - 2FAスキップ不可の確認
  - _Requirements: 2.2, 2.3_

- [ ] 13.3 リカバリーコード使用E2Eテストを作成
  - ログイン → 2FAプロンプト → "Use recovery code"リンククリック
  - リカバリーコード入力 → ログイン成功
  - 使用済みコードの再利用不可確認
  - _Requirements: 2.5_

- [ ] 13.4 セッション管理画面E2Eテストを作成
  - 設定画面へ遷移 → アクティブセッション一覧表示
  - デバイス情報（User-Agent、IPアドレス）確認
  - 個別セッションログアウトボタンクリック → セッション削除確認
  - _Requirements: 3.3_

- [ ] 13.5 エラーハンドリングE2Eテストを作成
  - 無効なTOTPコード3回入力 → アカウントロック通知表示
  - OAuth承認キャンセル → エラーメッセージ表示
  - ネットワークエラーシミュレーション → 適切なエラー処理確認
  - _Requirements: 4.1, 2.4_

- [ ] 14. パフォーマンステストの実装
- [ ] 14.1 同時ログイン負荷テストを作成
  - Apache JMeter/k6で1,000ユーザー同時OAuthログインシミュレーション
  - 平均応答時間 < 2秒の確認
  - エラーレート < 1%の確認
  - データベース接続プール枯渇の監視
  - _Requirements: 非機能要件（Performance）_

- [ ] 14.2 セッション検証スループットテストを作成
  - 10,000 req/secのセッション検証リクエスト負荷
  - P95レイテンシ < 100msの確認
  - Redis CPU使用率 < 70%の確認
  - _Requirements: 非機能要件（Performance）_

- [ ] 14.3 2FA検証レートテストを作成
  - 500 req/secのTOTP検証リクエスト
  - P99レイテンシ < 200msの確認
  - データベース接続プールの枯渇がないことを確認
  - _Requirements: 非機能要件（Performance）_

- [ ] 14.4 トークンリフレッシュパフォーマンステストを作成
  - 100 req/secのトークンリフレッシュリクエスト
  - OAuthプロバイダーレート制限内での動作確認
  - 平均応答時間 < 1秒の確認
  - _Requirements: 非機能要件（Performance）_

- [ ] 15. セキュリティ強化と最終統合
- [ ] 15.1 CSRFとXSS対策を強化
  - すべてのOAuthフローでstateパラメータ検証確認
  - HTTPOnly Cookie属性の全エンドポイントでの適用確認
  - CSPヘッダー設定確認（script-src、connect-src制限）
  - _Requirements: 1.5, 3.1, 3.5_

- [ ] 15.2 レート制限とブルートフォース対策を統合
  - IPベースレート制限（10 req/min）の全認証エンドポイントへの適用
  - アカウントロックアウト機能の統合確認
  - CAPTCHAフォールバック機構の準備（将来拡張）
  - _Requirements: 2.4, 非機能要件（Security）_

- [ ] 15.3 HTTPS/TLS設定とHSTS実装
  - TLS 1.3の強制設定（Nginx/Load Balancer）
  - HSTSヘッダーの設定（max-age=31536000、includeSubDomains）
  - すべてのHTTPトラフィックのHTTPSへのリダイレクト
  - _Requirements: 3.5, 非機能要件（Security）_

- [ ] 15.4 GDPR準拠機能の統合
  - ユーザーデータエクスポートエンドポイント（GET /api/v1/users/me/export）
  - アカウント削除時のカスケード削除確認（users → oauth_connections → two_factor_credentials → sessions → audit_logs匿名化）
  - 監査ログの90日保持ポリシー実装（自動削除ジョブ）
  - _Requirements: 非機能要件（Compliance）_

---

## Requirements Coverage Summary

すべての要件が実装タスクにマッピングされています：

**Requirement 1 (OAuth 2.0認証)**: タスク 4.1-4.4, 7.1-7.2, 8.1, 11.1, 11.4, 12.1-12.2, 13.1
**Requirement 2 (2要素認証)**: タスク 5.1-5.4, 7.3, 8.2, 11.2, 11.4, 12.1, 12.4, 13.1-13.3
**Requirement 3 (セッション管理とセキュリティ)**: タスク 6.1-6.3, 7.4-7.5, 8.3, 11.3, 12.3, 13.4, 15.1, 15.3
**Requirement 4 (エラーハンドリングとロギング)**: タスク 9.1-9.3, 10.1-10.2, 13.5
**Requirement 5 (対応プロバイダーと互換性)**: タスク 4.1-4.4, 8.4, 12.2
**非機能要件 (Performance, Security, Compliance)**: タスク 10.2, 14.1-14.4, 15.2-15.4

合計: 15大タスク、60+サブタスク
