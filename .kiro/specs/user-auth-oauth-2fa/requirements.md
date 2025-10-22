# Requirements Document

## Project Description (Input)
ユーザー認証機能をOAuthと2FAで実装

## Introduction
本仕様書は、セキュアなユーザー認証システムの要件を定義します。OAuth 2.0プロトコルによる外部プロバイダー認証と、2要素認証（2FA）によるセキュリティ強化を実装します。

## Requirements

### Requirement 1: OAuth 2.0認証
**Objective:** ユーザーとして、Google、GitHub、Microsoftなどの外部プロバイダーを使用してログインできるようにし、アカウント作成の手間を削減する

#### Acceptance Criteria
1. WHEN ユーザーがOAuthログインボタンをクリック THEN 認証システム SHALL 選択されたプロバイダーの認証ページにリダイレクトする
2. WHEN OAuthプロバイダーが認証コードを返却 THEN 認証システム SHALL アクセストークンとリフレッシュトークンを取得する
3. IF ユーザーが初回ログイン THEN 認証システム SHALL ユーザープロファイルを自動作成する
4. WHEN OAuthトークンの有効期限が切れる THEN 認証システム SHALL リフレッシュトークンを使用して自動更新する
5. WHERE セキュリティ設定で必須 THE 認証システム SHALL state パラメータを使用してCSRF攻撃を防止する

### Requirement 2: 2要素認証（2FA）
**Objective:** ユーザーとして、アカウントに2要素認証を設定できるようにし、不正アクセスからアカウントを保護する

#### Acceptance Criteria
1. WHEN ユーザーが2FA設定を有効化 THEN 認証システム SHALL TOTPシークレットキーを生成しQRコードで表示する
2. WHEN ユーザーが6桁のワンタイムコードを入力 THEN 認証システム SHALL TOTPアルゴリズムで検証する
3. IF 2FAが有効なアカウント THEN 認証システム SHALL OAuth認証後に2FAコード入力を要求する
4. WHEN ユーザーが2FA検証に3回連続で失敗 THEN 認証システム SHALL アカウントを一時的にロックし通知メールを送信する
5. WHERE 2FA設定画面 THE 認証システム SHALL バックアップリカバリーコードを生成し安全に保存するよう促す

### Requirement 3: セッション管理とセキュリティ
**Objective:** システム管理者として、ユーザーセッションを安全に管理し、セキュリティリスクを最小化する

#### Acceptance Criteria
1. WHEN ユーザーが認証成功 THEN 認証システム SHALL HTTPOnlyとSecure属性付きセッションCookieを発行する
2. WHILE ユーザーセッションがアクティブ THE 認証システム SHALL 15分ごとにセッション有効性を検証する
3. IF ユーザーが異なるデバイスからログイン THEN 認証システム SHALL 既存セッションを無効化するか確認を求める
4. WHEN ユーザーがログアウト THEN 認証システム SHALL サーバー側セッションとトークンを完全に削除する
5. WHERE 本番環境 THE 認証システム SHALL すべての認証トラフィックをTLS/HTTPS経由で暗号化する

### Requirement 4: エラーハンドリングとロギング
**Objective:** 開発者として、認証エラーを適切にハンドリングし、セキュリティインシデントを追跡できるようにする

#### Acceptance Criteria
1. WHEN OAuth認証が失敗 THEN 認証システム SHALL ユーザーフレンドリーなエラーメッセージを表示し詳細をログに記録する
2. IF 無効な2FAコードが入力される THEN 認証システム SHALL 試行回数をインクリメントしIPアドレスを記録する
3. WHEN セキュリティイベントが発生（不正ログイン試行等） THEN 認証システム SHALL リアルタイムでアラートを送信する
4. WHERE 監査ログ THE 認証システム SHALL タイムスタンプ、ユーザーID、IPアドレス、アクション種別を記録する
5. IF システムエラーが発生 THEN 認証システム SHALL センシティブ情報を含まない汎用エラーをユーザーに返す

### Requirement 5: 対応プロバイダーと互換性
**Objective:** ユーザーとして、主要なOAuthプロバイダーを使用してログインできるようにする

#### Acceptance Criteria
1. WHEN システムが起動 THEN 認証システム SHALL Google、GitHub、Microsoft OAuthプロバイダーをサポートする
2. IF 新しいプロバイダーを追加 THEN 認証システム SHALL プラグイン方式で拡張可能な設計である
3. WHERE 各プロバイダー THE 認証システム SHALL OAuth 2.0標準仕様に準拠する
4. WHEN プロバイダーのAPIバージョンが更新 THEN 認証システム SHALL 後方互換性を維持する

### Requirement 6: FIDO2/WebAuthn認証
**Objective:** ユーザーとして、生体認証（指紋、顔認証）やセキュリティキーを使用してパスワードレスでログインできるようにし、フィッシング攻撃に対する耐性を強化する

#### Acceptance Criteria
1. WHEN ユーザーがFIDO2/WebAuthn登録を開始 THEN 認証システム SHALL チャレンジを生成しブラウザのWebAuthn APIを呼び出す
2. WHEN ブラウザが認証器（指紋センサー、YubiKeyなど）の応答を返却 THEN 認証システム SHALL 公開鍵を検証しデータベースに保存する
3. IF ユーザーが複数の認証器を登録 THEN 認証システム SHALL 最大5台のデバイスを管理し識別名を付与できる
4. WHEN ユーザーがFIDO2でログイン THEN 認証システム SHALL チャレンジを生成し署名検証を実行する
5. WHERE FIDO2認証 THE 認証システム SHALL カウンター値を検証しリプレイ攻撃を防止する
6. IF ユーザーが認証器を紛失 THEN 認証システム SHALL デバイス管理画面から該当デバイスを削除できる
7. WHEN FIDO2認証が成功 THEN 認証システム SHALL TOTPと同等のセキュリティレベルとして扱う
8. WHERE セキュリティ設定 THE 認証システム SHALL FIDO2とTOTPを併用可能とし複数の2FA手段を提供する
9. IF ブラウザがWebAuthn APIをサポートしない THEN 認証システム SHALL TOTPフォールバックを提供する
10. WHEN 既に認証器を登録済みのユーザーが再登録を試行 THEN 認証システム SHALL 409 Conflictエラーを返し登録済みデバイス数と管理ページへの誘導を含む明確なエラーメッセージを表示する
11. WHERE Discoverable Credentials（パスワードレス認証）THE 認証システム SHALL メールアドレス入力なしでデバイスのResident Keyから自動的にユーザーを特定し認証を完了する
12. WHEN 認証情報管理APIを呼び出す THEN 認証システム SHALL userEmail または userId のいずれかのパラメータで認証情報の取得・更新・削除を許可する

## Non-Functional Requirements

### Performance
- WHEN 1000人の同時ユーザーがログイン試行 THEN 認証システム SHALL 平均応答時間2秒以内で処理する
- IF データベース接続が遅延 THEN 認証システム SHALL キャッシュ機構を使用してパフォーマンスを維持する

### Security
- WHERE すべての認証エンドポイント THE 認証システム SHALL レート制限（1分間に10リクエスト）を実施する
- WHEN パスワードやトークンを保存 THEN 認証システム SHALL 業界標準の暗号化アルゴリズム（AES-256、bcrypt等）を使用する

### Compliance
- IF 個人情報を取り扱う THEN 認証システム SHALL GDPR、個人情報保護法に準拠する
- WHERE ログ保存 THE 認証システム SHALL 最低90日間の監査ログを保持する
