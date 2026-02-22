# CLAUDE.md

## コーディング規約
- TypeScript strict / ESM(NodeNext)
- サービス分離: `transcription`, `structuring`, `template-engine`, `exporter`
- 文字列制約・構造制約は `structured-content.ts` を唯一の真実源にする

## テスト方針
- Vitestを使用
- サービス単位テストはAWS SDKをモック化
- AWS実環境疎通は手動E2Eで実施

## アーキテクチャ参照
- `docs/PRD.md`
- `docs/architecture.md`
- `docs/tasks.md`
