# Repository Guidelines

## Project Structure & Module Organization
This repository is currently documentation-first. Core project docs live in `docs/`:
- `docs/PRD.md`: product scope and MVP constraints.
- `docs/architecture.md`: target TypeScript CLI architecture and AWS pipeline.
- `docs/tasks.md`: phased implementation plan.

When implementation starts, follow the planned layout in `docs/tasks.md`:
- `src/` for CLI, pipeline orchestration, services, templates, and config.
- `test/` for unit/integration tests (`*.test.ts`).
- `export/` for Playwright-based rendering assets.

## Build, Test, and Development Commands
There is no runnable app scaffold yet (no `package.json` at this time).
Use these commands for current contribution flow:
- `rg --files docs` to inspect documentation files quickly.
- `sed -n '1,200p' docs/architecture.md` to review design details before editing.
- `git status` to verify only intended files changed.

After project initialization, standard commands are expected to be:
- `npm run build` (TypeScript compile)
- `npm run test` (Vitest)
- `npm run lint` (ESLint)

## Coding Style & Naming Conventions
Author docs in clear, concise Markdown with explicit headings and short sections.
For upcoming TypeScript code, follow architecture guidance:
- strict TypeScript (`ES2022`, `NodeNext`), ESM modules.
- File names in kebab-case (for modules) and descriptive domain names (for services).
- Keep pipeline stages isolated (`transcription`, `structuring`, `template-engine`, `exporter`).

## Testing Guidelines
Current state: doc changes should be validated by consistency checks against `docs/PRD.md` and `docs/architecture.md`.
When tests are introduced:
- Use Vitest.
- Place tests under `test/` with `*.test.ts` naming.
- Add service-level tests with SDK mocks; reserve AWS calls for explicit E2E runs.

## Commit & Pull Request Guidelines
No commit history exists yet, so adopt a conventional style now:
- Commit format: `type(scope): summary` (example: `docs(architecture): clarify bedrock region config`).
- Keep commits focused and atomic.
- PRs should include: purpose, changed files, verification steps, and any follow-up tasks.
- For behavior/output changes, include before/after examples (CLI output or generated artifact notes).
