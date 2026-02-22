# 実装タスク分解

## Phase 1: プロジェクト基盤（依存なし、並列実行可）

### Task 1: プロジェクト初期化 [S]

**ゴール**: ビルド・テスト・リントが通る空プロジェクト

**作業内容**:
- `package.json` 作成（name: talkcapital, type: module）
- `tsconfig.json` 作成（strict, ES2022, NodeNext）
- 依存パッケージインストール:
  - ランタイム: commander, @aws-sdk/client-s3, @aws-sdk/client-transcribe, @aws-sdk/client-bedrock-runtime, zod, nanoid, playwright, dotenv
  - 開発: typescript, vitest, eslint, prettier, @excalidraw/excalidraw
- `.env.example` 作成
- ESLint + Prettier設定
- `src/index.ts` に最小限のエントリポイント（`console.log("hello")` レベル）
- `npx playwright install chromium` でブラウザセットアップ
- `vitest` で空テストが通ることを確認

**完了条件**: `npm run build`, `npm run test`, `npm run lint` が全てパス

---

### Task 2: 型定義・スキーマ [S]

**ゴール**: 全サービスが参照する共通型が定義されている

**作業内容**:
- `src/types/structured-content.ts`:
  - Zodスキーマ定義（structuredContentSchema）
  - TypeScript型エクスポート（StructuredContent）
  - JSONスキーマ変換ユーティリティ（Bedrock toolUse用）
- `src/types/excalidraw.ts`:
  - Excalidraw要素の型定義（ExcalidrawElement, ExcalidrawDocument等）
  - 各要素タイプ: rectangle, text, ellipse, arrow, line

**完了条件**: `import { StructuredContent } from "./types/structured-content"` が型チェックを通る。Zodスキーマでサンプルデータのバリデーションが通る。

**参照**: `docs/architecture.md` の「構造化JSONスキーマ」セクション

---

### Task 3: レイアウト定数 [S]

**ゴール**: テンプレートエンジンが参照する固定座標・スタイルが定義されている

**作業内容**:
- `src/templates/layout.ts`:
  - CANVAS定数 (width: 1920, height: 1080)
  - LAYOUT定数（各エリアの座標・サイズ）
    - title: { container: {x,y,w,h}, text: {fontSize, textAlign} }
    - mainMessage: 同上
    - blocks[0..3]: { container, heading, bullets }
    - speechBubbles[0..3]: { container, fontSize }
    - actions: { container, headerText, items[0..2] }
- `src/templates/colors.ts`:
  - COLORS定数（カラーパレット）
  - STYLE定数（roughness, fontFamily, strokeWidth）

**完了条件**: 定数がエクスポートされ、型がつく

**参照**: `docs/architecture.md` の「Excalidraw テンプレートレイアウト」セクション

---

### Task 4: 設定モジュール [S]

**ゴール**: 環境変数とCLIフラグを統合した設定オブジェクトが取得できる

**作業内容**:
- `src/config/index.ts`:
  - dotenvで.envを読み込み
  - Config型定義:
    ```typescript
    interface Config {
      aws: { region: string; s3Bucket: string; s3KeyPrefix: string; };
      bedrock: { modelId: string; region: string; };
      output: { scale: number; };
    }
    ```
  - `loadConfig()` 関数（env → Config変換、デフォルト値適用、必須項目チェック）

**完了条件**: `loadConfig()` が正しいConfig を返す。必須項目（AWS_S3_BUCKET）が未設定時にエラーを投げる。

---

## Phase 2: 各サービス実装（Phase 1完了後、サービス間は並列可）

### Task 5: Transcriptionサービス [M]

**ゴール**: 音声ファイルパスを渡すと文字起こしテキストが返る

**作業内容**:
- `src/services/transcription.ts`:
  - `transcribeAudio(audioFilePath, config)` 関数
  - S3アップロード（PutObjectCommand）
  - Transcribeジョブ開始（StartTranscriptionJobCommand）
  - ポーリング（GetTranscriptionJobCommand, 5秒間隔, 最大5分）
  - 結果JSON取得・テキスト抽出
  - エラーハンドリング（タイムアウト、ジョブ失敗）
- `test/services/transcription.test.ts`:
  - AWS SDKモック付きテスト
  - 正常系: アップロード→ジョブ開始→ポーリング→テキスト取得
  - 異常系: タイムアウト、ジョブ失敗、S3エラー

**完了条件**: モック付きテストが全パス。実際のAWS環境でのテストはE2Eに委ねる。

---

### Task 6: Structuringサービス [M]

**ゴール**: 文字起こしテキストを渡すとStructuredContentが返る

