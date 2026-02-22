# TalkCapital

15分講演の音声から、手書き風グラフィックレコーディングPNG（3840x2160）を生成するTypeScript CLIです。

## 技術スタック
- Amazon Transcribe（バッチ文字起こし）
- Amazon Bedrock Claude（Converse API + toolUse）
- Excalidraw JSON（固定テンプレート生成）
- Playwright（ヘッドレスPNGエクスポート）

## セットアップ
```bash
npm install
npx playwright install chromium
cp .env.example .env
```

前提:
- Node.js 20 以上
- AWS 認証情報（`AWS_PROFILE` または環境変数）を事前設定

`.env` 設定例:
```env
AWS_REGION=ap-northeast-1
AWS_S3_BUCKET=your-bucket
AWS_S3_KEY_PREFIX=talkcapital
BEDROCK_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-sonnet-4-20250514-v1:0
OUTPUT_SCALE=2
```

## 必要なAWS権限
- `s3:PutObject`, `s3:GetObject`
- `transcribe:StartTranscriptionJob`, `transcribe:GetTranscriptionJob`
- `bedrock:Converse`

最小ポリシー例:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::<YOUR_BUCKET>/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "transcribe:StartTranscriptionJob",
        "transcribe:GetTranscriptionJob"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:Converse"
      ],
      "Resource": "*"
    }
  ]
}
```

## 使い方
```bash
# 通常フロー（音声 -> Transcribe -> Bedrock -> PNG）
npx talkcapital generate --input ./lecture.m4a --output /tmp/test.png

# 文字起こしスキップ（検証用）
npx talkcapital generate --skip-transcribe --transcript test/fixtures/sample-transcript.txt --output /tmp/test.png

# Excalidraw JSONのみ出力
npx talkcapital generate --skip-transcribe --transcript test/fixtures/sample-transcript.txt --format excalidraw --output /tmp/test.excalidraw.json
```

主要オプション:
- `--input <path>`: 入力音声
- `--output <path>`: 出力PNG
- `--skip-transcribe`: 文字起こしをスキップ
- `--transcript <path>`: 既存文字起こしファイル
- `--format <png|excalidraw>`: 出力形式（デフォルト: `png`）
- `--scale <number>`: 出力スケール（デフォルト2）
- `--verbose`: 詳細ログ

実行ログ:
- 主要ステージ（`[1/4]` から `[4/4]`）は常時表示
- `--verbose` は将来の詳細デバッグログ拡張用フラグ

## 開発
```bash
npm run build
npm run lint
npm run test
```

## 講演当日のデモ手順
1. 録音ファイル（m4a/mp3等）をローカルへ転送
2. CLI実行
3. `/tmp/test.png` など出力先で画像確認
4. 必要なら `--skip-transcribe` で構造化以降を再実行
