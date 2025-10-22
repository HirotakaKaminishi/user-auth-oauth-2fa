# Docker Compose セットアップガイド

## 🎯 環境別セットアップ方法

### **Termux環境（Android）の制約**

Termux内でのDocker実行には以下の制約があります：
- ❌ Androidカーネルの制限（cgroups、overlayfs）
- ❌ proot環境での完全なDocker動作不可
- ✅ Alpine Linuxインストールは可能
- ✅ Docker CLIのインストールは可能
- ⚠️ Dockerデーモンの完全動作は困難

### **推奨環境**

#### 1. **ローカル開発（PC/Mac）**
```bash
# 前提条件: Docker Desktop インストール済み
# https://www.docker.com/products/docker-desktop/

# 起動
make dev

# または
docker-compose up -d

# 確認
curl http://localhost:3000/health
```

#### 2. **GitHub Actions（CI/CD）**
プロジェクトに `.github/workflows/docker-test.yml` が含まれています。
GitHubにpushすると自動でDockerテストが実行されます。

```bash
git add .
git commit -m "Add Docker Compose setup"
git push origin main
# → GitHub Actions で自動テスト実行
```

#### 3. **クラウドVM（リモート開発）**

**GitHub Codespaces（推奨）**:
```bash
# ブラウザでGitHubリポジトリを開く
# "Code" → "Codespaces" → "Create codespace"
# → Dockerが自動で利用可能
```

**DigitalOcean Droplet**:
```bash
# $6/月 でDocker環境が使える
# 1. Dropletを作成（Docker Marketplace Image）
# 2. SSH接続
# 3. リポジトリをclone
# 4. docker-compose up -d
```

**AWS EC2（無料枠）**:
```bash
# t2.micro（無料枠）
# Amazon Linux 2023（Docker対応）
sudo yum install -y docker
sudo systemctl start docker
sudo usermod -aG docker ec2-user
```

## 🔧 Termux + リモートDocker環境

### **SSH経由でリモートDockerを操作**

```bash
# Termux側
pkg install openssh

# リモートサーバーに接続
ssh user@your-server.com

# サーバー側でDocker操作
docker-compose up -d
docker-compose logs -f

# Termuxからポートフォワーディング
ssh -L 3000:localhost:3000 user@your-server.com
# → http://localhost:3000 でアクセス可能
```

### **Termuxで直接PostgreSQL/Redis実行（Docker不使用）**

```bash
# Termux内で直接実行（Dockerなし）
pkg install postgresql redis

# PostgreSQL起動
initdb $PREFIX/var/lib/postgresql
pg_ctl -D $PREFIX/var/lib/postgresql start
createdb auth_db

# Redis起動
redis-server &

# Node.js起動
npm run dev
```

## 📊 環境比較

| 環境 | Docker | セットアップ | コスト | 推奨度 |
|------|--------|------------|--------|--------|
| **Termux直接** | ❌ | 簡単 | 無料 | ⭐⭐⭐ |
| **Termux + proot Alpine** | ⚠️ | 複雑 | 無料 | ⭐⭐ (実験的) |
| **PC/Mac** | ✅ | 簡単 | 無料 | ⭐⭐⭐⭐⭐ |
| **GitHub Codespaces** | ✅ | 最簡単 | 無料枠あり | ⭐⭐⭐⭐⭐ |
| **DigitalOcean** | ✅ | 簡単 | $6/月 | ⭐⭐⭐⭐ |
| **AWS EC2** | ✅ | 普通 | 無料枠あり | ⭐⭐⭐⭐ |

## 🚀 クイックスタート（環境別）

### **開発中（Termux）**
```bash
# Dockerなしで開発
npm run dev
```

### **テスト（GitHub Actions）**
```bash
git push origin main
# → 自動でDockerテスト実行
```

### **本番デプロイ（VPS）**
```bash
# VPSにSSH接続
ssh user@your-vps.com

# Docker Compose起動
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## 🔗 便利なリンク

- [GitHub Codespaces（60時間/月無料）](https://github.com/features/codespaces)
- [DigitalOcean（紹介リンクで$200クレジット）](https://www.digitalocean.com/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Termux Wiki](https://wiki.termux.com/)

## ❓ FAQ

**Q: Termux内でDockerは使えませんか？**
A: 技術的には部分的に可能ですが、多くの制約があり、実用には推奨しません。

**Q: 一番簡単な方法は？**
A: GitHub Codespacesが最も簡単です（ブラウザだけで完結）。

**Q: 完全無料で使えますか？**
A: Termux直接実行またはGitHub Codespaces無料枠で可能です。

**Q: 本番環境はどうすべき？**
A: DigitalOcean（$6/月）またはAWS（従量課金）を推奨します。