**作業内容**:
- `src/services/structuring.ts`:
  - `structureTranscript(transcript, config)` 関数
  - BedrockRuntimeClient 初期化（BEDROCK_REGION使用）
  - ConverseCommand 組み立て:
    - system: システムプロンプト（捏造禁止・短文化等のルール）
    - messages: ユーザーメッセージ（文字起こしテキスト）
    - toolConfig: structured_output ツール定義（JSONスキーマ）
    - toolChoice: { tool: { name: "structured_output" } }
  - レスポンスからtoolUse input を抽出
  - Zodスキーマでバリデーション
  - 失敗時リトライ（エラーメッセージをフィードバック、最大2回）
- `test/services/structuring.test.ts`:
  - Bedrockレスポンスモック付きテスト
  - 正常系: 有効なtoolUse応答 → StructuredContent返却
  - 異常系: スキーマ検証失敗 → リトライ、APIエラー → リトライ

**完了条件**: モック付きテストが全パス。

---

### Task 7: テンプレートエンジン [L] (最重要タスク)

**ゴール**: StructuredContentを渡すと完全なExcalidraw JSONドキュメントが返る

**作業内容**:
- `src/services/template-engine.ts`:
  - `renderToExcalidraw(content: StructuredContent): ExcalidrawDocument`
  - 要素ID生成（nanoid）
  - タイトル生成: rectangle + boundText
  - メインメッセージ生成: rectangle + boundText
  - ブロック生成（3〜4個対応）:
    - 各ブロック: 背景rectangle + 見出しtext + 箇条書きtext × N
    - 箇条書きの「・」プレフィックス自動付与
  - 吹き出し生成（1〜4個対応）:
    - 各吹き出し: ellipse + boundText
    - 引用符「"..."」の自動付与
  - アクションエリア生成:
    - 背景rectangle + ヘッダーtext
    - チェックボックスrectangle + アクションtext × 3
  - 全要素のスタイル適用（roughness, fontFamily, strokeWidth, colors）
  - ExcalidrawDocument として組み立て（type, version, elements, appState）
- `test/services/template-engine.test.ts`:
  - 3ブロック入力: 要素数、各IDのユニーク性、座標の妥当性
  - 4ブロック入力: Block 4が正しく配置
  - 1吹き出し入力: 残りスロットが空
  - テキストバインディングの整合性（containerId ↔ boundElements）
  - カラー・スタイルの正確性

**完了条件**: 全テストパス。サンプルデータで生成したExcalidraw JSONをExcalidrawエディタで開いて目視確認。

---

### Task 8: PNGエクスポーター [M]

**ゴール**: Excalidraw JSONを渡すとPNGファイルが生成される

**作業内容**:
- `export/index.html`:
  - Excalidrawレンダラーを読み込むHTMLページ
  - `window.renderAndExport(elements, appState, scale)` 関数を公開
  - exportToBlob → Base64変換 → window.exportedData に格納
- `src/services/exporter.ts`:
  - `exportToPng(excalidrawDoc, outputPath, scale)` 関数
  - Playwright chromium.launch()
  - page.goto(export/index.html)
  - page.evaluate() で renderAndExport 呼び出し
  - Base64 → Buffer → fs.writeFile
  - ブラウザclose
- `test/services/exporter.test.ts`:
  - 最小限のExcalidraw JSON（矩形1個 + テキスト1個）でPNG生成
  - 出力ファイルが存在し、サイズ > 0
  - PNG ヘッダーバイトの検証

**完了条件**: テストパス。生成PNGが正しくレンダリングされていることを目視確認。

---

## Phase 3: 統合（Phase 2全タスク完了後）

### Task 9: オーケストレーター [M]

**ゴール**: 全サービスを順番に呼び出すパイプラインが動く

**作業内容**:
- `src/pipeline/orchestrator.ts`:
  - `runPipeline(options: PipelineOptions): Promise<PipelineResult>`
  - PipelineOptions: { inputAudioPath, outputPath, outputFormat, transcriptOverride?, verbose? }
  - PipelineResult: { outputPath, transcript, structuredContent, timings }
  - 各ステージの呼び出し順序:
    1. transcribeAudio (skip if transcriptOverride)
    2. structureTranscript
    3. renderToExcalidraw
    4. exportToPng (or save Excalidraw JSON if format=excalidraw)
  - 進捗表示（`[1/4] S3にアップロード中...`）
  - 各ステージのタイミング計測
  - エラーハンドリング（ステージ名 + エラーメッセージ）
- `test/pipeline/orchestrator.test.ts`:
  - 全サービスモック付き統合テスト
  - --skip-transcribe フロー
  - エラー時のハンドリング確認

**完了条件**: モック付き統合テストがパス。

---

### Task 10: CLIエントリポイント [S]

**ゴール**: `npx talkcapital generate --input ... --output ...` で動く

