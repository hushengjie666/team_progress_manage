# Repository Guidelines

## Project Structure & Module Organization

TimeManage is a Vite + React + TypeScript app with a Tauri desktop shell and Go sync service.

- `src/`: React UI, domain logic, storage, sync, notifications, and styles.
- `src/components/`: feature views and shared UI components.
- `src-tauri/`: Rust/Tauri desktop application, permissions, icons, and build output.
- `sync-server/`: Go HTTP sync service, service installers, and example config.
- `tests/e2e/`: Playwright end-to-end tests.
- `dist/`: generated frontend output.
- `参考资料/`: product research and reference materials.

## Build, Test, and Development Commands

- `npm install`: install dependencies.
- `npm run dev`: start Vite at `http://127.0.0.1:1420/`.
- `npm run build`: type-check and build the frontend.
- `npm run preview`: serve the built frontend at `http://127.0.0.1:1421/`.
- `npm test`: run Vitest unit tests.
- `npm run test:e2e`: run Playwright tests.
- `npm run sync:build`: build the Go sync binary into `sync-server/bin/`.
- `npm run sync:server`: start the local sync server.
- `npm run tauri dev`: run the desktop app in development mode.

## Coding Style & Naming Conventions

Use TypeScript for frontend code and keep React components in PascalCase, such as `FocusView.tsx`. Use camelCase for functions, variables, and helpers. Keep domain logic in `.ts` modules and UI logic in `.tsx` files. Prefer existing local patterns.

No formatter or linter config is checked in. Match the existing style: two-space indentation, semicolons, double quotes, and explicit exported types where helpful.

## Testing Guidelines

Vitest is used for unit tests; Playwright is used for browser workflows. Place unit tests next to the module under test using `*.test.ts`, for example `src/domain.test.ts`. Place end-to-end scenarios in `tests/e2e/*.spec.ts`.

Run `npm test` before committing logic changes. Run `npm run test:e2e` when changing navigation, storage flows, timers, settings, or sync UI.

## Commit & Pull Request Guidelines

This checkout does not include Git metadata, so no repository-specific commit history is available. Use concise imperative commit messages, for example `Add sync conflict diagnostics` or `Fix focus timer reset`.

Pull requests should include a short summary, test results, and screenshots for visible UI changes. Mention any sync-server, Tauri permission, or local-storage migration impact.

## Security & Configuration Tips

The default local sync endpoint is `http://127.0.0.1:8787` with demo credentials documented in `README.md`. Do not commit private credentials, production sync data, or machine-specific paths. Use environment variables such as `TM_SYNC_USER`, `TM_SYNC_PASSWORD`, `TM_SYNC_ADDR`, and `TM_SYNC_DATA` for sync-server configuration.

## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub at `hushengjie666/team_progress_manage`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default five-role triage label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Use a single-context domain documentation layout. See `docs/agents/domain.md`.
