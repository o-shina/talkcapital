# ExecPlan: TalkCapital 品質改善とPR準備

## 基本情報
- 日付: 2026-02-22
- ブランチ: `feature/1-bootstrap-20260222`
- 優先ルール: `AGENTS.md`（`.agent/PLANS.md` はリポジトリ内で未検出）
- スコープ: 進捗表示改善、README補完、テスト安定化、Issue/PR/CI確認

## 既知の制約
- `entire` は利用可能だが `checkpoint` サブコマンドは未提供（`unknown command "checkpoint"`）。
- ネットワークは不安定の可能性があるため、GitHub操作はローカル作業完了後にまとめて実施する。
- この実行環境では Playwright ブラウザ起動が権限制約で失敗する場合がある。

## マイルストーン
1. M1: 初期検証と計画固定
2. M2: コード品質改善（進捗表示・README・テスト安定化）
3. M3: ローカル検証、証跡更新、コミット
4. M4: GitHub Issue/PR作成とCI green確認
5. M5: 最終サマリ更新

## 受け入れ条件
- `npm run build && npm run lint && npm run test` が成功。
- 進捗ログが `--verbose` 無しでも主要ステージを表示。
- README にセットアップ、必要AWS権限、使い方が明記されている。
- 改善Issueが最低2件（Excalidraw公式レンダラー、進捗表示改善）作成済み。
- `feature/1-bootstrap-20260222 -> main` のPRが作成され、CIがgreen。

## 検証コマンド
- `npm run build`
- `npm run lint`
- `npm run test`
- `git status --short`
- `gh issue list --limit 20`
- `gh pr view --json number,state,headRefName,baseRefName,url,statusCheckRollup`

## リスクと緩和策
- Playwright依存テストが環境依存で不安定:
  - 緩和: exporterの単体テストをモック中心にし、E2Eは別レイヤー化。
- ネットワーク不通で `gh` 操作失敗:
  - 緩和: 実行コマンドを本ExecPlanに残し、復旧後に再実施可能にする。

## ロールバック
- 変更はマイルストーンごとにコミットし、問題時は `git revert <commit>` で戻せる状態を維持する。

## 意思決定ログ
- 2026-02-22: `.agent/PLANS.md` は未検出。`AGENTS.md` と本ExecPlanを運用基準に採用。
- 2026-02-22: `entire checkpoint` 非対応のため、以後のチェックポイントはスキップしDecision Logに記録する。

## 進捗ログ
- [x] M1: 初期検証と計画固定
- [x] M2: コード品質改善（進捗表示・README・テスト安定化）
- [x] M3: ローカル検証、証跡更新、コミット
- [ ] M4: GitHub Issue/PR作成とCI green確認
- [ ] M5: 最終サマリ更新

## 証跡ログ
- 2026-02-22 M1:
  - `export GH_TOKEN=$(grep '^GITHUB_TOKEN=' .env.local | cut -d'=' -f2)` 実施（値の出力は未実施）。
  - `npm run build && npm run lint && npm run test` 実施し、`build/lint` は成功、`test` は `test/services/exporter.test.ts` がPlaywright起動権限エラーで失敗。
  - `entire checkpoint -m "M0: 初期検証"` は `unknown command "checkpoint"` で失敗。
- 2026-02-22 M2:
  - `src/pipeline/orchestrator.ts`: 主要ステージログを常時表示に変更（`--verbose` 非依存）。
  - `test/pipeline/orchestrator.test.ts`: 非verbose時の主要ステージ表示を検証するテスト追加。
  - `test/services/exporter.test.ts`: Playwright実起動依存を除去し、モックベースの単体テストに変更。
  - `README.md`: 前提条件、最小IAMポリシー例、実行ログ仕様を追記。
- 2026-02-22 M3:
  - `npm run build && npm run lint && npm run test` を再実行し、7ファイル/15テストすべて成功。

## ネットワーク復旧後の手順
- `export GH_TOKEN=$(grep '^GITHUB_TOKEN=' .env.local | cut -d'=' -f2)`
- `gh issue create ...`（本ExecPlanのM4に記載する各Issue）
- `gh pr create --base main --head feature/1-bootstrap-20260222 ...`
- `gh pr view --json statusCheckRollup`
