---
name: timemanage
description: Use the one-shot TimeManage CLI to query and manage workspaces, projects, members, tasks, today plans, execution state, reviews, settings, and backend connectivity without starting a long-running MCP sidecar.
---

# TimeManage CLI Skill

Use this skill when the user asks Codex to inspect, create, update, or troubleshoot TimeManage business data: workspaces, accounts, invitations, members, projects, tasks, today plans, execution state, reviews, settings, templates, or backend connectivity.

## Operating Model

- Use the bundled CLI, not an MCP tool server. It runs one process per command, then exits, so it does not keep a long-lived MCP context open.
- The plugin CLI path is `plugins/timemanage/scripts/timemanage.mjs` inside the installed plugin root.
- Configuration is read from `TM_MCP_CONFIG` or the default local config path:
  - macOS/Linux: `~/.config/timemanage-mcp/config.json`
  - Windows: `%APPDATA%/TimeManage MCP/config.json`
- Environment overrides remain supported: `TM_MCP_SERVER_URL`, `TM_MCP_EMAIL`, `TM_MCP_PASSWORD`, `TM_MCP_DEVICE_ID`.
- Never print or commit real account passwords.

## Command Selection

- Connectivity and identity: `timemanage doctor`, `timemanage account`, `timemanage workspaces`.
- Projects and overview: `timemanage projects`, `timemanage project <project>`, `timemanage search <query>`.
- Tasks: `timemanage tasks [--project <project>] [--status <status|all>] [--query <query>]`, `timemanage create-task`, `timemanage progress`, `timemanage complete`.
- Today and execution: `timemanage today`, `timemanage active`, `timemanage add-today`, `timemanage start`.
- Use `--json` when downstream reasoning needs exact IDs or full structured fields.

## Workflow Rules

- Resolve names to IDs with `timemanage search`, `timemanage projects`, or `timemanage tasks --json` before mutating data when the name is ambiguous.
- Prefer project/task names for user-facing summaries; include IDs only when useful for the next command.
- Use `timemanage today` for the current account's date plan.
- Use `timemanage active` for current execution state; do not rely on a browser timer display alone.
- `add-today` must not be described as moving a task between workspaces. A task's workspace follows its project.
- After a write, run the matching read command again when the user is asking about final visible state.

## Confirmation Policy

Ask the user for explicit confirmation before destructive or terminal operations:

- deleting tasks, members, or templates
- unbinding project members
- archiving projects
- splitting tasks
- accepting reviews
- completing tasks

For CLI `complete`, pass `--yes` only after the user clearly confirms.

Good confirmation prompt:

> 确认要把任务「任务名」标记为完成吗？

## Error Handling

- If a name is ambiguous, list candidates and ask the user to choose.
- If login fails, ask the user to check the configured account and password.
- If the backend cannot be reached, ask the user to check the server URL.
- If a status transition is refused by business rules, explain the current status and suggest the valid next action.
- After mutating data, summarize the changed entity ID, title/name, and new status or membership.
