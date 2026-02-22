# ExecPlan: Issue #1 Excalidraw公式レンダラー移行

## 目的
- 独自Canvas2D描画を廃止し、`@excalidraw/excalidraw` の公式エクスポート経路でPNGを生成する。

## 対象Issue
- #1 MVP改善: Excalidraw公式レンダラー移行（Playwright + @excalidraw/excalidraw）

## マイルストーン
1. 依存追加とレンダリング方式の設計反映
2. exporter実装の置換（公式`exportToBlob`利用）
3. テスト更新とローカル検証
4. PR作成・CI確認・mainマージ

## 受け入れ条件
- `export/index.html` が独自Canvas2D描画ロジックを持たない。
- Playwright経由で`@excalidraw/excalidraw`の`exportToBlob`を利用してPNGを生成する。
- `npm run build && npm run lint && npm run test` が成功する。
- PR CI greenでmainへマージされる。

## 検証コマンド
- `npm run build`
- `npm run lint`
- `npm run test`

## リスクと緩和策
- リスク: ブラウザ側モジュール解決の失敗
- 緩和: ローカル`node_modules`配下を`file://`で直接読み込む方式に限定し、CDN依存を避ける。
- リスク: `@excalidraw/excalidraw` のAPI差分
- 緩和: エクスポート関数の存在チェックと明確なエラーメッセージを実装する。

## ロールバック
- 互換性問題が発生した場合は本変更をrevertし、旧レンダラーへ戻す。

## 既知の制約
- `entire checkpoint` サブコマンドが未提供のため、Gitコミットをチェックポイントとして扱う。
- CIはPlaywright chromiumをインストール済みで動作する前提。

## 意思決定ログ
- 2026-02-22: CDN依存を避けるため、`node_modules/@excalidraw/excalidraw/dist` のローカルモジュールを読み込む方針を採用。

## 進捗ログ
- [x] M1: 依存追加とレンダリング方式の設計反映
  - 実行: `NPM_CONFIG_CACHE=/tmp/talkcapital-npm-cache npm install @excalidraw/excalidraw`
  - 要点: `@excalidraw/excalidraw` を追加し、型定義上 `exportToBlob` 利用可能を確認
- [x] M2: exporter実装の置換（公式`exportToBlob`利用）
  - 実行: `export/index.html` を全面更新
  - 要点: 独自Canvas2D描画ロジックを削除し、公式 `exportToBlob` ベースへ移行
- [x] M3: テスト更新とローカル検証
  - 実行: `npm run build && npm run lint && npm run test`
  - 要点: build/lint/test すべて成功（7 test files / 15 tests passed）
- [ ] M4: PR作成・CI確認・mainマージ

## ネットワーク復旧後の手順
- ネットワーク不通が発生した場合のみ記録する。
