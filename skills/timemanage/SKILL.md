---
name: timemanage
description: Use TimeManage through its MCP tools to query and manage projects, members, tasks, daily work queues, work sessions, and review flow while keeping the existing Web/Tauri front-end as the primary UI.
---

# TimeManage MCP Skill

Use this skill when the user wants to operate TimeManage through AI: querying projects, members, tasks, today's prepared work queue, active work, risk/review state, daily summaries, or when they want to create, edit, split, assign, start, pause, finish, submit, approve, or return work.

TimeManage MCP is an additional AI operation channel. It does not replace the browser or Tauri app. Both channels read and write the same team-server data, so browser changes can be read by MCP after backend refresh, and MCP writes should appear in the front-end through the existing backend refresh path.

## Configuration

Start the server with:

```bash
npm run mcp:server
```

Required configuration comes from environment variables or `TM_MCP_CONFIG`:

- `TM_MCP_SERVER_URL`: team-server URL, default `http://127.0.0.1:8787`
- `TM_MCP_EMAIL`: TimeManage login email or phone value
- `TM_MCP_PASSWORD`: TimeManage login password
- `TM_MCP_DEVICE_ID`: optional stable device id, default host-based id
- `TM_MCP_CONFIG`: optional path to a JSON config matching `mcp-server/config.example.json`

Never commit real account passwords.

## Tool Selection

- Use `list_projects` before project-specific work when the user gives a project name instead of an id.
- Use `search` when the user gives a fuzzy project/member/task name and you need candidate ids.
- Use `create_project`, `update_project`, `archive_project`, and `restore_project` for project maintenance.
- Use `list_members`, `create_member`, `update_member`, `delete_member`, `bind_member_to_project`, `update_project_member`, and `unbind_project_member` for member library and project membership work.
- Use `list_tasks` for search, filtering, and resolving task ids from task names.
- Use `get_task` before risky edits or when the user references an ambiguous task.
- Use `get_today_plan` for today's prepared work queue.
- Use `get_today_workbench` when the user asks who has what today, grouped by member, or asks why another user can/cannot see today's work.
- Use `get_active_work` when the user asks who is currently working or whether a task is executing.
- Use `get_project_overview` for project progress, risk, and active work context.
- Use `list_pending_reviews` for acceptance/review queues.
- Use `list_risk_tasks` for manager attention, stalled work, blocked work, and pending review risk.
- Use `create_task` for new project tasks. It creates `pool` tasks by default.
- Use `update_task`, `assign_task`, `set_task_status`, and `update_task_progress` for normal task maintenance.
- Use `batch_create_tasks`, `batch_assign_tasks`, and `batch_add_tasks_to_today` for safe batch task operations.
- Use `split_task` when the user wants to break a large task into several tasks.
- Use `add_task_to_today` and `remove_task_from_today` for today's prepared work queue.
- Use `start_task`, `pause_work_session`, `resume_work_session`, and `finish_work_session` for execution flow.
- Use `submit_task_review`, `accept_task_review`, and `return_task_review` for review flow.
- Use `get_daily_summary` and `update_daily_review` for daily review and work summary.
- Use `get_sync_diagnostics` when the user asks whether MCP, browser, or team-server data is current.

## Status Flow

- Create task: `pool`
- Add to today: `pool -> committed` when needed
- Start task: `committed/pool/pending_review returned task -> in_progress`, and create focus/work session plus execution signal
- Submit review: `committed/in_progress -> pending_review`
- Accept review: `pending_review -> completed`
- Return review: `pending_review -> in_progress`
- Remove from today: removes task from `DailyPlan.committedTaskIds`; `committed` tasks return to `pool`

Do not rely on a browser's local `activeTimer` for cross-user "正在执行" state. Use synced `workSessions` and `executionSignals`.

## Confirmation Policy

Ask the user for explicit confirmation before calling any high-risk tool with `confirmed=true`:

- `delete_task`
- `delete_member`
- `unbind_project_member`
- `archive_project`
- `split_task`
- `accept_task_review`
- `set_task_status` when status is `completed`, `split`, or `archived`
- Any future batch operation that deletes, archives, completes, or approves data

Good confirmation prompt:

> 确认要删除任务「任务名」吗？删除后会一并清理今日队列和相关工作记录。

Only set `confirmed=true` after the user clearly agrees.

## Error Handling

- If a task/member/project name is ambiguous, query matching records and ask the user to choose.
- If login fails, ask the user to check `TM_MCP_EMAIL` and `TM_MCP_PASSWORD`.
- If team-server cannot be reached, ask the user to start `npm run backend:server` or check `TM_MCP_SERVER_URL`.
- If a status transition is refused by business rules, explain the current status and suggest the valid next action.
- After mutating data, summarize the changed entity id, title/name, new status, and backend write result.
- For "今日任务" ambiguity, distinguish `get_today_plan` (raw prepared queue) from `get_today_workbench` (member-grouped workbench with active markers).
