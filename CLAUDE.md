# AI-DLC and Spec-Driven Development

**Kiro-style Spec Driven Development implementation on AI-DLC (AI Development Life Cycle)**

✨ **Claude Code / Cursor IDE / Gemini CLI / Codex CLI / GitHub Copilot / Qwen Codeをプロトタイプからプロダクション開発プロセスへ、さらに仕様・ステアリングテンプレートの出力をチームのワークフローに合わせてカスタマイズできます。**

---

## 📦 cc-sddとは

**cc-sdd** は、主要AIコーディングエージェント向けの **AI-DLC (AI Driven Development Life Cycle) × SDD (Spec-Driven Development)** ワークフローを導入するnpmパッケージです。

### 主要特徴

- **🚀 AI-DLC手法** - 人間承認付きAIネイティブプロセス。コアパターン：AI実行、人間検証
- **📋 仕様ファースト開発** - 包括的仕様を単一情報源としてライフサイクル全体を駆動
- **⚡ 「ボルト」（スプリントではなく）** - AI-DLCで週単位のスプリントを置き換える時間・日単位の集中サイクル。70%の管理オーバーヘッドから脱却
- **🧠 永続的プロジェクトメモリ** - AIがステアリング文書を通じて全セッション間で包括的コンテキスト（アーキテクチャ、パターン、ルール、ドメイン知識）を維持
- **🛠 テンプレート柔軟性** - `.kiro/settings/templates`（steering / requirements / design / tasks）をチームのドキュメント形式に合わせてカスタマイズ可能
- **🔄 AIネイティブ+人間ゲート** - AI計画 → AI質問 → 人間検証 → AI実装（品質管理付き高速サイクル）
- **🌍 チーム対応** - 品質ゲート付き12言語対応のクロスプラットフォーム標準ワークフロー

### 提供元

- **GitHubリポジトリ:** https://github.com/gotalab/cc-sdd
- **npmパッケージ:** https://www.npmjs.com/package/cc-sdd
- **解説記事:** https://zenn.dev/gotalab/articles/3db0621ce3d6d2
- **Kiro IDE:** https://kiro.dev
- **作者:** gotalab

---

## 🚀 導入方法

### ワンコマンドインストール

```bash
# 基本インストール（デフォルト: 英語、Claude Code）
npx cc-sdd@latest

# 日本語でインストール（推奨）
npx cc-sdd@latest --lang ja

# アルファ版（大幅アップデート版 v2.0.0-alpha.2）
npx cc-sdd@next --lang ja

# Claude Code SubAgentsをインストール（@next必須）
npx cc-sdd@next --claude-agent --lang ja
```

### 言語オプション

全12言語に対応：

| 言語 | コード | 使用例 |
|------|--------|--------|
| 英語 | `en` | `npx cc-sdd@latest --lang en` |
| 日本語 | `ja` | `npx cc-sdd@latest --lang ja` |
| 繁体字中国語 | `zh-TW` | `npx cc-sdd@latest --lang zh-TW` |
| 簡体字中国語 | `zh` | `npx cc-sdd@latest --lang zh` |
| スペイン語 | `es` | `npx cc-sdd@latest --lang es` |
| ポルトガル語 | `pt` | `npx cc-sdd@latest --lang pt` |
| ドイツ語 | `de` | `npx cc-sdd@latest --lang de` |
| フランス語 | `fr` | `npx cc-sdd@latest --lang fr` |
| ロシア語 | `ru` | `npx cc-sdd@latest --lang ru` |
| イタリア語 | `it` | `npx cc-sdd@latest --lang it` |
| 韓国語 | `ko` | `npx cc-sdd@latest --lang ko` |
| アラビア語 | `ar` | `npx cc-sdd@latest --lang ar` |

### エージェントオプション

```bash
# Claude Code（デフォルト）
npx cc-sdd@latest --claude --lang ja

# Claude Code SubAgents（アルファ版）
npx cc-sdd@next --claude-agent --lang ja

# Gemini CLI
npx cc-sdd@latest --gemini --lang ja

# Cursor IDE
npx cc-sdd@latest --cursor --lang ja

# Codex CLI（アルファ版必須）
npx cc-sdd@next --codex --lang ja

# GitHub Copilot（アルファ版必須）
npx cc-sdd@next --copilot --lang ja

# Qwen Code
npx cc-sdd@latest --qwen --lang ja
```