**作業内容**:
- `src/index.ts`:
  - commander で generate サブコマンド定義
  - フラグ: --input, --output, --format, --skip-transcribe, --transcript, --scale, --verbose
  - loadConfig() → runPipeline() → 結果表示
  - エラー時: エラーメッセージ表示 + process.exit(1)
- `package.json`:
  - `"bin": { "talkcapital": "./dist/index.js" }`
  - `"scripts": { "build": "tsc", "start": "node dist/index.js" }`

**完了条件**: `npm run build && node dist/index.js generate --help` が使い方を表示。

---

## Phase 4: テスト・仕上げ（Phase 3完了後）

### Task 11: テストフィクスチャ [S]

**ゴール**: 各テストで使う現実的なサンプルデータが揃っている

**作業内容**:
- `test/fixtures/sample-transcript.txt`: 15分講演の文字起こしサンプル（心理的安全性テーマ）
- `test/fixtures/sample-structured.json`: 上記文字起こしから生成されるStructuredContent
- `test/fixtures/sample-excalidraw.json`: 上記StructuredContentから生成されるExcalidraw JSON

**完了条件**: 各フィクスチャがスキーマバリデーションを通過。

---

### Task 12: E2Eテスト [M]

**ゴール**: 実環境で全パイプラインが動作する

**作業内容**:
- 実際の15分日本語音声ファイルを用意（or テスト用の短い音声）
- 全パイプラインを通してPNG生成
- PNG出力の目視確認
- タイミングの計測と記録
- 発見した問題のレイアウト調整

**完了条件**: 実音声でPNGが生成され、可読性のある出力が得られる。

---

### Task 13: --skip-transcribe 実装 [S]

**ゴール**: 既存の文字起こしファイルからパイプラインを途中実行できる

**作業内容**:
- `--skip-transcribe` フラグが指定された場合:
  - `--transcript` フラグで指定されたファイルからテキストを読み込み
  - Stage 1, 2 をスキップしてStage 3 から実行
- テスト/デモ時の繰り返し実行に便利

**完了条件**: `--skip-transcribe --transcript sample.txt` でPNG生成できる。

---

### Task 14: README・ドキュメント [S]

**ゴール**: 初見のユーザーがセットアップ〜実行できるREADME

**作業内容**:
- `README.md`:
  - プロジェクト概要
  - セットアップ手順（npm install, playwright install, .env設定）
  - 必要なAWS権限（Transcribe, Bedrock, S3）
  - 使い方（generate コマンド、各フラグ）
  - 講演当日のデモ手順
  - 開発者向け（ビルド、テスト、リント）
- `CLAUDE.md`:
  - プロジェクト固有のコーディング規約
  - テスト方針
  - アーキテクチャの概要リンク

**完了条件**: README通りにセットアップ・実行できる。

---

## タスク依存関係

```
Phase 1 (並列可):
  Task 1 ──┐
  Task 2 ──┼── Phase 2 へ
  Task 3 ──┤
  Task 4 ──┘

Phase 2 (サービス間は並列可):
  Task 5 (Transcription) ──┐
  Task 6 (Structuring)   ──┼── Phase 3 へ
  Task 7 (Template)       ──┤
  Task 8 (Exporter)       ──┘

Phase 3 (順序あり):
  Task 9 (Orchestrator) ── Task 10 (CLI) ── Phase 4 へ

Phase 4 (並列可):
  Task 11 (Fixtures)
  Task 12 (E2E)
  Task 13 (Skip flag)
  Task 14 (README)
```

---

## デモ手順（講演当日）

### 事前準備（前日 or 当日朝）
1. `node --version` で Node.js 18+ を確認
2. `npx talkcapital --help` で動作確認
3. AWS認証情報の設定確認（Transcribe + Bedrock + S3 の権限）
4. テスト音声で空運転: `npx talkcapital generate --input test.m4a --output test.png`

### 講演中
5. スマホ or PCで音声録音（m4a/mp3推奨）

### 講演直後（5分以内で完了）
6. 音声ファイルをPCに転送（AirDrop等）
7. 実行:
   ```bash
   npx talkcapital generate \
     --input ~/Downloads/lecture.m4a \
     --output ~/Desktop/grako.png
   ```
8. CLI進捗表示:
   ```
   [1/4] S3にアップロード中... 完了 (3秒)
   [2/4] 文字起こし中... 完了 (2分15秒)
   [3/4] 構造化中... 完了 (8秒)
   [4/4] PNG生成中... 完了 (3秒)

   出力: ~/Desktop/grako.png (2分29秒)
   ```
9. PNG確認。不満なら `--skip-transcribe` で構造化からやり直し

### ネットワーク障害時
- 音声ファイルはローカルに保持
- ネットワーク復旧後に実行すればOK
- 講演の成立には影響しない
