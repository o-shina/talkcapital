# アーキテクチャ設計

## アプリケーション形態

TypeScript CLI ツール（Node.js 18+）

```bash
npx talkcapital generate --input ./lecture.m4a --output ./output.png
```

---

## パイプライン全体像

```
┌──────────┐    ┌─────────┐    ┌───────────────┐    ┌────────────┐    ┌──────────┐
│ Audio    │───▶│ S3      │───▶│ Amazon        │───▶│ Bedrock    │───▶│ Template │
│ File     │    │ Upload  │    │ Transcribe    │    │ Claude     │    │ Engine   │
│ (local)  │    │         │    │ (batch)       │    │ (Converse) │    │          │
└──────────┘    └─────────┘    └───────────────┘    └────────────┘    └──────────┘
                                                                           │
                                                                           ▼
                                                     ┌──────────┐    ┌──────────┐
                                                     │ PNG File │◀───│ Playwright│
                                                     │ (output) │    │ Export   │
                                                     └──────────┘    └──────────┘
```

**所要時間の目安**: 2〜4分（Transcribe 1-3分 + Claude 5-15秒 + Export 数秒）

---

## 各ステージ詳細

### Stage 1: 音声入力 → S3アップロード

| 項目 | 値 |
|------|------|
| 入力 | ローカル音声ファイル (m4a, mp3, wav, flac, ogg, webm) |
| 出力 | S3 URI (`s3://{bucket}/{prefix}/{jobName}.{ext}`) |
| SDK | `@aws-sdk/client-s3` (PutObjectCommand) |
| タイムアウト | 30秒 |
| リトライ | 2回（指数バックオフ） |

**処理フロー**:
1. ファイル存在確認 + 拡張子バリデーション
2. S3バケットにアップロード（キー: `{prefix}/{uuid}.{ext}`）
3. S3 URIを返却

### Stage 2: Amazon Transcribe (バッチ)

| 項目 | 値 |
|------|------|
| 入力 | S3 URI |
| 出力 | プレーンテキスト文字起こし |
| SDK | `@aws-sdk/client-transcribe` |
| API | StartTranscriptionJobCommand + GetTranscriptionJobCommand |
| 言語 | `ja-JP` |
| リージョン | `ap-northeast-1` (東京) |
| ポーリング間隔 | 5秒 |
| タイムアウト | 5分 |
| リトライ | 1回（ジョブFAILED時） |

**処理フロー**:
1. `StartTranscriptionJobCommand` でジョブ開始
2. `GetTranscriptionJobCommand` で5秒間隔ポーリング
3. ステータスが `COMPLETED` になったら結果JSONのURLを取得
4. 結果JSONをダウンロードし、`results.transcripts[0].transcript` を抽出
5. プレーンテキストを返却

**バッチを選択した理由**: ストリーミングはWebSocket管理・PCM変換が必要で複雑。バッチは一般的な音声フォーマットをそのまま受け付け、1-3分で完了する。

### Stage 3: Amazon Bedrock Claude (構造化)

| 項目 | 値 |
|------|------|
| 入力 | 文字起こしテキスト |
| 出力 | `StructuredContent` JSON (Zodバリデーション済み) |
| SDK | `@aws-sdk/client-bedrock-runtime` (ConverseCommand) |
| モデルID | `anthropic.claude-sonnet-4-20250514-v1:0` (設定で変更可) |
| リージョン | `us-east-1` (BEDROCK_REGION で変更可) |
| タイムアウト | 60秒 |
| リトライ | 2回（APIエラー or スキーマ検証失敗） |

**処理フロー**:
1. システムプロンプト + 文字起こしテキストで `ConverseCommand` 呼び出し
2. `toolConfig` で `structured_output` ツールを定義し、JSONスキーマを渡す
3. レスポンスからtoolUse結果を抽出
4. Zodスキーマでバリデーション
5. バリデーション失敗時: エラーメッセージを追加して再呼び出し（最大2回）
6. `StructuredContent` を返却

**Bedrock Converse API の toolUse パターン**:
```typescript
const toolConfig = {
  tools: [{
    toolSpec: {
      name: "structured_output",
      description: "講演の構造化データを出力する",
      inputSchema: {
        json: structuredContentJsonSchema  // Zodスキーマから変換
      }
    }
  }],
  toolChoice: { tool: { name: "structured_output" } }  // 強制使用
};
```

