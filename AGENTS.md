<!-- CODEGRAPH_START -->
## CodeGraph

This repository is indexed when `.codegraph/` exists. Before using `rg`, `find`, or broad file reads to locate or understand code, use one of:

- MCP: `codegraph_explore` with the relevant symbol, file, or question.
- Shell: `codegraph explore "<symbol names or question>"`.

CodeGraph returns relevant source and call paths, including dynamic dispatch. If `.codegraph/` is absent, skip it; indexing is the user's decision.
<!-- CODEGRAPH_END -->

# TimeManage Repository Instructions

## Repository Map

TimeManage is a Vite + React + TypeScript application with Tauri desktop/iOS clients and a Go team backend.

- `src/`: frontend UI, domain logic, storage, backend integration, timers, and notifications.
- `src/components/`: feature views and shared UI.
- `src-tauri/`: Tauri desktop and Apple client code.
- `team-server/`: Go backend, migrations, configuration, and service scripts.
- `tests/e2e/`: Playwright workflows.
- `scripts/`: verification, packaging, release, and maintenance automation.
- `参考资料/`: product research and references.
- `dist/`, `deploy/`, `src-tauri/target/`, `test-results/`, and `playwright-report/`: generated output, not source.

## Working Method

- Keep changes narrow. Inspect the owning module, direct callers, and nearest tests before expanding scope.
- Use CodeGraph first for code discovery. Use `rg` or `rg --files` for exact text and file searches afterward.
- Do not read all of `src/App.tsx` unless changing app-shell state, composition, or wiring. Query the relevant symbol or line range first.
- Do not inspect `team-server/data/store.json` or generated reports unless diagnosing a specific artifact.
- In a dirty worktree, preserve unrelated changes. Report touched files and review only their diffs.
- Summarize test failures by test name, assertion, and relevant stack line; do not paste full reports or traces.
- Treat the production UI as desktop-first. Do not add mobile-specific behavior unless the user explicitly requests it.

## Frontend Ownership Map

Start with the smallest module that owns the product concept:

- Workbench: `src/workbenchModel.ts`, `src/components/WorkspaceView.tsx`, and `src/components/workspace/` panels.
- Project detail: `src/projectDetail.ts`, `src/components/ProjectDetailView.tsx`, and `src/components/projectDetail/` panels.
- Project overview and filters: `src/projectOverview.ts`, related workspace panels, and `src/projectOverview.test.ts`.
- Progress board: `src/progressBoard.ts` and `src/progressBoard.test.ts`.
- Recurrence: `src/recurrence.ts` and `src/recurrence.test.ts`.
- App boot and keyboard wiring: `src/appBootRuntime.ts` and `src/keyboardRuntime.ts`.
- Accounts and invitations: `src/workspaceAccountRuntime.ts`.
- Team persistence and side effects: `src/teamStateRuntime.ts`, `src/teamApi.ts`, and `src/timerRuntime.ts`.
- Settings: route in `src/components/SettingsView.tsx`; edit the concrete panel under `src/components/settings/`.
- Test data: reuse `src/test/fixtures.ts`; do not duplicate full `AppState` literals.

## Architecture and Style

- Use TypeScript. React components use PascalCase; functions, variables, and helpers use camelCase.
- No formatter or linter is enforced. Match existing formatting: two spaces, semicolons, double quotes, and explicit exported types where useful.
- Keep domain logic in `.ts`; keep `.tsx` components focused on rendering, local interaction, composition, and side effects.
- Move reusable state transitions, sorting, grouping, filtering, and derived models into cohesive domain modules.
- Prefer deep modules with small interfaces. Do not add pass-through modules or cross-feature coupling merely to reduce file size.
- Share a helper only when at least two features use it; otherwise keep it with its owning feature.
- Preserve public props, persisted state shapes, CSS class names, style import order, and visible behavior during refactors unless the task changes them intentionally.
- Split by product concept before source/test files exceed 500 lines or CSS exceeds 1,000 lines. Do not split cohesive files below roughly 250 lines solely for size.

## Verification

Run the narrowest relevant check first, then escalate according to impact:

- Pure local logic: nearest Vitest file, for example `npm test -- progressBoard.test.ts`.
- TypeScript contracts, shared state, or imports: `npm run typecheck`; use `npm run verify:fast` before finishing broader frontend changes.
- Navigation, persistence, timers, settings, backend UI, or browser workflows: `npm run verify:e2e`.
- Go backend: nearest Go package test, then `npm run verify:backend` when shared behavior changes.
- Tauri Rust: `cargo check --manifest-path src-tauri/Cargo.toml`.
- Refactors or cleanup: `npm run verify:quality`.
- New modules, moved code, or broad feature surfaces: `npm run audit:health` in addition to affected tests.

Tests live beside TypeScript modules as `*.test.ts`; browser workflows live in `tests/e2e/*.spec.ts`.

Common commands:

- Development: `npm install`, `npm run dev`, `npm run preview`.
- Frontend: `npm run build`, `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run verify:fast`, `npm run verify:e2e`.
- Quality: `npm run typecheck:unused`, `npm run audit:health`, `npm run verify:quality`.
- Backend: `npm run backend:server`, `npm run backend:build`, `npm run backend:build:windows`, `npm run verify:backend`.
- Packaging: `npm run deploy:team` for desktop, iOS, web, and the Windows Server 2008-compatible backend; formal release: `npm run release:team:tag -- <tag>`.

The health audit warns above 300 lines and fails above 500 for source/test files; CSS warns above 500 and fails above 1,000. It also rejects unresolved stale-code markers. Add only narrow allowlists for legitimate copy or test fixtures. Any transitional code must state a concrete deletion condition.

## Git and Pull Requests

- Use concise imperative commits, such as `Fix focus timer reset`.
- After each completed development task, run relevant verification, stage only intended paths, commit, and push the current branch to `origin`.
- Never use `git add .` in a dirty worktree. Do not overwrite or include unrelated user changes.
- If commit or push fails, report the exact blocker and leave the worktree state clear.
- Pull requests need a short summary, test results, screenshots for visible UI changes, and any backend or local-storage migration impact.

## Formal Release Workflow

Use a short-lived `release/v<version>` branch for every formal release:

1. Create it from a clean, up-to-date `main` at the intended release commit.
2. Restrict it to versioning, migrations, packaging, release verification, and release-only fixes.
3. Commit and push every fix; rerun checks for all affected frontend, backend, desktop, iOS, and database surfaces.
4. After approval, create and push an annotated immutable `v<version>` tag on the clean release HEAD.
5. Build from that tag with `npm run release:team:tag -- <tag>` and verify the unified package.
6. Merge the release branch into `main` without rewriting or dropping commits; push and confirm `main` contains the tag.
7. After the tag, package, and merge are confirmed, delete the local and remote release branch; retain the tag permanently.

Do not stabilize formal releases directly on `main`, tag unreviewed feature branches, move released tags, or revive deleted release branches. Post-release defects require the next patch-version branch and a new ordered tag.

## Unified Release Packaging

`npm run deploy:team` is the only temporary-package entry point. It must create a matching directory and ZIP:

```text
deploy/timemanageTeam-v<version>-<yyyyMMdd-HHmmss>/
deploy/timemanageTeam-v<version>-<yyyyMMdd-HHmmss>.zip
```

The directory and ZIP root must share the same name and contain:

```text
desktop/     distributable Tauri applications and installers only
ios/         signed Archive, IPA, screenshots, and App Store handoff
web/         frontend built for /timemanage-team/
server/      Windows backend, migrations, config, and service scripts
RELEASE.txt  version, timestamp, commit, and tree state
```

- The versioned directory is the authoritative handoff. Do not present `dist/` or `src-tauri/target/` as deliverables.
- Do not place ad hoc release files directly under `deploy/` or split one build across directories.
- Copy only distributable desktop formats such as `.app`, `.dmg`, `.msi`, installer `.exe`, `.deb`, `.rpm`, or `.AppImage`; exclude helper scripts, writable temporary DMGs, and bundle intermediates.
- Server deployment uses `web/` and `server/`; it does not require `desktop/`.
- Before handoff, verify the desktop app/installer, signed iOS Archive and IPA, screenshots, `web/index.html`, backend executable, migrations, deployment scripts, and `RELEASE.txt`.
- Run `unzip -t` on the ZIP and `hdiutil verify` on each macOS DMG. Report final paths and SHA-256 values.
- Temporary packages may use `npm run deploy:team`. Formal packages must come from a clean tag via `npm run release:team:tag -- <tag>`, and `RELEASE.txt` must record that tag and commit.

## Database Migrations

- MySQL schema `v0.1.2` is the permanent baseline; never support rollback below it.
- Every formal release adds exactly one ordered SQL file under `team-server/migrations/`. Releases without schema changes use a reversible no-op migration.
- Released SQL is immutable. Correct it with a new migration.
- Startup may automatically apply safe pending migrations. Safe migrations require working Goose `Up` and `Down` sections.
- Destructive migrations are restore-only and must roll back by restoring a backup.
- Any migration requiring backup must pass the recent verified-backup gate before execution.
- Packaging must include migration SQL, database command scripts, and operations documentation under `server/`.
- Before release, test empty-database upgrade, baseline adoption, every supported upgrade and rollback, database-ahead rejection, and checksum verification against MySQL.

## Security and Project Documentation

- Never commit credentials, production backend data, or machine-specific paths.
- Use `TM_BACKEND_USER`, `TM_BACKEND_PASSWORD`, `TM_BACKEND_ADDR`, and `TM_BACKEND_MYSQL_DSN` for backend configuration.
- The local default is `http://127.0.0.1:8787`; demo credentials are documented in `README.md`.
- Read `docs/deployment-timemanage-team.md` before changing deployment, Nginx, server paths, or Windows backend settings.
- Issues and PRDs: `docs/agents/issue-tracker.md` for `hushengjie666/team_progress_manage`.
- Triage labels: `docs/agents/triage-labels.md`.
- Domain documentation: `docs/agents/domain.md`.