### 安全なインストール

```bash
# ドライラン（実際にはインストールしない）
npx cc-sdd@latest --dry-run --backup

# カスタムディレクトリ
npx cc-sdd@latest --kiro-dir docs/specs --lang ja
```

---

## 📁 このプロジェクトの導入状況

✅ **このプロジェクトにはcc-sdd（Kiroフレームワーク）が導入済みです**

### 導入されているファイル構造

```
project/
├── .claude/commands/kiro/    # 11のスラッシュコマンド
│   ├── spec-init.md          # 仕様書初期化
│   ├── spec-requirements.md  # 要件定義生成
│   ├── spec-design.md        # 設計書生成
│   ├── spec-tasks.md         # タスク生成
│   ├── spec-impl.md          # 実装支援
│   ├── spec-status.md        # ステータス確認
│   ├── validate-gap.md       # ギャップ分析
│   ├── validate-design.md    # 設計検証
│   ├── validate-impl.md      # 実装検証（現在は未導入）
│   ├── steering.md           # ステアリング設定
│   └── steering-custom.md    # カスタムステアリング
│
├── .kiro/                    # Kiro仕様書・設定ディレクトリ
│   ├── settings/             # Kiro設定ファイル
│   │   └── templates/        # カスタマイズ可能なテンプレート
│   │       ├── steering/     # ステアリングテンプレート
│   │       ├── requirements/ # 要件定義テンプレート
│   │       ├── design/       # 設計書テンプレート
│   │       └── tasks/        # タスクテンプレート
│   ├── specs/                # 機能別仕様書
│   │   └── {feature-name}/   # 各機能の仕様書
│   │       ├── requirements.md  # 要件定義
│   │       ├── design.md        # 設計書
│   │       ├── tasks.md         # 実装タスク
│   │       └── spec.json        # 仕様書メタデータ
│   └── steering/             # AI指導ルール
│       ├── product.md        # プロダクト方針
│       ├── tech.md           # 技術スタック
│       └── structure.md      # プロジェクト構造
│
└── CLAUDE.md                 # このファイル（プロジェクト設定）
```

---

## 🤖 対応AIエージェント

| エージェント | 状態 | コマンド | 設定ファイル |
|-------|--------|----------|--------|
| **Claude Code** | ✅ 完全対応 | 11スラッシュコマンド | `CLAUDE.md` |
| **Claude Code SubAgents** | ✅ 完全対応（@next必須） | 12コマンド + 9サブエージェント | `CLAUDE.md`, `.claude/agents/kiro/` |
| **Gemini CLI** | ✅ 完全対応 | 11コマンド | `GEMINI.md` |
| **Cursor IDE** | ✅ 完全対応 | 11コマンド | `AGENTS.md` |
| **Codex CLI** | ✅ 完全対応（@next必須） | 11プロンプト | `AGENTS.md` |
| **GitHub Copilot** | ✅ 完全対応（@next必須） | 11プロンプト | `AGENTS.md` |
| **Qwen Code** | ✅ 完全対応 | 11コマンド | `QWEN.md` |

---

## 📋 Kiroコマンド一覧

### Specification管理コマンド

| コマンド | 説明 | 使用例 |
|---------|------|--------|
| `/kiro:spec-init` | 新規機能の仕様書を初期化 | `/kiro:spec-init "user authentication"` |
| `/kiro:spec-requirements` | 要件定義を生成 | `/kiro:spec-requirements user-auth` |
| `/kiro:spec-design` | 設計書を生成 | `/kiro:spec-design user-auth` |
| `/kiro:spec-tasks` | 実装タスクを生成 | `/kiro:spec-tasks user-auth` |
| `/kiro:spec-impl` | 実装を支援（TDD） | `/kiro:spec-impl user-auth` |
| `/kiro:spec-status` | 進捗状況を確認 | `/kiro:spec-status user-auth` |

### Validation（検証）コマンド

| コマンド | 説明 | 使用タイミング |
|---------|------|--------------|
| `/kiro:validate-gap` | 既存コードと仕様のギャップを分析 | 既存プロジェクトへの導入時 |
| `/kiro:validate-design` | 設計書の妥当性を検証 | 設計書作成後 |
| `/kiro:validate-impl` | 実装と仕様書の整合性を検証 | 実装完了後 |