### Stage 4: テンプレートエンジン (JSON → Excalidraw JSON)

| 項目 | 値 |
|------|------|
| 入力 | `StructuredContent` JSON |
| 出力 | Excalidraw JSON ドキュメント |
| 処理時間 | 1秒未満（純粋関数、インメモリ） |

**処理フロー**:
1. タイトル要素生成（矩形 + バインドテキスト）
2. メインメッセージ要素生成（矩形 + バインドテキスト）
3. 各ブロック要素生成（矩形 + 見出しテキスト + 箇条書きテキスト × N）
4. 吹き出し要素生成（楕円 + バインドテキスト）× N
5. アクションエリア生成（矩形 + ヘッダーテキスト + チェックボックス矩形 + テキスト × 3）
6. 全要素をExcalidraw JSONドキュメントとして組み立て

**設計原則**:
- 純粋関数（副作用なし、非同期なし）
- 固定座標テンプレートへのマッピング（LLMは座標に関与しない）
- 3ブロックの場合はBlock 4スロットを空白に（余白として活用）
- 要素IDはnanoidで生成

### Stage 5: PNGエクスポート

| 項目 | 値 |
|------|------|
| 入力 | Excalidraw JSON |
| 出力 | 高解像度PNG (3840x2160) |
| ツール | Playwright + @excalidraw/excalidraw |
| タイムアウト | 30秒 |

**処理フロー**:
1. Excalidraw JSONを一時ファイルに書き出し
2. Playwrightでヘッドレスブラウザ（Chromium）を起動
3. `export/index.html` を開く（Excalidrawレンダラーを含むHTMLページ）
4. ページにExcalidraw JSONを注入
5. `exportToBlob()` を呼び出し（scale: 2, mimeType: "image/png"）
6. Blob → Buffer → ファイルに書き出し
7. ブラウザを閉じて一時ファイルを削除

**Playwrightを選択した理由**: Excalidraw公式レンダラーを使うため描画忠実度が最も高い。excalirender等はOS依存の問題がある。

---

## 構造化JSONスキーマ

```typescript
import { z } from "zod";

const shortText = z.string().min(1).max(50);
const mediumText = z.string().min(1).max(80);

export const structuredContentSchema = z.object({
  title: z.string().min(1).max(30),
  mainMessage: mediumText,
  blocks: z.array(z.object({
    heading: shortText,
    bullets: z.array(z.object({
      text: shortText,
    })).min(1).max(3),
  })).min(3).max(4),
  speechBubbles: z.array(z.object({
    quote: shortText,
    emphasis: z.enum(["important", "surprising", "humorous", "inspiring"]).optional(),
  })).min(1).max(4),
  actions: z.array(z.object({
    text: shortText,
  })).length(3),
});

export type StructuredContent = z.infer<typeof structuredContentSchema>;
```

**サンプル出力**:
```json
{
  "title": "チームの心理的安全性",
  "mainMessage": "失敗を恐れず発言できる環境が、チームの成果を最大化する",
  "blocks": [
    {
      "heading": "心理的安全性とは",
      "bullets": [
        { "text": "対人リスクを取れる環境" },
        { "text": "Googleのプロジェクトで発見" },
        { "text": "成果を出すチームの共通点" }
      ]
    },
    {
      "heading": "4つの不安を取り除く",
      "bullets": [
        { "text": "無知・無能と思われる不安" },
        { "text": "邪魔していると思われる不安" },
        { "text": "否定的だと思われる不安" }
      ]
    },
    {
      "heading": "リーダーの役割",
      "bullets": [
        { "text": "自ら失敗を共有する" },
        { "text": "質問を歓迎する姿勢" },
        { "text": "感謝を言葉にする" }
      ]
    }
  ],
  "speechBubbles": [
    { "quote": "失敗は学びのチャンス", "emphasis": "important" },
    { "quote": "誰でも質問していいんです", "emphasis": "inspiring" },
    { "quote": "サイレントな同意は危険信号", "emphasis": "surprising" }
  ],
  "actions": [
    { "text": "次の会議で自分の失敗談を共有する" },
    { "text": "チームメンバーに感謝を1つ伝える" },
    { "text": "質問しやすい空気を意識して作る" }
  ]
}
```

---

## Claudeシステムプロンプト

