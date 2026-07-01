# Repository Guidelines

## Project Structure & Module Organization

TimeManage is a Vite + React + TypeScript app with a Tauri desktop shell and Go team backend service.

- `src/`: React UI, domain logic, storage, sync, notifications, and styles.
- `src/components/`: feature views and shared UI components.
- `src-tauri/`: Rust/Tauri desktop application, permissions, icons, and build output.
- `sync-server/`: Go HTTP team backend service, service installers, and example config.
- `tests/e2e/`: Playwright end-to-end tests.
- `dist/`: generated frontend output.
- `参考资料/`: product research and reference materials.

## Codex Context Hygiene

Keep routine changes scoped so Codex does not exhaust context on generated output or broad entrypoints.

- Use CodeGraph first when locating code or planning edits in this indexed repo.
- Do not read all of `src/App.tsx` unless the task is explicitly changing the app shell or migrating logic out of it; ask CodeGraph for the relevant symbol or line range first.
- Do not use `src-tauri/target`, `sync-server/data/store.json`, `test-results`, or `playwright-report` as routine context. Inspect them only for a specific failure artifact.
- When a test fails, summarize the failing test name, assertion, and relevant stack line instead of pasting full traces or large logs.

## Build, Test, and Development Commands

- `npm install`: install dependencies.
- `npm run dev`: start Vite at `http://127.0.0.1:1420/`.
- `npm run build`: type-check and build the frontend.
- `npm run preview`: serve the built frontend at `http://127.0.0.1:1421/`.
- `npm run verify:fast`: run unit tests and the frontend build for common frontend changes.
- `npm run verify:e2e`: run the Playwright end-to-end suite.
- `npm run verify:backend`: run the Go backend tests.
- `npm test`: run Vitest unit tests.
- `npm run test:e2e`: run Playwright tests.
- `npm run backend:build`: build the Go backend binary into `sync-server/bin/`.
- `npm run backend:server`: start the local backend service.
- `npm run sync:build`: legacy alias for building the Go backend binary.
- `npm run sync:server`: legacy alias for starting the local backend service.
- `npm run deploy:team`: build the `/timemanage-team/` frontend, build a Windows Server 2008 compatible backend, and create `deploy/timemanageTeam-no-root.zip`.
- `npm run tauri dev`: run the desktop app in development mode.

## Coding Style & Naming Conventions

Use TypeScript for frontend code and keep React components in PascalCase, such as `FocusView.tsx`. Use camelCase for functions, variables, and helpers. Keep domain logic in `.ts` modules and UI logic in `.tsx` files. Prefer existing local patterns.

No formatter or linter config is checked in. Match the existing style: two-space indentation, semicolons, double quotes, and explicit exported types where helpful.

## Modular Architecture Guidelines

Prefer modular development with high cohesion, low coupling, and clear ownership. A module should have one clear reason to change, hide its implementation behind a small interface, and keep related behavior together. Avoid adding pass-through modules that only rename calls without concentrating behavior.

- Keep page containers focused on composition, state wiring, and side effects. Move pure state transitions, sorting, grouping, filtering, and derived view models into `.ts` modules.
- Keep UI components focused on rendering and local interaction. Split large views into feature submodules when a section can be named by a product concept, such as Focus timer, current task, task list, project progress, or member status.
- Keep styles close to feature ownership through `src/styles/*.css` modules imported by `src/styles.css`. Preserve import order when splitting CSS so cascade behavior remains stable.
- Prefer deep modules: callers should learn a small interface and get meaningful behavior. If deleting a module would simply inline one function call, it is probably too shallow.
- Avoid cross-feature coupling. Shared helpers belong in shared domain/view-model modules only when at least two features use them; otherwise keep them inside the feature folder.
- During refactors, preserve public props, persisted state shape, CSS class names, and visible behavior unless the task explicitly asks for behavior changes.
- When a file grows beyond roughly 500 lines for UI or 1,000 lines for styles, consider splitting by cohesive product concept before adding more behavior.

## Testing Guidelines

Vitest is used for unit tests; Playwright is used for browser workflows. Place unit tests next to the module under test using `*.test.ts`, for example `src/domain.test.ts`. Place end-to-end scenarios in `tests/e2e/*.spec.ts`.

Run `npm test` before committing logic changes. Run `npm run test:e2e` when changing navigation, storage flows, timers, settings, or sync UI.

## Commit & Pull Request Guidelines

This checkout does not include Git metadata, so no repository-specific commit history is available. Use concise imperative commit messages, for example `Add sync conflict diagnostics` or `Fix focus timer reset`.

Pull requests should include a short summary, test results, and screenshots for visible UI changes. Mention any sync-server, Tauri permission, or local-storage migration impact.

## Security & Configuration Tips

The default local backend endpoint is `http://127.0.0.1:8787` with demo credentials documented in `README.md`. Do not commit private credentials, production sync data, or machine-specific paths. Use environment variables such as `TM_SYNC_USER`, `TM_SYNC_PASSWORD`, `TM_SYNC_ADDR`, and `TM_SYNC_MYSQL_DSN` for backend service configuration.

Production TimeManage Team deployment details are recorded in `docs/deployment-timemanage-team.md`. Use that file before changing deployment packaging, Nginx rules, server paths, or Windows backend build settings.

## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub at `hushengjie666/team_progress_manage`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default five-role triage label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Use a single-context domain documentation layout. See `docs/agents/domain.md`.
