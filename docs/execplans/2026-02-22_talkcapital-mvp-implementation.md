# ExecPlan: TalkCapital MVP 実装

## 基本情報
- 日付: 2026-02-22
- ブランチ: `feature/1-bootstrap-20260222`
- 対象: docs/tasks.md の Task 1-14
- 参照: `docs/PRD.md`, `docs/architecture.md`, `docs/tasks.md`, `AGENTS.md`

## 既知の制約
- このワークスペースには `.agent/PLANS.md` が存在しない（`find` で確認）。
- GitHub API へのネットワーク接続が不可（`gh issue create` が `error connecting to api.github.com`）。
- npmキャッシュディレクトリ `~/.npm` が root 所有ファイルを含み、`npx`/`npm` の通常実行が失敗する（EPERM）。
- `entire` は利用可能だが `checkpoint` サブコマンド未実装（`unknown command "checkpoint"`）。
- そのため Issue/PR/CI のリモート操作および依存導入を伴う検証は未達。ローカルで編集可能な範囲を優先し、再接続・権限修正後に反映する。

## マイルストーン
1. M1: プロジェクト基盤・型・設定（Task 1-4）
2. M2: サービス実装（Task 5-8）
3. M3: パイプライン統合とCLI（Task 9-10,13）
4. M4: テスト・フィクスチャ・ドキュメント・CI定義（Task 11-12,14 + Actions）
5. M5: DoD検証と最終記録

## 受け入れ条件
- `npx talkcapital generate --skip-transcribe --transcript test/fixtures/sample-transcript.txt --output /tmp/test.png` で PNG(3840x2160) を生成。
- `npx talkcapital generate --input <audio> --output /tmp/test.png` で全パイプラインが実行可能（AWS認証前提）。
- `npm run test` が green で、`transcription/structuring/template-engine/exporter` 各サービスのモック付きテストが存在。
- GitHub Actions に lint/test ワークフローを追加（リモート実行確認はネットワーク復旧後）。

## 検証コマンド
- `npm run build`
- `npm run lint`
- `npm run test`
- `npx talkcapital generate --skip-transcribe --transcript test/fixtures/sample-transcript.txt --output /tmp/test.png`
- `file /tmp/test.png`
- `node -e "...PNG寸法検証..."`

## リスクと緩和策
- Bedrock Converse toolUse 応答形式の差異: パーサを防御的に実装し、テストで複数形式を検証。
- Playwright + Excalidraw の描画不安定: `export/index.html` を最小責務化し、待機条件を明示。
- AWS 結合テスト不能: 単体テストはSDKモックを徹底し、E2E手順をREADMEに記載。

## ロールバック
- 破壊的操作を避け、機能単位コミットを積む。
- 問題発生時は最新マイルストーン単位で `git revert <commit>` を適用。

## 意思決定ログ
- 2026-02-22: `.agent/PLANS.md` が見つからないため、本ExecPlanを自己完結で作成。
- 2026-02-22: GitHub API が到達不能。選択肢:
  1. 待機してIssue/PR作成を後回し
  2. ローカル実装のみ先行し、復旧後にIssue/PR同期（採用）
  3. 実装中止
  安全で後戻りしやすい 2 を採用。
- 2026-02-22: `entire checkpoint` が使えないため、Decision Log に「Entire CLI 未検出相当（checkpoint機能未提供）のためスキップ」を記録し、Gitコミットを正のチェックポイントとして扱う。
- 2026-02-22: `docs/tasks.md` との差分として `--format (png|excalidraw)` 未実装を確認。M3完了条件に合わせ、CLIとオーケストレーターにJSON出力経路を追加。

## 進捗ログ
- [x] M0: 調査完了
- [x] M1: プロジェクト基盤・型・設定（既存実装確認）
- [x] M2: サービス実装（既存実装確認）
- [x] M3: パイプライン統合とCLI（`--format` 対応を追加）
- [x] M4: テスト・フィクスチャ・ドキュメント・CI定義（既存定義確認 + README追記）
- [ ] M5

## 証跡ログ
- 2026-02-22 調査:
  - `sed -n` で `AGENTS.md`, `docs/*` を確認
  - `.agent/PLANS.md` 不在
  - `gh issue create` 実行時にネットワークエラー
- 2026-02-22 実装:
  - `src/index.ts`: `--format <png|excalidraw>` 追加、値バリデーション追加
  - `src/pipeline/orchestrator.ts`: `outputFormat` 追加、`excalidraw` 指定時はJSON保存
  - `test/pipeline/orchestrator.test.ts`: `format=excalidraw` 保存テスト追加
  - `README.md`: JSON出力サンプルと `--format` オプション記載
- 2026-02-22 検証試行:
  - `npm run build` -> `sh: tsc: command not found`（依存未導入）
  - `npm run lint` -> `sh: eslint: command not found`（依存未導入）
  - `npm run test` -> `sh: vitest: command not found`（依存未導入）
  - `npx talkcapital generate ...` -> `EPERM`（`~/.npm` 権限問題）
  - `entire checkpoint -m ...` -> `unknown command "checkpoint"`（機能未提供）

## 最終サマリ（完了時更新）
- 変更点:
  - `docs/tasks.md` のTask 10/9要件に合わせ、`png` に加えて `excalidraw` 出力をCLIから選択可能にした。
  - オーケストレーターの出力ステージを形式分岐化し、JSONエクスポート経路を追加。
  - 統合テストに JSON 出力経路の検証を追加。
  - README の利用例とオプション説明を更新。
- 検証方法:
  - 依存導入後に `npm run build && npm run lint && npm run test`
  - `npx talkcapital generate --skip-transcribe --transcript test/fixtures/sample-transcript.txt --output /tmp/test.png`
  - `npx talkcapital generate --skip-transcribe --transcript test/fixtures/sample-transcript.txt --format excalidraw --output /tmp/test.excalidraw.json`
- 既知の制限:
  - 現環境では GitHub API 到達不能のため Issue/PR/CI 実行結果を取得不可。
  - npmキャッシュ権限問題により依存導入および実行検証が未了。
  - Entire CLI は `checkpoint` コマンド非対応のため手動記録運用。
- フォローアップ:
  - `sudo chown -R $(id -u):$(id -g) ~/.npm` 実施後に依存導入を再試行。
  - ネットワーク復旧後に `gh` で Issue/PR を作成し、CI green を確認してマージ。