```
あなたは講演の内容をグラフィックレコーディング用に構造化するアシスタントです。

# 厳守ルール
1. 捏造禁止：講演で話されていない事実・固有の断定を絶対に追加しない。不明な点は一般化するか空欄にする
2. 短文化：各テキストは目安40文字以内（日本語）
3. titleは30文字以内
4. mainMessageは80文字以内（最も重要な1行）
5. blocksは3〜4個、各blockのbulletsは1〜3個
6. speechBubblesは1〜4個（講演者の印象的な発言をそのまま抽出）
7. actionsは必ず3個（「今日からできる」具体的アクション）
8. 専門用語は講演で使われていた表現をそのまま使用
9. 情報を詰め込みすぎない。余白を意識し、重要度の高い内容のみ抽出
```

---

## Excalidraw テンプレートレイアウト

### キャンバス: 1920 x 1080px (scale 2 → 3840x2160 PNG)

```
+================================================================+
|  [ TITLE (orange) ]       [ MAIN MESSAGE (yellow) ]            |
|  (30,20 w580×h80)         (640,20 w1250×h80)                   |
+----------------------------------------------------------------+
|                            |                                    |
| [Block 1 - blue]          | [Block 2 - green]  | Speech 1  Speech 2   |
| (30,140 w420×h320)        | (480,140 w420×h320) | (940,140)  (1420,140)|
|  見出し                    |  見出し              |                      |
|  ・箇条書き1               |  ・箇条書き1          | Speech 3  Speech 4   |
|  ・箇条書き2               |  ・箇条書き2          | (940,270)  (1420,270)|
|  ・箇条書き3               |  ・箇条書き3          |                      |
|                            |                      |                      |
| [Block 3 - purple]        | [Block 4 - pink]    | +-ACTIONS (lilac)---+|
| (30,500 w420×h320)        | (480,500 w420×h320)  | | 今日からできる      ||
|  見出し                    |  見出し               | | [ ] Action 1       ||
|  ・箇条書き1               |  ・箇条書き1           | | [ ] Action 2       ||
|  ・箇条書き2               |  ・箇条書き2           | | [ ] Action 3       ||
|                            |                       | +-------------------+|
+================================================================+
```

### カラーパレット

| 要素 | 背景色 | 枠色 |
|------|--------|------|
| キャンバス | `#fffbeb` (暖かいオフホワイト) | - |
| タイトル | `#ffd8a8` (オレンジパステル) | `#e8590c` |
| メインメッセージ | `#fff3bf` (イエローパステル) | `#f08c00` |
| Block 1 | `#a5d8ff` (ライトブルー) | `#1971c2` |
| Block 2 | `#b2f2bb` (ライトグリーン) | `#2f9e44` |
| Block 3 | `#d0bfff` (ライトパープル) | `#7048e8` |
| Block 4 | `#ffc9c9` (ライトピンク) | `#e03131` |
| 吹き出し | `#fff9db` (ライトイエロー) | `#f59f00` |
| アクション | `#f3f0ff` (ライトパープル) | `#7048e8` |

### スタイル設定

| プロパティ | 値 | 説明 |
|------------|------|------|
| roughness | 1 | 手書き風（0=滑らか, 2=荒い） |
| fontFamily | 1 | Virgil（手書きフォント） |
| strokeWidth | 2 | 線の太さ |
| fillStyle | solid | 塗りつぶしスタイル |

### Excalidraw要素の実装パターン

**テキストバインディング（矩形 + テキスト）**:
```json
{
  "type": "rectangle",
  "id": "title-container",
  "x": 30, "y": 20, "width": 580, "height": 80,
  "boundElements": [{ "type": "text", "id": "title-text" }]
}
{
  "type": "text",
  "id": "title-text",
  "x": 320, "y": 60,
  "text": "講演タイトル",
  "containerId": "title-container",
  "textAlign": "center",
  "verticalAlign": "middle"
}
```

**吹き出し（楕円 + テキスト）**:
```json
{
  "type": "ellipse",
  "id": "bubble-1",
  "x": 940, "y": 140, "width": 440, "height": 90,
  "roughness": 2,
  "boundElements": [{ "type": "text", "id": "bubble-1-text" }]
}
{
  "type": "text",
  "id": "bubble-1-text",
  "text": "\"印象的な発言\"",
  "containerId": "bubble-1"
}
```