### Steering（方向付け）コマンド

| コマンド | 説明 |
|---------|------|
| `/kiro:steering` | プロジェクト全体の方向性を設定（必須） |
| `/kiro:steering-custom` | カスタム方向性を追加 |

> **重要**: `/kiro:steering`は永続的プロジェクトメモリを作成します。AIが全セッションで使用するコンテキスト、ルール、アーキテクチャを定義します。**既存プロジェクトでは最初に実行**して仕様品質を劇的に向上させてください。

---

## 📖 標準的な開発フロー

### ✨ クイックスタート

#### 新規プロジェクトの場合

```bash
# AIエージェントを起動して、即座に仕様駆動開発を開始
/kiro:spec-init ユーザー認証システムをOAuthで構築  # AIが構造化計画を作成
/kiro:spec-requirements auth-system                  # AIが明確化のための質問
/kiro:spec-design auth-system                       # 人間が検証、AIが設計
/kiro:spec-tasks auth-system                        # 実装タスクに分解
/kiro:spec-impl auth-system                         # TDDで実行
```

#### 既存プロジェクトの場合（推奨）

```bash
# まずプロジェクトコンテキストを確立、その後開発を進める
/kiro:steering                                      # AIが既存プロジェクトコンテキストを学習

/kiro:spec-init 既存認証にOAuthを追加               # AIが拡張計画を作成
/kiro:spec-requirements oauth-enhancement           # AIが明確化のための質問
/kiro:validate-gap oauth-enhancement                # オプション: 既存機能と要件を分析
/kiro:spec-design oauth-enhancement                 # 人間が検証、AIが設計
/kiro:validate-design oauth-enhancement             # オプション: 設計の統合を検証
/kiro:spec-tasks oauth-enhancement                  # 実装タスクに分解
/kiro:spec-impl oauth-enhancement                   # TDDで実行
```

**30秒セットアップ** → **AI駆動「ボルト」（スプリントではなく）** → **時間単位の結果**

### Phase 0: プロジェクトセットアップ（初回のみ）

```bash
# プロジェクト全体の方向性を設定
/kiro:steering

# カスタム設定が必要な場合
/kiro:steering-custom
```

### Phase 1: 仕様書作成

```bash
# 1. 新機能の仕様書を初期化
/kiro:spec-init "機能の説明"
# 例: /kiro:spec-init "OAuth 2.0 + TOTP 2FA authentication system"

# 2. 要件定義を生成
/kiro:spec-requirements {feature-name}
# 例: /kiro:spec-requirements user-auth-oauth-2fa

# 3. （既存コードがある場合）ギャップ分析
/kiro:validate-gap {feature-name}
# 例: /kiro:validate-gap user-auth-oauth-2fa

# 4. 設計書を生成
/kiro:spec-design {feature-name}
# 例: /kiro:spec-design user-auth-oauth-2fa

# 5. 設計書の検証（任意）
/kiro:validate-design {feature-name}

# 6. 実装タスクを生成
/kiro:spec-tasks {feature-name}
# 例: /kiro:spec-tasks user-auth-oauth-2fa
```

### Phase 2: 実装

```bash
# 7. 実装を開始
/kiro:spec-impl {feature-name} [task-numbers]
# 例: /kiro:spec-impl user-auth-oauth-2fa
# 例: /kiro:spec-impl user-auth-oauth-2fa 1,2,3
```

### Phase 3: 検証

```bash
# 8. 実装と仕様書の整合性を検証
/kiro:validate-impl {feature-name}
# 例: /kiro:validate-impl user-auth-oauth-2fa
```

### 進捗確認（いつでも）

```bash
# 現在の進捗状況を確認
/kiro:spec-status {feature-name}
# 例: /kiro:spec-status user-auth-oauth-2fa
```

---

## ⚠️ 重要な使い方のルール

### 1. フェーズごとの承認（AIネイティブ+人間ゲート）

```
Requirements → Design → Tasks → Implementation
     ↓            ↓         ↓           ↓
  AI実行       AI実行    AI実行       AI実行
     ↓            ↓         ↓           ↓
  人間検証     人間検証   人間検証     人間検証
```

**原則:** AIが実行を駆動し、各フェーズで人間が重要な決定を検証

**例外:** `-y` フラグで承認をスキップ可能（意図的な高速化のみ）

