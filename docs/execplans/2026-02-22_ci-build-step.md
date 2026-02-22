# ExecPlan: Issue #5 CIにbuildステップを追加

## 目的
- CIで`npm run build`を実行し、型エラーの検出漏れを防ぐ。

## 対象Issue
- #5 CI改善: buildステップを必須化して型エラー検出漏れを防止

## マイルストーン
1. 現状確認とCI定義の修正
2. ローカル検証（build/lint/test）
3. PR作成・CI確認・mainマージ

## 受け入れ条件
- `.github/workflows/ci.yml` が `install -> build -> lint -> test` を実行する。
- ローカルで `npm run build && npm run lint && npm run test` が成功する。
- PRのCIがgreenでmainへマージされる。

## 検証コマンド
- `npm run build`
- `npm run lint`
- `npm run test`

## リスクと緩和策
- リスク: CI時間増加
- 緩和: buildを最小構成のまま追加し、不要ステップは増やさない。

## ロールバック
- CIが不安定化した場合、当該コミットをrevertして従来構成へ戻す。

## 既知の制約
- GitHub Projects(classic)関連の`gh`表示エラー回避のため、`gh issue view --json ...`で必要項目のみ取得する。
- 初期作業ディレクトリに未コミット変更があるため、本タスクは`/tmp/talkcapital-main-clone`で実施する。

## 意思決定ログ
- 2026-02-22: `.agent/PLANS.md` はリポジトリ内に存在せず。`AGENTS.md`とユーザー指示を最優先に適用。
- 2026-02-22: 元作業ツリーの`PROMPT.txt`未コミット変更を保護するため、`/tmp`クローンで実施。
- 2026-02-22: `entire` は検出されたが `entire checkpoint` が未実装（unknown command）。以降のチェックポイントはスキップし、Gitコミットをチェックポイントとして扱う。

## 進捗ログ
- [x] M1: 現状確認とCI定義の修正
  - 実行: `sed -n '1,220p' .github/workflows/ci.yml`
  - 変更: `Build` ステップ（`npm run build`）を追加
- [x] M2: ローカル検証（build/lint/test）
  - 実行: `npm run build && npm run lint && npm run test`
  - 要点: build/lint/test すべて成功（7 test files / 15 tests passed）
- [ ] M3: PR作成・CI確認・mainマージ

## ネットワーク復旧後の手順
- ネットワーク不通が発生した場合のみ記録する。