---

## コンポーネント分割

```
src/
├── index.ts                   # CLI エントリポイント
├── pipeline/
│   └── orchestrator.ts        # パイプライン統括
├── services/
│   ├── transcription.ts       # Amazon Transcribe ラッパー
│   ├── structuring.ts         # Amazon Bedrock Claude ラッパー
│   ├── template-engine.ts     # StructuredContent → Excalidraw JSON
│   └── exporter.ts            # Excalidraw JSON → PNG
├── templates/
│   ├── layout.ts              # 固定座標レイアウト定義
│   └── colors.ts              # カラーパレット定数
├── types/
│   ├── structured-content.ts  # Zodスキーマ + 型定義
│   └── excalidraw.ts          # Excalidraw要素の型
└── config/
    └── index.ts               # 設定読み込み
```

### 各コンポーネントの責務

| コンポーネント | 責務 | 入力 | 出力 |
|----------------|------|------|------|
| `index.ts` | CLI引数パース、設定読み込み、オーケストレーター呼び出し | CLIフラグ | - |
| `orchestrator.ts` | パイプライン統括、進捗表示、エラーハンドリング | PipelineOptions | PipelineResult |
| `transcription.ts` | S3アップロード、Transcribeジョブ管理、ポーリング | audioFilePath | transcript (string) |
| `structuring.ts` | Bedrock呼び出し、構造化出力取得、Zodバリデーション | transcript | StructuredContent |
| `template-engine.ts` | 構造化データ→Excalidraw要素マッピング | StructuredContent | ExcalidrawDocument |
| `exporter.ts` | Playwrightレンダリング、PNG書き出し | ExcalidrawDocument | PNG file path |
| `layout.ts` | 固定座標・サイズ定義 | - | LAYOUT定数 |
| `colors.ts` | カラーパレット定義 | - | COLORS定数 |
| `structured-content.ts` | Zodスキーマ、TypeScript型 | - | 型 + スキーマ |
| `excalidraw.ts` | Excalidraw要素のTypeScript型 | - | 型定義 |
| `config/index.ts` | .env + CLIフラグの統合設定 | 環境変数 | Config |

---

## 設定

### 環境変数 (.env)

| 変数 | 必須 | デフォルト | 説明 |
|------|------|-----------|------|
| `AWS_REGION` | No | `ap-northeast-1` | AWSリージョン (Transcribe + S3) |
| `AWS_S3_BUCKET` | Yes | - | 音声アップロード用S3バケット |
| `AWS_S3_KEY_PREFIX` | No | `talkcapital/audio/` | S3キープレフィックス |
| `BEDROCK_MODEL_ID` | No | `anthropic.claude-sonnet-4-20250514-v1:0` | BedrockモデルID |
| `BEDROCK_REGION` | No | `us-east-1` | Bedrock用リージョン |

AWS認証情報はAWS標準の方法で解決（環境変数, IAMロール, AWS SSO等）。

### CLIフラグ

| フラグ | デフォルト | 説明 |
|--------|-----------|------|
| `--input` | (必須) | 音声ファイルパス |
| `--output` | `./output/graphic-recording.png` | 出力先 |
| `--format` | `png` | `png` or `excalidraw` |
| `--skip-transcribe` | false | 文字起こしスキップ |
| `--transcript` | - | 既存文字起こしファイルパス |
| `--scale` | 2 | PNGスケール倍率 |
| `--verbose` | false | デバッグログ |

---

## 依存パッケージ

### ランタイム

| パッケージ | 用途 |
|------------|------|
| `commander` | CLI引数パース |
| `@aws-sdk/client-s3` | S3アップロード |
| `@aws-sdk/client-transcribe` | バッチ文字起こし |
| `@aws-sdk/client-bedrock-runtime` | Bedrock Claude 呼び出し |
| `zod` | ランタイムスキーマ検証 |
| `nanoid` | 要素ID生成 |
| `playwright` | ヘッドレスPNGエクスポート |
| `dotenv` | 環境変数 |

### 開発

| パッケージ | 用途 |
|------------|------|
| `typescript` | 言語 |
| `vitest` | テスト |
| `eslint` | リンター |
| `prettier` | フォーマッター |
| `@excalidraw/excalidraw` | Excalidrawレンダラー (export/index.htmlで使用) |
