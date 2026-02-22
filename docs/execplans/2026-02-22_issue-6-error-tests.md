# ExecPlan: Issue #6 異常系テスト拡充

## 目的
- タイムアウトやネットワーク異常時の挙動をテストで担保する。

## 対象Issue
- #6 テスト強化: タイムアウト・ネットワーク異常時の異常系テスト追加

## マイルストーン
1. 異常系シナリオの選定とテスト設計
2. 異常系テスト実装（transcription/structuring/exporter）
3. ローカル検証（build/lint/test）
4. PR作成・CI確認・mainマージ

## 受け入れ条件
- タイムアウト、ネットワーク失敗、HTTPエラーなどの異常系テストが追加される。
- 既存テストを含めて `npm run build && npm run lint && npm run test` が成功する。
- PR CI greenでmainへマージされる。

## 検証コマンド
- `npm run build`
- `npm run lint`
- `npm run test`

## リスクと緩和策
- リスク: 非同期待機でテストが不安定化
- 緩和: 依存注入済みの`wait`/`fetchImpl`モックで同期的に制御する。

## ロールバック
- 不安定化した場合は追加テストのみrevertする。

## 既知の制約
- 外部実環境（AWS/OpenRouter）へのE2Eは対象外。
- `entire checkpoint` サブコマンドは未提供のため、Gitコミットをチェックポイントとして扱う。

## 意思決定ログ
- 2026-02-22: 実処理変更ではなく、既存実装の失敗時挙動をテストで固定する方針を採用。

## 進捗ログ
- [x] M1: 異常系シナリオの選定とテスト設計
  - 対象: transcription（HTTP失敗/タイムアウト）, structuring（OpenRouter HTTP失敗）, exporter（レンダリング失敗時close）
- [x] M2: 異常系テスト実装（transcription/structuring/exporter）
  - 変更: `test/services/transcription.test.ts`, `test/services/structuring.test.ts`, `test/services/exporter.test.ts`
- [x] M3: ローカル検証（build/lint/test）
  - 実行: `npm run build && npm run lint && npm run test`
  - 要点: build/lint/test すべて成功（7 test files / 23 tests passed）
- [ ] M4: PR作成・CI確認・mainマージ

## ネットワーク復旧後の手順
- ネットワーク不通が発生した場合のみ記録する。
