# ExecPlan: Issue #2 OpenRouter対応

## 目的
- LLMプロバイダーを Bedrock / OpenRouter で切り替え可能にする。

## 対象Issue
- #2 MVP後タスク: OpenRouter対応

## マイルストーン
1. 設定モデル拡張（`LLM_PROVIDER`とOpenRouter環境変数）
2. 構造化サービスのプロバイダー分岐実装
3. テスト・README・.env.example更新とローカル検証
4. PR作成・CI確認・mainマージ

## 受け入れ条件
- `LLM_PROVIDER=bedrock|openrouter` で構造化処理が切り替わる。
- OpenRouter時に `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` を利用する。
- `npm run build && npm run lint && npm run test` が成功する。
- PR CI greenでmainへマージされる。

## 検証コマンド
- `npm run build`
- `npm run lint`
- `npm run test`

## リスクと緩和策
- リスク: OpenRouterレスポンスJSON形式の揺れ
- 緩和: 文字列JSON/オブジェクトの双方を受け取り、Zodで最終検証する。
- リスク: 設定不備による実行時失敗
- 緩和: `loadConfig()` で provider別必須値を事前検証する。

## ロールバック
- 問題が発生した場合は本変更をrevertし、Bedrock専用構成に戻す。

## 既知の制約
- OpenRouter本番疎通はE2E未実施（ユニットテストはHTTPモック）。
- `entire checkpoint` サブコマンドは未提供のため、Gitコミットをチェックポイントとして扱う。

## 意思決定ログ
- 2026-02-22: OpenRouterはChat Completions API + `response_format.json_schema` を採用し、既存StructuredContentスキーマを再利用する。

## 進捗ログ
- [x] M1: 設定モデル拡張（`LLM_PROVIDER`とOpenRouter環境変数）
  - 変更: `src/config/index.ts` に provider切替とOpenRouter必須値の検証を追加
- [x] M2: 構造化サービスのプロバイダー分岐実装
  - 変更: `src/services/structuring.ts` に Bedrock/OpenRouter分岐とOpenRouterリトライ実装を追加
- [x] M3: テスト・README・.env.example更新とローカル検証
  - 変更: `test/services/structuring.test.ts`, `test/config.test.ts`, `test/pipeline/orchestrator.test.ts`, `test/services/transcription.test.ts`, `README.md`, `.env.example`
  - 実行: `npm run build && npm run lint && npm run test`
  - 要点: build/lint/test すべて成功（7 test files / 19 tests passed）
- [ ] M4: PR作成・CI確認・mainマージ

## ネットワーク復旧後の手順
- ネットワーク不通が発生した場合のみ記録する。
