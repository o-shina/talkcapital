# TalkCapital exe.dev セットアップ指示

## このドキュメントについて
exe.dev の AI Agent (Shelly) に渡す指示書です。
TalkCapital（講演音声→リアルタイムグラレコPNG生成）をWebサービスとしてデプロイします。

## ゴール
TalkCapitalのストリーミングモードをexe.dev上で起動する。
ブラウザからマイクで講演音声を入力し、リアルタイムで文字起こし＋一定区切りでグラレコPNGを更新表示するWebサービス。

## アーキテクチャ概要
```
ブラウザ (マイク)
  │ PCM 16kHz via WebSocket
  ▼
Node.js サーバー (exe.dev, port 8080)
  ├→ Amazon Transcribe Streaming（リアルタイム文字起こし）
  │    └→ 確定テキスト蓄積
  ├→ 500文字蓄積ごとに:
  │    Bedrock構造化 → Excalidraw JSON → PNG → WebSocketでブラウザに送信
  └→ 講演終了時:
       全文字起こし → Bedrock最終構造化 → 最終版PNG
```

## 手順

### 1. 環境セットアップ

```bash
# Node.js 20 インストール
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# リポジトリ取得
git clone https://github.com/o-shina/talkcapital.git
cd talkcapital

# 依存パッケージインストール
npm install

# Playwright用Chromiumインストール（ヘッドレスブラウザ、PNG生成に必要）
npx playwright install --with-deps chromium

# TypeScriptビルド
npm run build
```

### 2. AWS認証情報の設定

TalkCapitalはAWSの3サービスを使います:
- **Amazon Transcribe Streaming**: リアルタイム音声→テキスト変換
- **Amazon Bedrock**: テキスト→構造化JSON（Claude）
- **S3**: バッチCLI用（ストリーミングモードでは不使用だが設定は必要）

```bash
# .envファイルを作成（値は実際の認証情報に置き換える）
cat > .env << 'ENVEOF'
AWS_REGION=ap-northeast-1
AWS_S3_BUCKET=<S3バケット名>
AWS_S3_KEY_PREFIX=talkcapital
AWS_ACCESS_KEY_ID=<AWSアクセスキー>
AWS_SECRET_ACCESS_KEY=<AWSシークレットキー>
BEDROCK_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-sonnet-4-20250514-v1:0
LLM_PROVIDER=bedrock
OUTPUT_SCALE=2
PORT=8080
ENVEOF
```

**注意**: `<...>` の部分は実際の値に置き換えてください。これらの値はログに出力しないでください。

### 3. ビルドと起動

```bash
# TypeScriptビルド
npm run build

# テスト実行（全テスト合格を確認）
npm run test

# サーバー起動（WebSocket + 静的ファイル配信）
npm run serve
```

サーバーが起動すると:
- `http://localhost:8080` でWeb UIが表示される
- WebSocket接続でリアルタイム文字起こし＋グラレコ更新が動作する
- `GET /health` でヘルスチェック可能

### 4. 動作確認

```bash
# ヘルスチェック
curl http://localhost:8080/health
# 期待: {"status":"ok"}
```

ブラウザで `http://localhost:8080` にアクセスし:
1. 「録音開始」ボタンをクリック（マイク許可が必要）
2. 喋ると文字起こしがリアルタイム表示される
3. 約500文字分の発話ごとにグラレコPNGが更新される
4. 「録音停止」で最終版グラレコが生成される

### 5. ポート公開

exe.dev でポート8080を外部公開してください。
公開後、外部から `https://<your-vm>.exe.dev/` でWeb UIにアクセス可能になります。

**重要**: WebSocket接続も同じポートで動作します。プロキシ設定でWebSocketが通るようにしてください。

## 技術的な注意事項
- Playwright（Chromium）はサーバー起動時に1回だけ起動し、使い回す（PlaywrightPool）
- 同時セッション数は1に制限（exe.devのメモリ制約を考慮）
- Transcribe Streamingは15秒間無音だとタイムアウトする（10秒間隔で無音チャンクを送信して防止済み）
- Bedrock構造化は1回5-15秒かかる。その間は「構造化中...」ステータスが表示される
- 500文字蓄積ごとの更新なので、15分講演で5-7回程度のPNG生成（負荷は低い）

## トラブルシューティング

### Chromiumが起動しない
```bash
# 依存ライブラリのインストール
npx playwright install --with-deps chromium
```

### WebSocketが接続できない
- exe.devのポート公開設定でWebSocketが許可されているか確認
- `wss://` (SSL) で接続する場合、exe.devのSSL終端設定を確認

### Transcribe Streamingが動作しない
- AWS認証情報が正しいか確認
- `AWS_REGION=ap-northeast-1` が設定されているか確認（Transcribe Streamingは東京リージョン対応）

## ファイル構成（主要）
```
talkcapital/
├── src/
│   ├── server.ts                  # Express + WebSocket サーバー
│   ├── index.ts                   # CLIエントリポイント（バッチ用）
│   ├── streaming/
│   │   ├── session.ts             # StreamingSession（セッション管理）
│   │   ├── transcribe-stream.ts   # Transcribe Streaming ラッパー
│   │   └── playwright-pool.ts     # Playwright使い回し
│   └── pipeline/
│       └── orchestrator.ts        # バッチパイプライン（CLI用）
├── public/
│   ├── index.html                 # Web UI
│   ├── app.js                     # WebSocket + AudioWorklet管理
│   ├── audio-processor.js         # AudioWorklet（PCMキャプチャ）
│   └── style.css                  # スタイル
├── export/
│   └── index.html                 # Excalidrawレンダラー
├── package.json                   # "serve" スクリプトあり
└── .env                           # AWS認証情報
```
