# FMPJ 議事録自動生成ツール

FMPJ（一般社団法人 日本音楽制作者連盟）専用の議事録自動生成Webアプリケーション。

## 機能

- PLAUD等の文字起こしデータから議事録を自動生成
- 対話的な話者特定フロー（Speaker 1 → 実名への変換）
- FMPJフォーマットに完全準拠した出力
- ToDoリストの自動抽出
- ストリーミング表示（生成過程をリアルタイム確認）
- ゼロデータ保持（サーバーにデータを保存しない）

## セットアップ

### 環境変数

`.env.example` を `.env.local` にコピーし、値を設定:

```bash
cp .env.example .env.local
```

| 変数名 | 説明 | 必須 |
|--------|------|------|
| `ANTHROPIC_API_KEY` | Anthropic Claude API キー | Yes |
| `APP_PASSWORD` | アクセス用パスワード | Yes |
| `NEXT_PUBLIC_APP_NAME` | アプリ名（デフォルト: "FMPJ議事録ツール"） | No |

### 開発サーバー

```bash
npm install
npm run dev
```

http://localhost:3000 にアクセスし、`APP_PASSWORD` に設定したパスワードでログイン。

### デプロイ

Vercelにプッシュ時に自動デプロイ。環境変数はVercelダッシュボードで設定してください。

## 使い方

1. **ログイン** - パスワードを入力
2. **会議情報入力** - 会議名、日時、場所、出席者、文字起こしデータを入力
3. **話者特定** - 「Speaker 1」等を実名に割り当て
4. **生成** - Claude AIが議事録を自動生成
5. **結果確認** - 議事録とToDoリストを確認、コピー・ダウンロード

## 技術スタック

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS / shadcn/ui
- Anthropic Claude API (claude-sonnet-4-20250514)
- Vercel
