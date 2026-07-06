---
name: timemanage
description: Use TimeManage through its local MCP tools to query and manage workspaces, platform accounts, invitations, projects, project members, tasks, daily plans, work sessions, reviews, settings, and task templates against the existing TimeManage team backend. Use when Codex needs to operate or inspect TimeManage business data without replacing the Web/Tauri UI.
---

# TimeManage MCP Skill

Use this skill when the user asks Codex to inspect, create, update, or troubleshoot TimeManage business data: workspaces, accounts, invitations, members, projects, tasks, today plans, execution state, reviews, settings, templates, or backend connectivity.

The MCP server is a local stdio sidecar for Codex. It calls the existing TimeManage team backend (`team-server`) over HTTP. The server-side deployment still needs one backend service plus its database; MCP is normally configured on the user's local machine or agent host.

## Configuration

Start the MCP server from the TimeManage repo:

```bash
npm run mcp:server
```

Required configuration comes from environment variables or `TM_MCP_CONFIG`:

- `TM_MCP_SERVER_URL`: team backend URL, default `http://127.0.0.1:8787`
- `TM_MCP_EMAIL`: TimeManage login email or phone value
- `TM_MCP_PASSWORD`: TimeManage login password
- `TM_MCP_DEVICE_ID`: optional stable device id, default host-based id
- `TM_MCP_CONFIG`: optional path to a JSON config matching `mcp-server/config.example.json`

Never commit real account passwords.

## Operating Model

- Prefer the Web/Tauri app for visual inspection, drag ordering, and user-facing workflows.
- Use MCP for precise reads, bulk operations, repeatable maintenance, and debugging data relationships.
- Treat all business data as backend-owned. Do not infer state from browser caches or local page-only data.
- After a write, read the affected entity or view again when the user is asking about the final visible state.

## Tool Selection

- Connectivity and identity: `health`, `get_backend_diagnostics`, `get_current_account`.
- Workspaces: `list_workspaces`, `switch_workspace`, `create_workspace`, `update_workspace`, `update_workspace_membership`.
- Platform accounts: `list_platform_accounts`, `create_platform_account`, `update_platform_account`, `disable_platform_account`, `update_platform_account_password`.
- Invitations: `list_workspace_invitations`, `invite_workspace_member`, `accept_workspace_invitation`, `delete_workspace_invitation`, `list_project_invitations`, `invite_project_member`, `accept_project_invitation`, `delete_project_invitation`.
- Members: `list_members`, `create_member`, `update_member`, `delete_member`, `bind_member_to_project`, `unbind_project_member`, `create_member_account`, `update_member_account`.
- Projects and overview: `list_projects`, `search`, `get_project_overview`, `create_project`, `update_project`, `archive_project`, `restore_project`, `get_member_status`, `list_pending_reviews`, `list_risk_tasks`.
- Tasks: `list_tasks`, `get_task`, `create_task`, `batch_create_tasks`, `update_task`, `delete_task`, `assign_task`, `batch_assign_tasks`, `set_task_status`, `update_task_progress`, `split_task`.
- Today and execution: `get_today_plan`, `get_today_workbench`, `add_task_to_today`, `batch_add_tasks_to_today`, `remove_task_from_today`, `move_today_task`, `schedule_task_for_date`, `start_task`, `pause_work_session`, `resume_work_session`, `finish_work_session`, `get_active_work`, `record_interruption`.
- Reviews, settings, templates: `submit_task_review`, `accept_task_review`, `return_task_review`, `get_daily_summary`, `update_daily_review`, `get_settings`, `update_settings`, `list_task_templates`, `save_task_template`, `delete_task_template`, `instantiate_task_template`.

## Workflow Rules

- Resolve names to ids with `search`, `list_projects`, `list_members`, or `list_tasks` before mutating data.
- Use `get_task` before risky task edits when the user gives an ambiguous task name.
- Use `get_today_plan` for the current account's raw date plan. Use `get_today_workbench` or `get_member_status` when the question is about who sees which task today.
- Use `get_active_work` for current execution state; do not rely on a browser timer display alone.
- `add_task_to_today` and `schedule_task_for_date` must not be described as moving a task between workspaces. A task's workspace follows its project.
- For workspace invites, remember project membership and workspace membership are separate permissions. If a user can see one project but not the workspace overview, check both project invitations and workspace invitations.

## Confirmation Policy

Ask the user for explicit confirmation before calling a tool with `confirmed=true` for:

- `delete_task`
- `delete_member`
- `unbind_project_member`
- `archive_project`
- `split_task`
- `accept_task_review`
- `set_task_status` when status is `completed`, `split`, or `archived`
- `disable_platform_account`
- `delete_task_template`

Good confirmation prompt:

> 确认要删除任务「任务名」吗？删除后会清理它在日期计划中的引用。

Only set `confirmed=true` after the user clearly agrees.

## Error Handling

- If a name is ambiguous, list candidates and ask the user to choose.
- If login fails, ask the user to check `TM_MCP_EMAIL` and `TM_MCP_PASSWORD`.
- If the backend cannot be reached, ask the user to start `npm run backend:server` or check `TM_MCP_SERVER_URL`.
- If a status transition is refused by business rules, explain the current status and suggest the valid next action.
- After mutating data, summarize the changed entity id, title/name, and new status or membership.
