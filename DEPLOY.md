# Render デプロイ手順

## 前提
- すべてブラウザだけで完結します
- GitHub と Render のアカウントが必要（無料）

---

## Step 1: GitHubにファイルをアップ

### 1-1. GitHubアカウント作成
1. https://github.com にアクセス
2. 「Sign up」→ メールアドレス・パスワードを設定

### 1-2. 新規リポジトリ作成
1. 右上「+」→「**New repository**」
2. 設定：
   - Repository name: `wc2026-prediction`
   - **Public** を選択（Render無料プランの条件）
   - 「Create repository」

### 1-3. ファイルをアップロード
1. 作成されたリポジトリ画面で「**uploading an existing file**」リンクをクリック
2. **以下のファイル/フォルダ**を Windows のエクスプローラーから**ドラッグ&ドロップ**：
   ```
   server.js
   package.json
   .gitignore
   DEPLOY.md
   public/  (フォルダごと)
   ```
   ⚠️ **`node_modules/` と `data.json` はアップしない**（.gitignoreで除外済）
3. ページ下部「Commit changes」→ そのまま「Commit changes」をクリック

---

## Step 2: Renderでデプロイ

### 2-1. Renderアカウント作成
1. https://render.com にアクセス
2. 「**Get Started**」→「**GitHub**」アイコンでサインアップ
3. GitHubへの連携を承認

### 2-2. Web Serviceを作成
1. Renderダッシュボード → 右上「**+ New**」→「**Web Service**」
2. 「Connect a repository」で `wc2026-prediction` を選択して「Connect」
3. 設定画面：
   | 項目 | 値 |
   |------|-----|
   | Name | お好きな名前（URLに反映、例: `wc2026-yourname`） |
   | Region | Singapore（日本に近い） |
   | Branch | main |
   | Build Command | `npm install` |
   | Start Command | `node server.js` |
   | Instance Type | **Free** |
4. 下部「**Deploy Web Service**」をクリック

### 2-3. デプロイ完了
- 5〜10分でビルド完了
- 完了すると `https://wc2026-yourname.onrender.com` のようなURLが表示
- このURLを友達にシェア！

---

## Step 3: 運用Tips

### ⚠️ データ消失リスクへの対策
Render無料プランは**コンテナ再起動でファイルが消える**ことがあります。

**こまめにバックアップ**：
1. 管理タブを開く → 管理者キー入力（`wc2026admin`）
2. 「💾 データバックアップ」セクション
3. 「**📥 投票データをダウンロード**」を毎日実行
4. ダウンロードした `wc2026-backup-YYYYMMDD.json` を保管

**万一データが消えたら**：
1. 同じセクションの「📤 バックアップから復元」
2. 保管していたバックアップファイルを選択
3. 「バックアップを読み込んで上書き」

### スリープ対策
- 15分非アクティブでスリープ → 次の起動に20〜30秒
- 解決策：https://uptimerobot.com に登録 → 5分おきにURLをpingしてくれる（無料）

### コードを更新したいとき
1. GitHubリポジトリで該当ファイルをクリック
2. 鉛筆アイコン（Edit）→ 編集 → 「Commit changes」
3. Renderが自動で再デプロイ（数分）

---

## トラブルシューティング

| 症状 | 対処 |
|------|------|
| ビルドエラー | Render の「Logs」タブで詳細確認 |
| 投票できない | 管理者キーで投票締切を確認 |
| データ消失 | バックアップから復元 |
| 友達がアクセスできない | URLが正しいか・Render上で「Live」になっているか確認 |

---

## 構成図

```
[友達のブラウザ] ───→ [Render: wc2026-yourname.onrender.com]
                                  ├ Express + Node.js
                                  ├ public/ (静的ファイル)
                                  └ data.json (再起動で消える可能性)
                                          ↓ バックアップ
                                  [あなたのPC: wc2026-backup-*.json]
```