```bash
/kiro:spec-design user-auth -y    # 承認なしで設計書生成
/kiro:spec-tasks user-auth -y     # 承認なしでタスク生成
```

### 2. Steeringの更新

プロジェクトの方向性が変わった場合は、Steeringを更新して整合性を保つ:

```bash
/kiro:spec-status {feature-name}   # 現在の状態を確認
/kiro:steering                     # Steeringを再設定
```

### 3. 仕様書の手動編集後の検証

仕様書を手動で編集した場合は、必ず検証を実行:

```bash
# 設計書を手動編集した後
/kiro:validate-design {feature-name}

# 実装を手動で追加した後
/kiro:validate-impl {feature-name}
```

---

## 🎯 実践例: WebAuthn機能の追加

このプロジェクトでの実際の導入例:

```bash
# 1. 仕様書を初期化
/kiro:spec-init "OAuth 2.0 + PKCE and TOTP-based 2FA authentication system"

# 2. 要件定義を生成
/kiro:spec-requirements user-auth-oauth-2fa

# 3. 設計書を生成
/kiro:spec-design user-auth-oauth-2fa

# 4. 実装タスクを生成
/kiro:spec-tasks user-auth-oauth-2fa

# 5. 実装を実施
/kiro:spec-impl user-auth-oauth-2fa

# 6. 実装後に仕様書を手動更新した場合
#    → 整合性を検証
/kiro:validate-impl user-auth-oauth-2fa
```

### 生成された仕様書

- `.kiro/specs/user-auth-oauth-2fa/requirements.md` - 12の要件定義（Requirement 6.1-6.12）
- `.kiro/specs/user-auth-oauth-2fa/design.md` - 技術設計書（1760行）
- `.kiro/specs/user-auth-oauth-2fa/tasks.md` - 実装タスク一覧

---

## 🔧 Kiroコマンドを使わない場合

**Kiroコマンドは必須ではありません。** 以下の標準ツールでも同等の作業が可能です:

### 標準ツールを使った手動フロー

```typescript
// Read ツールで仕様書を読む
Read .kiro/specs/user-auth-oauth-2fa/requirements.md
Read .kiro/specs/user-auth-oauth-2fa/design.md
Read .kiro/specs/user-auth-oauth-2fa/tasks.md

// 実装ファイルを読む
Read src/services/webauthn-service.ts
Read src/controllers/webauthn-controller.ts

// 人間の分析で整合性を確認
// （Kiroなら /kiro:validate-impl で自動化）

// Edit ツールで仕様書を更新
Edit .kiro/specs/user-auth-oauth-2fa/requirements.md
Edit .kiro/specs/user-auth-oauth-2fa/design.md
Edit .kiro/specs/user-auth-oauth-2fa/tasks.md
```

### 比較: Kiroコマンド vs 手動

| 作業 | Kiroコマンド | 手動（標準ツール） |
|------|------------|-----------------|
| **効率** | ⚡ 高速・自動 | 🐌 時間がかかる |
| **精度** | ✅ 自動検証 | ⚠️ 人間の見落としあり |
| **学習コスト** | 📚 コマンドを覚える必要 | 📖 標準ツールのみ |
| **柔軟性** | 🎯 定型フロー | 🔧 自由度高い |

**推奨:** 効率化のため、**Kiroコマンドの使用を推奨**します。

---

## 📂 プロジェクト構造

### パス

- **Steering:** `.kiro/steering/` - プロジェクト全体の方向性
- **Specs:** `.kiro/specs/` - 機能別の仕様書
- **Settings:** `.kiro/settings/` - 共通ルールとテンプレート

### Steering vs Specification

- **Steering** (`.kiro/steering/`)
  - プロジェクト全体のルールとコンテキストを定義
  - すべての機能に共通する方針を記載
  - 例: `product.md`, `tech.md`, `structure.md`

- **Specs** (`.kiro/specs/`)
  - 個別機能の開発プロセスを形式化
  - 各機能ごとに `requirements.md`, `design.md`, `tasks.md` を生成
  - 例: `.kiro/specs/user-auth-oauth-2fa/`

### アクティブな仕様書

現在のアクティブな仕様書を確認:

```bash
ls .kiro/specs/
/kiro:spec-status {feature-name}
```

---

## 🛠 テンプレートのカスタマイズ

