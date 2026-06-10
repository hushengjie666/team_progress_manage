# Team Progress Management

This context describes a team-facing project progress system. It helps project leaders keep real-time visibility over assigned work, active execution, stalled tasks, and project risk.

## Language

**Project**:
A managed body of work that groups tasks, members, responsibility, progress, and risk visibility.
_Avoid_: Label, tag, folder

**Project Member**:
A person who participates in a project and can hold one or more responsibilities inside that same project.
_Avoid_: Account, contact

**Project Owner**:
A project member responsible for planning, assignment, and progress oversight within a project.
_Avoid_: Manager, admin, creator

**Executor**:
A project member responsible for carrying out assigned tasks. A project member can be both Project Owner and Executor in the same project, and each task has exactly one primary executor.
_Avoid_: Worker, operator

**Collaborator**:
A project member who contributes to a task without holding primary execution responsibility.
_Avoid_: Co-owner, secondary executor

**Task**:
A unit of work inside a project that can be assigned, started, progressed, completed, or become stalled.
_Avoid_: Todo, activity, card

**Task Creator**:
A project member who creates a task inside a project. Any project member can be a task creator.
_Avoid_: Owner, reporter

**Task Assignment**:
The act of giving a task to its primary executor and optionally setting an expected start time. A task creator can assign newly created work, while a project owner can assign or reassign any task in the project.
_Avoid_: Claiming, delegation note

**Unassigned Task**:
A task that belongs to a project but has no executor yet.
_Avoid_: Backlog item, loose task

**Assigned Task**:
A task that has been given to an executor but has not started.
_Avoid_: Accepted task

**In-Progress Task**:
A task that an executor has started and is actively moving forward.
_Avoid_: Active card

**Work Session**:
A focused execution interval started by an executor for exactly one task. It follows the original Pomodoro-style start-work rhythm and produces execution signals for real-time progress visibility.
_Avoid_: Attendance record, generic timer

**Active Work Session**:
The one work session an executor is currently performing. An executor can have at most one active work session at a time.
_Avoid_: Parallel active tasks, busy list

**Work Session Start Time**:
The time an executor starts a work session, shown to project owners as part of real-time progress.
_Avoid_: Clock-in time, attendance time

**Work Session Elapsed Time**:
The amount of time an active work session has been running, shown to project owners so long-running work without updates can be noticed.
_Avoid_: Timesheet total, payroll time

**Task Switch**:
The act of moving from one task to another by pausing or ending the current active work session before starting a new one.
_Avoid_: Multi-tasking, parallel start

**Blocked Task**:
A task that cannot move forward because the executor is waiting on input, dependency resolution, access, or a decision.
_Avoid_: Paused task, failed task

**Pending Review Task**:
A task that the executor considers done and is waiting for owner review or acceptance.
_Avoid_: Done, completed

**Task Acceptance**:
The project owner’s confirmation that a pending review task meets the expected outcome and can be treated as completed.
_Avoid_: Self-completion, auto-close

**Completed Task**:
A task whose expected outcome has been accepted as finished.
_Avoid_: Closed without review

**Stalled Task**:
A task that appears risky because it has had no expected execution signal for too long. Stalled is a management view, not a status manually set by the executor.
_Avoid_: Blocked, abandoned

**Expected Start Time**:
The time by which an assigned task is expected to have been started by its executor. It may come from a project default or be specified by the task creator for that task.
_Avoid_: Deadline, due date, reminder

**Expected Finish Time**:
The time by which a task is expected to have reached pending review or completion. It is separate from expected start time and is used to detect work that started but may not finish as expected.
_Avoid_: Start time, reminder

**Project Start Rule**:
The project-level default rule for when assigned tasks are expected to start. A task creator can override it by setting an expected start time for a specific task.
_Avoid_: SLA, fixed reminder

**Execution Signal**:
A work signal produced when an executor starts, pauses, updates, or completes a task. It is the source of real-time progress visibility and is not screen, mouse, or app-usage monitoring.
_Avoid_: Surveillance, monitoring, tracking

**Real-Time Progress**:
The current project view derived from task execution status, latest execution signal, and progress records.
_Avoid_: Live screen monitoring, activity spying

**Progress Board**:
The project owner’s main view for scanning project progress, active execution, assigned-but-not-started tasks, stalled tasks, blocked tasks, and pending review tasks.
_Avoid_: Task list, personal workspace

**Personal Workbench**:
An executor’s focused view of assigned tasks, active work sessions, and tasks needing progress updates. It is not based on a daily commitment mechanism.
_Avoid_: Project board, full task list, daily commitment

**Project Visibility**:
The rule that project members can see the project’s task progress, while project owners have additional authority over assignment, acceptance, and project-level rules.
_Avoid_: Private task silo

**Risk-First View**:
A progress board ordering principle that shows risky work before normal work, including assigned-but-not-started tasks, stalled tasks, blocked tasks, pending review tasks, and tasks near their expected finish time.
_Avoid_: Chronological task list, equal-priority board

**Progress Percent**:
A task-level progress value expressed as a percentage so project owners can aggregate and scan project progress.
_Avoid_: Completion status

**Work Estimate**:
The expected effort of a task, used as the default weight when aggregating project progress.
_Avoid_: Duration, deadline

**Project Progress**:
The weighted aggregate of task progress within a project. Task weight defaults to work estimate so larger tasks contribute more than small tasks.
_Avoid_: Task count completion

**Progress Note**:
A manual explanation written by an executor to describe what changed, what remains, or why progress differs from expectation.
_Avoid_: Chat message, daily report