`.kiro/settings/templates/` 配下のテンプレートをチームのドキュメント形式に合わせてカスタマイズ可能:

```
.kiro/settings/templates/
├── steering/       # ステアリングテンプレート
├── requirements/   # 要件定義テンプレート
├── design/         # 設計書テンプレート
└── tasks/          # タスクテンプレート
```

テンプレートを編集することで、生成される仕様書の形式をチームの標準に合わせることができます。

---

## 💡 開発ガイドライン

### AI-DLC (AI Driven Development Life Cycle)

**コアパターン:** AI実行、人間検証

1. **AI駆動実行** - AIが要件分析、設計、タスク分解、実装を主導
2. **人間品質ゲート** - 各フェーズで人間が重要な決定を検証
3. **高速サイクル** - 週単位のスプリントを時間・日単位の「ボルト」に置き換え
4. **70%オーバーヘッド削減** - 従来開発の会議・文書・儀式を最小化

### 仕様駆動開発（Spec-Driven Development）

1. **3-phase承認ワークフロー:** Requirements → Design → Tasks → Implementation
2. **仕様を単一情報源として:** すべての開発活動は仕様書から駆動
3. **人間レビュー必須:** 各フェーズで人間の承認が必要
4. **`-y` フラグは慎重に:** 意図的な高速化の場合のみ使用
5. **Steeringの整合性:** `/kiro:spec-status` で定期的に確認

### 言語設定

- **思考:** 英語で考える（Think in English）
- **生成:** 日本語で回答（Generate responses in Japanese）

---

## 🆘 トラブルシューティング

### Q: 仕様書と実装が一致しない

```bash
# 整合性を検証
/kiro:validate-impl {feature-name}

# ギャップを分析
/kiro:validate-gap {feature-name}

# 仕様書を手動で更新
Edit .kiro/specs/{feature-name}/requirements.md
Edit .kiro/specs/{feature-name}/design.md
Edit .kiro/specs/{feature-name}/tasks.md

# 再度検証
/kiro:validate-impl {feature-name}
```

### Q: Kiroコマンドが動かない

1. `.claude/commands/kiro/` ディレクトリが存在するか確認
2. コマンドファイルが存在するか確認
3. ClaudeCodeを再起動

### Q: 既存プロジェクトにKiroを導入したい

```bash
# まずプロジェクトコンテキストを設定
/kiro:steering

# 既存機能の仕様書を作成
/kiro:spec-init "既存機能の説明"
/kiro:spec-requirements {feature-name}

# 既存コードのギャップ分析
/kiro:validate-gap {feature-name}

# 分析結果を元に設計書とタスクを作成
/kiro:spec-design {feature-name}
/kiro:spec-tasks {feature-name}

# 実装と仕様書の整合性を確認
/kiro:validate-impl {feature-name}
```

### Q: cc-sddを再インストールしたい

```bash
# 既存ファイルのバックアップを取る
npx cc-sdd@latest --backup

# ドライランで確認
npx cc-sdd@latest --dry-run --lang ja

# 実際にインストール
npx cc-sdd@latest --lang ja
```

---

## 🌟 Kiro IDE統合

作成された仕様書は **Kiro IDE** (https://kiro.dev) でも利用可能です:

- 強化された実装ガードレール
- チーム協働機能
- 仕様書のバージョン管理
- リアルタイムコラボレーション

仕様書を `.kiro/specs/` に保存することで、Kiro IDEと互換性のある形式で管理できます。

---

## 📚 参考リンク

### 公式リソース

- **cc-sdd公式リポジトリ:** https://github.com/gotalab/cc-sdd
- **npmパッケージ:** https://www.npmjs.com/package/cc-sdd
- **解説記事:** https://zenn.dev/gotalab/articles/3db0621ce3d6d2
- **Kiro IDE:** https://kiro.dev
- **Kiroドキュメント:** https://kiro.dev/docs/specs/

### AI-DLC関連

- **AI-DLC (AWS):** https://aws.amazon.com/jp/blogs/news/ai-driven-development-life-cycle/

### ClaudeCode

- **ClaudeCode公式:** https://claude.com/claude-code

---

## 📄 ライセンス

**MIT License** - このプロジェクトはcc-sddパッケージ（MIT License）を使用しています。

---

**ベータリリース** - 使用可能、改善中。問題報告: https://github.com/gotalab/cc-sdd/issues
