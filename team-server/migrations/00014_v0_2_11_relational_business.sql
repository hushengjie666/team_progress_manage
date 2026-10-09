-- +goose NO TRANSACTION
-- +goose Up
-- Preserve payload as a compatibility snapshot; ordinary columns and detail rows are authoritative.
-- Preflight rejects incompatible values before any schema changes.
DROP PROCEDURE IF EXISTS timemanage_relational_preflight;
-- +goose StatementBegin
CREATE PROCEDURE timemanage_relational_preflight()
BEGIN
  IF EXISTS (SELECT 1 FROM business_projects WHERE JSON_TYPE(payload) <> 'OBJECT' OR JSON_TYPE(JSON_EXTRACT(payload,'$.id')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.workspaceId')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.name')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.description')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.taskStageMode')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.createdAt')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.updatedAt')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.archivedAt')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.defaultExpectedStartHours')) NOT IN ('INTEGER','UNSIGNED INTEGER','DOUBLE','DECIMAL','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.sortOrder')) NOT IN ('INTEGER','UNSIGNED INTEGER','DOUBLE','DECIMAL','NULL')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'invalid core values in business_projects';
  END IF;
  IF EXISTS (SELECT 1 FROM business_project_members WHERE JSON_TYPE(payload) <> 'OBJECT' OR JSON_TYPE(JSON_EXTRACT(payload,'$.id')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.workspaceId')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.projectId')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.accountId')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.name')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.email')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.status')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.createdAt')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.updatedAt')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.roles')) NOT IN ('ARRAY','NULL')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'invalid core values in business_project_members';
  END IF;
  IF EXISTS (SELECT 1 FROM business_tasks WHERE JSON_TYPE(payload) <> 'OBJECT' OR JSON_TYPE(JSON_EXTRACT(payload,'$.id')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.workspaceId')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.title')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.notes')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.projectId')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.project')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.creatorMemberId')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.primaryExecutorMemberId')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.expectedStartAt')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.expectedFinishAt')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.progressNote')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.priority')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.severity')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.stage')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.status')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.dueAt')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.reminderAt')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.repeatRule')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.recurrenceParentId')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.nextRepeatAt')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.lastReminderSentAt')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.createdAt')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.updatedAt')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.reviewSubmittedAt')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.reviewSubmittedByMemberId')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.reviewAcceptedAt')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.reviewAcceptedByMemberId')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.reviewReturnedAt')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.reviewReturnedByMemberId')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.reviewReturnReason')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.completedAt')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.progressPercent')) NOT IN ('INTEGER','UNSIGNED INTEGER','DOUBLE','DECIMAL','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.estimatePomodoros')) NOT IN ('INTEGER','UNSIGNED INTEGER','DOUBLE','DECIMAL','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.repeatIntervalDays')) NOT IN ('INTEGER','UNSIGNED INTEGER','DOUBLE','DECIMAL','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.repeatDayOfMonth')) NOT IN ('INTEGER','UNSIGNED INTEGER','DOUBLE','DECIMAL','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.sortOrder')) NOT IN ('INTEGER','UNSIGNED INTEGER','DOUBLE','DECIMAL','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.actualPomodoros')) NOT IN ('INTEGER','UNSIGNED INTEGER','DOUBLE','DECIMAL','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.tags')) NOT IN ('ARRAY','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.collaboratorMemberIds')) NOT IN ('ARRAY','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.repeatWeekdays')) NOT IN ('ARRAY','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.subtasks')) NOT IN ('ARRAY','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.estimateHistory')) NOT IN ('ARRAY','NULL')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'invalid core values in business_tasks';
  END IF;
  IF EXISTS (SELECT 1 FROM business_daily_plans WHERE JSON_TYPE(payload) <> 'OBJECT' OR JSON_TYPE(JSON_EXTRACT(payload,'$.id')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.workspaceId')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.ownerAccountId')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.date')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.reflection')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.reviewedAt')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.createdAt')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.updatedAt')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.review.mood')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.review.wins')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.review.blockers')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.review.interruptionPattern')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.review.tomorrowFocus')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.capacityPomodoros')) NOT IN ('INTEGER','UNSIGNED INTEGER','DOUBLE','DECIMAL','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.completedPomodoros')) NOT IN ('INTEGER','UNSIGNED INTEGER','DOUBLE','DECIMAL','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.recommendedCapacityPomodoros')) NOT IN ('INTEGER','UNSIGNED INTEGER','DOUBLE','DECIMAL','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.suggestedCapacityPomodoros')) NOT IN ('INTEGER','UNSIGNED INTEGER','DOUBLE','DECIMAL','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.overloadAcknowledged')) NOT IN ('BOOLEAN','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.review')) NOT IN ('OBJECT','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.committedTaskIds')) NOT IN ('ARRAY','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.suggestedTaskIds')) NOT IN ('ARRAY','NULL')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'invalid core values in business_daily_plans';
  END IF;
  IF EXISTS (SELECT 1 FROM business_focus_sessions WHERE JSON_TYPE(payload) <> 'OBJECT' OR JSON_TYPE(JSON_EXTRACT(payload,'$.id')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.workspaceId')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.taskId')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.mode')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.startedAt')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.endedAt')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.outcome')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.duration')) NOT IN ('INTEGER','UNSIGNED INTEGER','DOUBLE','DECIMAL','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.interruptionCounts.internal')) NOT IN ('INTEGER','UNSIGNED INTEGER','DOUBLE','DECIMAL','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.interruptionCounts.external')) NOT IN ('INTEGER','UNSIGNED INTEGER','DOUBLE','DECIMAL','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.interruptionCounts')) NOT IN ('OBJECT','NULL')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'invalid core values in business_focus_sessions';
  END IF;
  IF EXISTS (SELECT 1 FROM business_work_sessions WHERE JSON_TYPE(payload) <> 'OBJECT' OR JSON_TYPE(JSON_EXTRACT(payload,'$.id')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.workspaceId')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.ownerAccountId')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.taskId')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.executorMemberId')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.focusSessionId')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.status')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.startedAt')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.pausedAt')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.endedAt')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.createdAt')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.updatedAt')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.outcome')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.totalPausedSeconds')) NOT IN ('INTEGER','UNSIGNED INTEGER','DOUBLE','DECIMAL','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.resumedAt')) NOT IN ('STRING','NULL')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'invalid core values in business_work_sessions';
  END IF;
  IF EXISTS (SELECT 1 FROM business_execution_signals WHERE JSON_TYPE(payload) <> 'OBJECT' OR JSON_TYPE(JSON_EXTRACT(payload,'$.id')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.workspaceId')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.workSessionId')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.taskId')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.executorMemberId')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.type')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.createdAt')) NOT IN ('STRING','NULL')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'invalid core values in business_execution_signals';
  END IF;
  IF EXISTS (SELECT 1 FROM business_interruptions WHERE JSON_TYPE(payload) <> 'OBJECT' OR JSON_TYPE(JSON_EXTRACT(payload,'$.id')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.workspaceId')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.sessionId')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.taskId')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.type')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.note')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.action')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.createdAt')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.resolvedAt')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.convertedTaskId')) NOT IN ('STRING','NULL')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'invalid core values in business_interruptions';
  END IF;
  IF EXISTS (SELECT 1 FROM business_reward_state WHERE JSON_TYPE(payload) <> 'OBJECT' OR JSON_TYPE(JSON_EXTRACT(payload,'$.lastRewardedAt')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.streak')) NOT IN ('INTEGER','UNSIGNED INTEGER','DOUBLE','DECIMAL','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.dailyGoal')) NOT IN ('INTEGER','UNSIGNED INTEGER','DOUBLE','DECIMAL','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.focusGarden')) NOT IN ('INTEGER','UNSIGNED INTEGER','DOUBLE','DECIMAL','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.visualProgress')) NOT IN ('INTEGER','UNSIGNED INTEGER','DOUBLE','DECIMAL','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.badges')) NOT IN ('ARRAY','NULL')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'invalid core values in business_reward_state';
  END IF;
  IF EXISTS (SELECT 1 FROM business_task_templates WHERE JSON_TYPE(payload) <> 'OBJECT' OR JSON_TYPE(JSON_EXTRACT(payload,'$.id')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.name')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.description')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.project')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.priority')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.severity')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.stage')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.repeatRule')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.estimatePomodoros')) NOT IN ('INTEGER','UNSIGNED INTEGER','DOUBLE','DECIMAL','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.tags')) NOT IN ('ARRAY','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.subtasks')) NOT IN ('ARRAY','NULL')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'invalid core values in business_task_templates';
  END IF;
  IF EXISTS (SELECT 1 FROM business_template_instances WHERE JSON_TYPE(payload) <> 'OBJECT' OR JSON_TYPE(JSON_EXTRACT(payload,'$.templateId')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.taskId')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(payload,'$.createdAt')) NOT IN ('STRING','NULL')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'invalid core values in business_template_instances';
  END IF;
  IF EXISTS (SELECT 1 FROM business_project_members b JOIN JSON_TABLE(CASE WHEN JSON_TYPE(JSON_EXTRACT(b.payload,'$.roles'))='ARRAY' THEN JSON_EXTRACT(b.payload,'$.roles') ELSE JSON_ARRAY() END, '$[*]' COLUMNS(position FOR ORDINALITY)) j WHERE JSON_TYPE(JSON_EXTRACT(b.payload,CONCAT('$.roles[',j.position-1,']'))) NOT IN ('STRING')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'invalid detail values in project_member_roles';
  END IF;
  IF EXISTS (SELECT 1 FROM business_tasks b JOIN JSON_TABLE(CASE WHEN JSON_TYPE(JSON_EXTRACT(b.payload,'$.tags'))='ARRAY' THEN JSON_EXTRACT(b.payload,'$.tags') ELSE JSON_ARRAY() END, '$[*]' COLUMNS(position FOR ORDINALITY)) j WHERE JSON_TYPE(JSON_EXTRACT(b.payload,CONCAT('$.tags[',j.position-1,']'))) NOT IN ('STRING')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'invalid detail values in task_tags';
  END IF;
  IF EXISTS (SELECT 1 FROM business_tasks b JOIN JSON_TABLE(CASE WHEN JSON_TYPE(JSON_EXTRACT(b.payload,'$.collaboratorMemberIds'))='ARRAY' THEN JSON_EXTRACT(b.payload,'$.collaboratorMemberIds') ELSE JSON_ARRAY() END, '$[*]' COLUMNS(position FOR ORDINALITY)) j WHERE JSON_TYPE(JSON_EXTRACT(b.payload,CONCAT('$.collaboratorMemberIds[',j.position-1,']'))) NOT IN ('STRING')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'invalid detail values in task_collaborators';
  END IF;
  IF EXISTS (SELECT 1 FROM business_tasks b JOIN JSON_TABLE(CASE WHEN JSON_TYPE(JSON_EXTRACT(b.payload,'$.repeatWeekdays'))='ARRAY' THEN JSON_EXTRACT(b.payload,'$.repeatWeekdays') ELSE JSON_ARRAY() END, '$[*]' COLUMNS(position FOR ORDINALITY)) j WHERE JSON_TYPE(JSON_EXTRACT(b.payload,CONCAT('$.repeatWeekdays[',j.position-1,']'))) NOT IN ('INTEGER','UNSIGNED INTEGER','DOUBLE','DECIMAL')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'invalid detail values in task_repeat_weekdays';
  END IF;
  IF EXISTS (SELECT 1 FROM business_tasks b JOIN JSON_TABLE(CASE WHEN JSON_TYPE(JSON_EXTRACT(b.payload,'$.subtasks'))='ARRAY' THEN JSON_EXTRACT(b.payload,'$.subtasks') ELSE JSON_ARRAY() END, '$[*]' COLUMNS(position FOR ORDINALITY)) j WHERE JSON_TYPE(JSON_EXTRACT(b.payload,CONCAT('$.subtasks[',j.position-1,']'))) <> 'OBJECT' OR JSON_TYPE(JSON_EXTRACT(JSON_EXTRACT(b.payload,CONCAT('$.subtasks[',j.position-1,']')),'$.id')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(JSON_EXTRACT(b.payload,CONCAT('$.subtasks[',j.position-1,']')),'$.title')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(JSON_EXTRACT(b.payload,CONCAT('$.subtasks[',j.position-1,']')),'$.completed')) NOT IN ('BOOLEAN','NULL') OR JSON_TYPE(JSON_EXTRACT(JSON_EXTRACT(b.payload,CONCAT('$.subtasks[',j.position-1,']')),'$.createdAt')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(JSON_EXTRACT(b.payload,CONCAT('$.subtasks[',j.position-1,']')),'$.completedAt')) NOT IN ('STRING','NULL')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'invalid detail values in task_subtasks';
  END IF;
  IF EXISTS (SELECT 1 FROM business_tasks b JOIN JSON_TABLE(CASE WHEN JSON_TYPE(JSON_EXTRACT(b.payload,'$.estimateHistory'))='ARRAY' THEN JSON_EXTRACT(b.payload,'$.estimateHistory') ELSE JSON_ARRAY() END, '$[*]' COLUMNS(position FOR ORDINALITY)) j WHERE JSON_TYPE(JSON_EXTRACT(b.payload,CONCAT('$.estimateHistory[',j.position-1,']'))) <> 'OBJECT' OR JSON_TYPE(JSON_EXTRACT(JSON_EXTRACT(b.payload,CONCAT('$.estimateHistory[',j.position-1,']')),'$.id')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(JSON_EXTRACT(b.payload,CONCAT('$.estimateHistory[',j.position-1,']')),'$.estimatedPomodoros')) NOT IN ('INTEGER','UNSIGNED INTEGER','DOUBLE','DECIMAL','NULL') OR JSON_TYPE(JSON_EXTRACT(JSON_EXTRACT(b.payload,CONCAT('$.estimateHistory[',j.position-1,']')),'$.actualPomodoros')) NOT IN ('INTEGER','UNSIGNED INTEGER','DOUBLE','DECIMAL','NULL') OR JSON_TYPE(JSON_EXTRACT(JSON_EXTRACT(b.payload,CONCAT('$.estimateHistory[',j.position-1,']')),'$.recordedAt')) NOT IN ('STRING','NULL') OR JSON_TYPE(JSON_EXTRACT(JSON_EXTRACT(b.payload,CONCAT('$.estimateHistory[',j.position-1,']')),'$.source')) NOT IN ('STRING','NULL')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'invalid detail values in task_estimate_history';
  END IF;
  IF EXISTS (SELECT 1 FROM business_daily_plans b JOIN JSON_TABLE(CASE WHEN JSON_TYPE(JSON_EXTRACT(b.payload,'$.committedTaskIds'))='ARRAY' THEN JSON_EXTRACT(b.payload,'$.committedTaskIds') ELSE JSON_ARRAY() END, '$[*]' COLUMNS(position FOR ORDINALITY)) j WHERE JSON_TYPE(JSON_EXTRACT(b.payload,CONCAT('$.committedTaskIds[',j.position-1,']'))) NOT IN ('STRING')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'invalid detail values in daily_plan_committed_tasks';
  END IF;
  IF EXISTS (SELECT 1 FROM business_daily_plans b JOIN JSON_TABLE(CASE WHEN JSON_TYPE(JSON_EXTRACT(b.payload,'$.suggestedTaskIds'))='ARRAY' THEN JSON_EXTRACT(b.payload,'$.suggestedTaskIds') ELSE JSON_ARRAY() END, '$[*]' COLUMNS(position FOR ORDINALITY)) j WHERE JSON_TYPE(JSON_EXTRACT(b.payload,CONCAT('$.suggestedTaskIds[',j.position-1,']'))) NOT IN ('STRING')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'invalid detail values in daily_plan_suggested_tasks';
  END IF;
  IF EXISTS (SELECT 1 FROM business_reward_state b JOIN JSON_TABLE(CASE WHEN JSON_TYPE(JSON_EXTRACT(b.payload,'$.badges'))='ARRAY' THEN JSON_EXTRACT(b.payload,'$.badges') ELSE JSON_ARRAY() END, '$[*]' COLUMNS(position FOR ORDINALITY)) j WHERE JSON_TYPE(JSON_EXTRACT(b.payload,CONCAT('$.badges[',j.position-1,']'))) NOT IN ('STRING')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'invalid detail values in reward_badges';
  END IF;
  IF EXISTS (SELECT 1 FROM business_task_templates b JOIN JSON_TABLE(CASE WHEN JSON_TYPE(JSON_EXTRACT(b.payload,'$.tags'))='ARRAY' THEN JSON_EXTRACT(b.payload,'$.tags') ELSE JSON_ARRAY() END, '$[*]' COLUMNS(position FOR ORDINALITY)) j WHERE JSON_TYPE(JSON_EXTRACT(b.payload,CONCAT('$.tags[',j.position-1,']'))) NOT IN ('STRING')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'invalid detail values in task_template_tags';
  END IF;
  IF EXISTS (SELECT 1 FROM business_task_templates b JOIN JSON_TABLE(CASE WHEN JSON_TYPE(JSON_EXTRACT(b.payload,'$.subtasks'))='ARRAY' THEN JSON_EXTRACT(b.payload,'$.subtasks') ELSE JSON_ARRAY() END, '$[*]' COLUMNS(position FOR ORDINALITY)) j WHERE JSON_TYPE(JSON_EXTRACT(b.payload,CONCAT('$.subtasks[',j.position-1,']'))) NOT IN ('STRING')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'invalid detail values in task_template_subtasks';
  END IF;
END;
-- +goose StatementEnd
CALL timemanage_relational_preflight();
DROP PROCEDURE timemanage_relational_preflight;

ALTER TABLE business_projects
  ADD COLUMN core_archived_at LONGTEXT NULL,
  ADD COLUMN core_created_at LONGTEXT NULL,
  ADD COLUMN core_default_expected_start_hours DOUBLE NULL,
  ADD COLUMN core_description LONGTEXT NULL,
  ADD COLUMN core_id LONGTEXT NULL,
  ADD COLUMN core_name LONGTEXT NULL,
  ADD COLUMN core_sort_order DOUBLE NULL,
  ADD COLUMN core_task_stage_mode LONGTEXT NULL,
  ADD COLUMN core_updated_at LONGTEXT NULL,
  ADD COLUMN core_workspace_id LONGTEXT NULL;
UPDATE business_projects SET
  core_archived_at = CASE WHEN JSON_EXTRACT(payload, '$.archivedAt') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.archivedAt')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.archivedAt')) END,
  core_created_at = CASE WHEN JSON_EXTRACT(payload, '$.createdAt') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.createdAt')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.createdAt')) END,
  core_default_expected_start_hours = CASE WHEN JSON_EXTRACT(payload, '$.defaultExpectedStartHours') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.defaultExpectedStartHours')) = 'NULL' THEN NULL ELSE (JSON_UNQUOTE(JSON_EXTRACT(payload, '$.defaultExpectedStartHours')) + 0e0) END,
  core_description = CASE WHEN JSON_EXTRACT(payload, '$.description') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.description')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.description')) END,
  core_id = CASE WHEN JSON_EXTRACT(payload, '$.id') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.id')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.id')) END,
  core_name = CASE WHEN JSON_EXTRACT(payload, '$.name') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.name')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.name')) END,
  core_sort_order = CASE WHEN JSON_EXTRACT(payload, '$.sortOrder') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.sortOrder')) = 'NULL' THEN NULL ELSE (JSON_UNQUOTE(JSON_EXTRACT(payload, '$.sortOrder')) + 0e0) END,
  core_task_stage_mode = CASE WHEN JSON_EXTRACT(payload, '$.taskStageMode') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.taskStageMode')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.taskStageMode')) END,
  core_updated_at = CASE WHEN JSON_EXTRACT(payload, '$.updatedAt') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.updatedAt')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.updatedAt')) END,
  core_workspace_id = CASE WHEN JSON_EXTRACT(payload, '$.workspaceId') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.workspaceId')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.workspaceId')) END;

ALTER TABLE business_project_members
  ADD COLUMN core_account_id LONGTEXT NULL,
  ADD COLUMN core_created_at LONGTEXT NULL,
  ADD COLUMN core_email LONGTEXT NULL,
  ADD COLUMN core_id LONGTEXT NULL,
  ADD COLUMN core_name LONGTEXT NULL,
  ADD COLUMN core_project_id LONGTEXT NULL,
  ADD COLUMN core_status LONGTEXT NULL,
  ADD COLUMN core_updated_at LONGTEXT NULL,
  ADD COLUMN core_workspace_id LONGTEXT NULL,
  ADD COLUMN core_roles_present BOOLEAN NOT NULL DEFAULT 0;
UPDATE business_project_members SET
  core_account_id = CASE WHEN JSON_EXTRACT(payload, '$.accountId') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.accountId')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.accountId')) END,
  core_created_at = CASE WHEN JSON_EXTRACT(payload, '$.createdAt') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.createdAt')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.createdAt')) END,
  core_email = CASE WHEN JSON_EXTRACT(payload, '$.email') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.email')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.email')) END,
  core_id = CASE WHEN JSON_EXTRACT(payload, '$.id') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.id')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.id')) END,
  core_name = CASE WHEN JSON_EXTRACT(payload, '$.name') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.name')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.name')) END,
  core_project_id = CASE WHEN JSON_EXTRACT(payload, '$.projectId') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.projectId')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.projectId')) END,
  core_status = CASE WHEN JSON_EXTRACT(payload, '$.status') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.status')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.status')) END,
  core_updated_at = CASE WHEN JSON_EXTRACT(payload, '$.updatedAt') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.updatedAt')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.updatedAt')) END,
  core_workspace_id = CASE WHEN JSON_EXTRACT(payload, '$.workspaceId') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.workspaceId')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.workspaceId')) END,
  core_roles_present = COALESCE(JSON_TYPE(JSON_EXTRACT(payload,'$.roles')) = 'ARRAY',0);

CREATE TABLE project_member_roles (
  workspace_id VARCHAR(128) NOT NULL,
  parent_id VARCHAR(128) NOT NULL,
  position INT UNSIGNED NOT NULL,
  snapshot JSON NOT NULL,
  core_value LONGTEXT NOT NULL,
  PRIMARY KEY (workspace_id,parent_id,position),
  CONSTRAINT fk_project_member_roles FOREIGN KEY (workspace_id,parent_id) REFERENCES business_project_members(workspace_id,id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO project_member_roles (workspace_id,parent_id,position,snapshot,core_value)
SELECT b.workspace_id,
  b.id,
  j.position - 1,
  JSON_EXTRACT(b.payload, CONCAT('$.roles[', j.position - 1, ']')),
  JSON_UNQUOTE(JSON_EXTRACT(b.payload, CONCAT('$.roles[', j.position - 1, ']')))
FROM business_project_members b JOIN JSON_TABLE(CASE WHEN JSON_TYPE(JSON_EXTRACT(b.payload,'$.roles'))='ARRAY' THEN JSON_EXTRACT(b.payload,'$.roles') ELSE JSON_ARRAY() END, '$[*]' COLUMNS (position FOR ORDINALITY)) j;

ALTER TABLE business_tasks
  ADD COLUMN core_actual_pomodoros DOUBLE NULL,
  ADD COLUMN core_completed_at LONGTEXT NULL,
  ADD COLUMN core_created_at LONGTEXT NULL,
  ADD COLUMN core_creator_member_id LONGTEXT NULL,
  ADD COLUMN core_due_at LONGTEXT NULL,
  ADD COLUMN core_estimate_pomodoros DOUBLE NULL,
  ADD COLUMN core_expected_finish_at LONGTEXT NULL,
  ADD COLUMN core_expected_start_at LONGTEXT NULL,
  ADD COLUMN core_id LONGTEXT NULL,
  ADD COLUMN core_last_reminder_sent_at LONGTEXT NULL,
  ADD COLUMN core_next_repeat_at LONGTEXT NULL,
  ADD COLUMN core_notes LONGTEXT NULL,
  ADD COLUMN core_primary_executor_member_id LONGTEXT NULL,
  ADD COLUMN core_priority LONGTEXT NULL,
  ADD COLUMN core_progress_note LONGTEXT NULL,
  ADD COLUMN core_progress_percent DOUBLE NULL,
  ADD COLUMN core_project LONGTEXT NULL,
  ADD COLUMN core_project_id LONGTEXT NULL,
  ADD COLUMN core_recurrence_parent_id LONGTEXT NULL,
  ADD COLUMN core_reminder_at LONGTEXT NULL,
  ADD COLUMN core_repeat_day_of_month DOUBLE NULL,
  ADD COLUMN core_repeat_interval_days DOUBLE NULL,
  ADD COLUMN core_repeat_rule LONGTEXT NULL,
  ADD COLUMN core_review_accepted_at LONGTEXT NULL,
  ADD COLUMN core_review_accepted_by_member_id LONGTEXT NULL,
  ADD COLUMN core_review_return_reason LONGTEXT NULL,
  ADD COLUMN core_review_returned_at LONGTEXT NULL,
  ADD COLUMN core_review_returned_by_member_id LONGTEXT NULL,
  ADD COLUMN core_review_submitted_at LONGTEXT NULL,
  ADD COLUMN core_review_submitted_by_member_id LONGTEXT NULL,
  ADD COLUMN core_severity LONGTEXT NULL,
  ADD COLUMN core_sort_order DOUBLE NULL,
  ADD COLUMN core_stage LONGTEXT NULL,
  ADD COLUMN core_status LONGTEXT NULL,
  ADD COLUMN core_title LONGTEXT NULL,
  ADD COLUMN core_updated_at LONGTEXT NULL,
  ADD COLUMN core_workspace_id LONGTEXT NULL,
  ADD COLUMN core_tags_present BOOLEAN NOT NULL DEFAULT 0,
  ADD COLUMN core_collaborator_member_ids_present BOOLEAN NOT NULL DEFAULT 0,
  ADD COLUMN core_repeat_weekdays_present BOOLEAN NOT NULL DEFAULT 0,
  ADD COLUMN core_subtasks_present BOOLEAN NOT NULL DEFAULT 0,
  ADD COLUMN core_estimate_history_present BOOLEAN NOT NULL DEFAULT 0;
UPDATE business_tasks SET
  core_actual_pomodoros = CASE WHEN JSON_EXTRACT(payload, '$.actualPomodoros') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.actualPomodoros')) = 'NULL' THEN NULL ELSE (JSON_UNQUOTE(JSON_EXTRACT(payload, '$.actualPomodoros')) + 0e0) END,
  core_completed_at = CASE WHEN JSON_EXTRACT(payload, '$.completedAt') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.completedAt')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.completedAt')) END,
  core_created_at = CASE WHEN JSON_EXTRACT(payload, '$.createdAt') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.createdAt')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.createdAt')) END,
  core_creator_member_id = CASE WHEN JSON_EXTRACT(payload, '$.creatorMemberId') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.creatorMemberId')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.creatorMemberId')) END,
  core_due_at = CASE WHEN JSON_EXTRACT(payload, '$.dueAt') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.dueAt')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.dueAt')) END,
  core_estimate_pomodoros = CASE WHEN JSON_EXTRACT(payload, '$.estimatePomodoros') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.estimatePomodoros')) = 'NULL' THEN NULL ELSE (JSON_UNQUOTE(JSON_EXTRACT(payload, '$.estimatePomodoros')) + 0e0) END,
  core_expected_finish_at = CASE WHEN JSON_EXTRACT(payload, '$.expectedFinishAt') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.expectedFinishAt')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.expectedFinishAt')) END,
  core_expected_start_at = CASE WHEN JSON_EXTRACT(payload, '$.expectedStartAt') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.expectedStartAt')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.expectedStartAt')) END,
  core_id = CASE WHEN JSON_EXTRACT(payload, '$.id') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.id')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.id')) END,
  core_last_reminder_sent_at = CASE WHEN JSON_EXTRACT(payload, '$.lastReminderSentAt') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.lastReminderSentAt')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.lastReminderSentAt')) END,
  core_next_repeat_at = CASE WHEN JSON_EXTRACT(payload, '$.nextRepeatAt') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.nextRepeatAt')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.nextRepeatAt')) END,
  core_notes = CASE WHEN JSON_EXTRACT(payload, '$.notes') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.notes')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.notes')) END,
  core_primary_executor_member_id = CASE WHEN JSON_EXTRACT(payload, '$.primaryExecutorMemberId') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.primaryExecutorMemberId')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.primaryExecutorMemberId')) END,
  core_priority = CASE WHEN JSON_EXTRACT(payload, '$.priority') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.priority')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.priority')) END,
  core_progress_note = CASE WHEN JSON_EXTRACT(payload, '$.progressNote') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.progressNote')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.progressNote')) END,
  core_progress_percent = CASE WHEN JSON_EXTRACT(payload, '$.progressPercent') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.progressPercent')) = 'NULL' THEN NULL ELSE (JSON_UNQUOTE(JSON_EXTRACT(payload, '$.progressPercent')) + 0e0) END,
  core_project = CASE WHEN JSON_EXTRACT(payload, '$.project') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.project')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.project')) END,
  core_project_id = CASE WHEN JSON_EXTRACT(payload, '$.projectId') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.projectId')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.projectId')) END,
  core_recurrence_parent_id = CASE WHEN JSON_EXTRACT(payload, '$.recurrenceParentId') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.recurrenceParentId')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.recurrenceParentId')) END,
  core_reminder_at = CASE WHEN JSON_EXTRACT(payload, '$.reminderAt') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.reminderAt')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.reminderAt')) END,
  core_repeat_day_of_month = CASE WHEN JSON_EXTRACT(payload, '$.repeatDayOfMonth') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.repeatDayOfMonth')) = 'NULL' THEN NULL ELSE (JSON_UNQUOTE(JSON_EXTRACT(payload, '$.repeatDayOfMonth')) + 0e0) END,
  core_repeat_interval_days = CASE WHEN JSON_EXTRACT(payload, '$.repeatIntervalDays') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.repeatIntervalDays')) = 'NULL' THEN NULL ELSE (JSON_UNQUOTE(JSON_EXTRACT(payload, '$.repeatIntervalDays')) + 0e0) END,
  core_repeat_rule = CASE WHEN JSON_EXTRACT(payload, '$.repeatRule') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.repeatRule')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.repeatRule')) END,
  core_review_accepted_at = CASE WHEN JSON_EXTRACT(payload, '$.reviewAcceptedAt') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.reviewAcceptedAt')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.reviewAcceptedAt')) END,
  core_review_accepted_by_member_id = CASE WHEN JSON_EXTRACT(payload, '$.reviewAcceptedByMemberId') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.reviewAcceptedByMemberId')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.reviewAcceptedByMemberId')) END,
  core_review_return_reason = CASE WHEN JSON_EXTRACT(payload, '$.reviewReturnReason') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.reviewReturnReason')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.reviewReturnReason')) END,
  core_review_returned_at = CASE WHEN JSON_EXTRACT(payload, '$.reviewReturnedAt') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.reviewReturnedAt')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.reviewReturnedAt')) END,
  core_review_returned_by_member_id = CASE WHEN JSON_EXTRACT(payload, '$.reviewReturnedByMemberId') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.reviewReturnedByMemberId')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.reviewReturnedByMemberId')) END,
  core_review_submitted_at = CASE WHEN JSON_EXTRACT(payload, '$.reviewSubmittedAt') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.reviewSubmittedAt')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.reviewSubmittedAt')) END,
  core_review_submitted_by_member_id = CASE WHEN JSON_EXTRACT(payload, '$.reviewSubmittedByMemberId') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.reviewSubmittedByMemberId')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.reviewSubmittedByMemberId')) END,
  core_severity = CASE WHEN JSON_EXTRACT(payload, '$.severity') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.severity')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.severity')) END,
  core_sort_order = CASE WHEN JSON_EXTRACT(payload, '$.sortOrder') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.sortOrder')) = 'NULL' THEN NULL ELSE (JSON_UNQUOTE(JSON_EXTRACT(payload, '$.sortOrder')) + 0e0) END,
  core_stage = CASE WHEN JSON_EXTRACT(payload, '$.stage') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.stage')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.stage')) END,
  core_status = CASE WHEN JSON_EXTRACT(payload, '$.status') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.status')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.status')) END,
  core_title = CASE WHEN JSON_EXTRACT(payload, '$.title') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.title')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.title')) END,
  core_updated_at = CASE WHEN JSON_EXTRACT(payload, '$.updatedAt') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.updatedAt')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.updatedAt')) END,
  core_workspace_id = CASE WHEN JSON_EXTRACT(payload, '$.workspaceId') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.workspaceId')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.workspaceId')) END,
  core_tags_present = COALESCE(JSON_TYPE(JSON_EXTRACT(payload,'$.tags')) = 'ARRAY',0),
  core_collaborator_member_ids_present = COALESCE(JSON_TYPE(JSON_EXTRACT(payload,'$.collaboratorMemberIds')) = 'ARRAY',0),
  core_repeat_weekdays_present = COALESCE(JSON_TYPE(JSON_EXTRACT(payload,'$.repeatWeekdays')) = 'ARRAY',0),
  core_subtasks_present = COALESCE(JSON_TYPE(JSON_EXTRACT(payload,'$.subtasks')) = 'ARRAY',0),
  core_estimate_history_present = COALESCE(JSON_TYPE(JSON_EXTRACT(payload,'$.estimateHistory')) = 'ARRAY',0);

CREATE TABLE task_tags (
  workspace_id VARCHAR(128) NOT NULL,
  parent_id VARCHAR(128) NOT NULL,
  position INT UNSIGNED NOT NULL,
  snapshot JSON NOT NULL,
  core_value LONGTEXT NOT NULL,
  PRIMARY KEY (workspace_id,parent_id,position),
  CONSTRAINT fk_task_tags FOREIGN KEY (workspace_id,parent_id) REFERENCES business_tasks(workspace_id,id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO task_tags (workspace_id,parent_id,position,snapshot,core_value)
SELECT b.workspace_id,
  b.id,
  j.position - 1,
  JSON_EXTRACT(b.payload, CONCAT('$.tags[', j.position - 1, ']')),
  JSON_UNQUOTE(JSON_EXTRACT(b.payload, CONCAT('$.tags[', j.position - 1, ']')))
FROM business_tasks b JOIN JSON_TABLE(CASE WHEN JSON_TYPE(JSON_EXTRACT(b.payload,'$.tags'))='ARRAY' THEN JSON_EXTRACT(b.payload,'$.tags') ELSE JSON_ARRAY() END, '$[*]' COLUMNS (position FOR ORDINALITY)) j;

CREATE TABLE task_collaborators (
  workspace_id VARCHAR(128) NOT NULL,
  parent_id VARCHAR(128) NOT NULL,
  position INT UNSIGNED NOT NULL,
  snapshot JSON NOT NULL,
  core_value LONGTEXT NOT NULL,
  PRIMARY KEY (workspace_id,parent_id,position),
  CONSTRAINT fk_task_collaborators FOREIGN KEY (workspace_id,parent_id) REFERENCES business_tasks(workspace_id,id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO task_collaborators (workspace_id,parent_id,position,snapshot,core_value)
SELECT b.workspace_id,
  b.id,
  j.position - 1,
  JSON_EXTRACT(b.payload, CONCAT('$.collaboratorMemberIds[', j.position - 1, ']')),
  JSON_UNQUOTE(JSON_EXTRACT(b.payload, CONCAT('$.collaboratorMemberIds[', j.position - 1, ']')))
FROM business_tasks b JOIN JSON_TABLE(CASE WHEN JSON_TYPE(JSON_EXTRACT(b.payload,'$.collaboratorMemberIds'))='ARRAY' THEN JSON_EXTRACT(b.payload,'$.collaboratorMemberIds') ELSE JSON_ARRAY() END, '$[*]' COLUMNS (position FOR ORDINALITY)) j;

CREATE TABLE task_repeat_weekdays (
  workspace_id VARCHAR(128) NOT NULL,
  parent_id VARCHAR(128) NOT NULL,
  position INT UNSIGNED NOT NULL,
  snapshot JSON NOT NULL,
  core_value DOUBLE NOT NULL,
  PRIMARY KEY (workspace_id,parent_id,position),
  CONSTRAINT fk_task_repeat_weekdays FOREIGN KEY (workspace_id,parent_id) REFERENCES business_tasks(workspace_id,id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO task_repeat_weekdays (workspace_id,parent_id,position,snapshot,core_value)
SELECT b.workspace_id,
  b.id,
  j.position - 1,
  JSON_EXTRACT(b.payload, CONCAT('$.repeatWeekdays[', j.position - 1, ']')),
  (JSON_UNQUOTE(JSON_EXTRACT(b.payload, CONCAT('$.repeatWeekdays[', j.position - 1, ']'))) + 0e0)
FROM business_tasks b JOIN JSON_TABLE(CASE WHEN JSON_TYPE(JSON_EXTRACT(b.payload,'$.repeatWeekdays'))='ARRAY' THEN JSON_EXTRACT(b.payload,'$.repeatWeekdays') ELSE JSON_ARRAY() END, '$[*]' COLUMNS (position FOR ORDINALITY)) j;

CREATE TABLE task_subtasks (
  workspace_id VARCHAR(128) NOT NULL,
  parent_id VARCHAR(128) NOT NULL,
  position INT UNSIGNED NOT NULL,
  snapshot JSON NOT NULL,
  core_completed BOOLEAN NULL,
  core_completed_at LONGTEXT NULL,
  core_created_at LONGTEXT NULL,
  core_id LONGTEXT NULL,
  core_title LONGTEXT NULL,
  PRIMARY KEY (workspace_id,parent_id,position),
  CONSTRAINT fk_task_subtasks FOREIGN KEY (workspace_id,parent_id) REFERENCES business_tasks(workspace_id,id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO task_subtasks (workspace_id,parent_id,position,snapshot,core_completed,core_completed_at,core_created_at,core_id,core_title)
SELECT b.workspace_id,
  b.id,
  j.position - 1,
  JSON_EXTRACT(b.payload, CONCAT('$.subtasks[', j.position - 1, ']')),
  CASE WHEN JSON_EXTRACT(JSON_EXTRACT(b.payload, CONCAT('$.subtasks[', j.position - 1, ']')), '$.completed') IS NULL OR JSON_TYPE(JSON_EXTRACT(JSON_EXTRACT(b.payload, CONCAT('$.subtasks[', j.position - 1, ']')), '$.completed')) = 'NULL' THEN NULL ELSE (JSON_UNQUOTE(JSON_EXTRACT(JSON_EXTRACT(b.payload, CONCAT('$.subtasks[', j.position - 1, ']')), '$.completed')) = 'true') END,
  CASE WHEN JSON_EXTRACT(JSON_EXTRACT(b.payload, CONCAT('$.subtasks[', j.position - 1, ']')), '$.completedAt') IS NULL OR JSON_TYPE(JSON_EXTRACT(JSON_EXTRACT(b.payload, CONCAT('$.subtasks[', j.position - 1, ']')), '$.completedAt')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(JSON_EXTRACT(b.payload, CONCAT('$.subtasks[', j.position - 1, ']')), '$.completedAt')) END,
  CASE WHEN JSON_EXTRACT(JSON_EXTRACT(b.payload, CONCAT('$.subtasks[', j.position - 1, ']')), '$.createdAt') IS NULL OR JSON_TYPE(JSON_EXTRACT(JSON_EXTRACT(b.payload, CONCAT('$.subtasks[', j.position - 1, ']')), '$.createdAt')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(JSON_EXTRACT(b.payload, CONCAT('$.subtasks[', j.position - 1, ']')), '$.createdAt')) END,
  CASE WHEN JSON_EXTRACT(JSON_EXTRACT(b.payload, CONCAT('$.subtasks[', j.position - 1, ']')), '$.id') IS NULL OR JSON_TYPE(JSON_EXTRACT(JSON_EXTRACT(b.payload, CONCAT('$.subtasks[', j.position - 1, ']')), '$.id')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(JSON_EXTRACT(b.payload, CONCAT('$.subtasks[', j.position - 1, ']')), '$.id')) END,
  CASE WHEN JSON_EXTRACT(JSON_EXTRACT(b.payload, CONCAT('$.subtasks[', j.position - 1, ']')), '$.title') IS NULL OR JSON_TYPE(JSON_EXTRACT(JSON_EXTRACT(b.payload, CONCAT('$.subtasks[', j.position - 1, ']')), '$.title')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(JSON_EXTRACT(b.payload, CONCAT('$.subtasks[', j.position - 1, ']')), '$.title')) END
FROM business_tasks b JOIN JSON_TABLE(CASE WHEN JSON_TYPE(JSON_EXTRACT(b.payload,'$.subtasks'))='ARRAY' THEN JSON_EXTRACT(b.payload,'$.subtasks') ELSE JSON_ARRAY() END, '$[*]' COLUMNS (position FOR ORDINALITY)) j;

CREATE TABLE task_estimate_history (
  workspace_id VARCHAR(128) NOT NULL,
  parent_id VARCHAR(128) NOT NULL,
  position INT UNSIGNED NOT NULL,
  snapshot JSON NOT NULL,
  core_actual_pomodoros DOUBLE NULL,
  core_estimated_pomodoros DOUBLE NULL,
  core_id LONGTEXT NULL,
  core_recorded_at LONGTEXT NULL,
  core_source LONGTEXT NULL,
  PRIMARY KEY (workspace_id,parent_id,position),
  CONSTRAINT fk_task_estimate_history FOREIGN KEY (workspace_id,parent_id) REFERENCES business_tasks(workspace_id,id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO task_estimate_history (workspace_id,parent_id,position,snapshot,core_actual_pomodoros,core_estimated_pomodoros,core_id,core_recorded_at,core_source)
SELECT b.workspace_id,
  b.id,
  j.position - 1,
  JSON_EXTRACT(b.payload, CONCAT('$.estimateHistory[', j.position - 1, ']')),
  CASE WHEN JSON_EXTRACT(JSON_EXTRACT(b.payload, CONCAT('$.estimateHistory[', j.position - 1, ']')), '$.actualPomodoros') IS NULL OR JSON_TYPE(JSON_EXTRACT(JSON_EXTRACT(b.payload, CONCAT('$.estimateHistory[', j.position - 1, ']')), '$.actualPomodoros')) = 'NULL' THEN NULL ELSE (JSON_UNQUOTE(JSON_EXTRACT(JSON_EXTRACT(b.payload, CONCAT('$.estimateHistory[', j.position - 1, ']')), '$.actualPomodoros')) + 0e0) END,
  CASE WHEN JSON_EXTRACT(JSON_EXTRACT(b.payload, CONCAT('$.estimateHistory[', j.position - 1, ']')), '$.estimatedPomodoros') IS NULL OR JSON_TYPE(JSON_EXTRACT(JSON_EXTRACT(b.payload, CONCAT('$.estimateHistory[', j.position - 1, ']')), '$.estimatedPomodoros')) = 'NULL' THEN NULL ELSE (JSON_UNQUOTE(JSON_EXTRACT(JSON_EXTRACT(b.payload, CONCAT('$.estimateHistory[', j.position - 1, ']')), '$.estimatedPomodoros')) + 0e0) END,
  CASE WHEN JSON_EXTRACT(JSON_EXTRACT(b.payload, CONCAT('$.estimateHistory[', j.position - 1, ']')), '$.id') IS NULL OR JSON_TYPE(JSON_EXTRACT(JSON_EXTRACT(b.payload, CONCAT('$.estimateHistory[', j.position - 1, ']')), '$.id')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(JSON_EXTRACT(b.payload, CONCAT('$.estimateHistory[', j.position - 1, ']')), '$.id')) END,
  CASE WHEN JSON_EXTRACT(JSON_EXTRACT(b.payload, CONCAT('$.estimateHistory[', j.position - 1, ']')), '$.recordedAt') IS NULL OR JSON_TYPE(JSON_EXTRACT(JSON_EXTRACT(b.payload, CONCAT('$.estimateHistory[', j.position - 1, ']')), '$.recordedAt')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(JSON_EXTRACT(b.payload, CONCAT('$.estimateHistory[', j.position - 1, ']')), '$.recordedAt')) END,
  CASE WHEN JSON_EXTRACT(JSON_EXTRACT(b.payload, CONCAT('$.estimateHistory[', j.position - 1, ']')), '$.source') IS NULL OR JSON_TYPE(JSON_EXTRACT(JSON_EXTRACT(b.payload, CONCAT('$.estimateHistory[', j.position - 1, ']')), '$.source')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(JSON_EXTRACT(b.payload, CONCAT('$.estimateHistory[', j.position - 1, ']')), '$.source')) END
FROM business_tasks b JOIN JSON_TABLE(CASE WHEN JSON_TYPE(JSON_EXTRACT(b.payload,'$.estimateHistory'))='ARRAY' THEN JSON_EXTRACT(b.payload,'$.estimateHistory') ELSE JSON_ARRAY() END, '$[*]' COLUMNS (position FOR ORDINALITY)) j;

ALTER TABLE business_daily_plans
  ADD COLUMN core_capacity_pomodoros DOUBLE NULL,
  ADD COLUMN core_completed_pomodoros DOUBLE NULL,
  ADD COLUMN core_created_at LONGTEXT NULL,
  ADD COLUMN core_date LONGTEXT NULL,
  ADD COLUMN core_id LONGTEXT NULL,
  ADD COLUMN core_overload_acknowledged BOOLEAN NULL,
  ADD COLUMN core_owner_account_id LONGTEXT NULL,
  ADD COLUMN core_recommended_capacity_pomodoros DOUBLE NULL,
  ADD COLUMN core_reflection LONGTEXT NULL,
  ADD COLUMN core_review_blockers LONGTEXT NULL,
  ADD COLUMN core_review_interruption_pattern LONGTEXT NULL,
  ADD COLUMN core_review_mood LONGTEXT NULL,
  ADD COLUMN core_review_tomorrow_focus LONGTEXT NULL,
  ADD COLUMN core_review_wins LONGTEXT NULL,
  ADD COLUMN core_reviewed_at LONGTEXT NULL,
  ADD COLUMN core_suggested_capacity_pomodoros DOUBLE NULL,
  ADD COLUMN core_updated_at LONGTEXT NULL,
  ADD COLUMN core_workspace_id LONGTEXT NULL,
  ADD COLUMN core_review_present BOOLEAN NOT NULL DEFAULT 0,
  ADD COLUMN core_committed_task_ids_present BOOLEAN NOT NULL DEFAULT 0,
  ADD COLUMN core_suggested_task_ids_present BOOLEAN NOT NULL DEFAULT 0;
UPDATE business_daily_plans SET
  core_capacity_pomodoros = CASE WHEN JSON_EXTRACT(payload, '$.capacityPomodoros') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.capacityPomodoros')) = 'NULL' THEN NULL ELSE (JSON_UNQUOTE(JSON_EXTRACT(payload, '$.capacityPomodoros')) + 0e0) END,
  core_completed_pomodoros = CASE WHEN JSON_EXTRACT(payload, '$.completedPomodoros') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.completedPomodoros')) = 'NULL' THEN NULL ELSE (JSON_UNQUOTE(JSON_EXTRACT(payload, '$.completedPomodoros')) + 0e0) END,
  core_created_at = CASE WHEN JSON_EXTRACT(payload, '$.createdAt') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.createdAt')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.createdAt')) END,
  core_date = CASE WHEN JSON_EXTRACT(payload, '$.date') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.date')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.date')) END,
  core_id = CASE WHEN JSON_EXTRACT(payload, '$.id') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.id')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.id')) END,
  core_overload_acknowledged = CASE WHEN JSON_EXTRACT(payload, '$.overloadAcknowledged') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.overloadAcknowledged')) = 'NULL' THEN NULL ELSE (JSON_UNQUOTE(JSON_EXTRACT(payload, '$.overloadAcknowledged')) = 'true') END,
  core_owner_account_id = CASE WHEN JSON_EXTRACT(payload, '$.ownerAccountId') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.ownerAccountId')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.ownerAccountId')) END,
  core_recommended_capacity_pomodoros = CASE WHEN JSON_EXTRACT(payload, '$.recommendedCapacityPomodoros') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.recommendedCapacityPomodoros')) = 'NULL' THEN NULL ELSE (JSON_UNQUOTE(JSON_EXTRACT(payload, '$.recommendedCapacityPomodoros')) + 0e0) END,
  core_reflection = CASE WHEN JSON_EXTRACT(payload, '$.reflection') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.reflection')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.reflection')) END,
  core_review_blockers = CASE WHEN JSON_EXTRACT(payload, '$.review.blockers') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.review.blockers')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.review.blockers')) END,
  core_review_interruption_pattern = CASE WHEN JSON_EXTRACT(payload, '$.review.interruptionPattern') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.review.interruptionPattern')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.review.interruptionPattern')) END,
  core_review_mood = CASE WHEN JSON_EXTRACT(payload, '$.review.mood') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.review.mood')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.review.mood')) END,
  core_review_tomorrow_focus = CASE WHEN JSON_EXTRACT(payload, '$.review.tomorrowFocus') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.review.tomorrowFocus')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.review.tomorrowFocus')) END,
  core_review_wins = CASE WHEN JSON_EXTRACT(payload, '$.review.wins') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.review.wins')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.review.wins')) END,
  core_reviewed_at = CASE WHEN JSON_EXTRACT(payload, '$.reviewedAt') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.reviewedAt')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.reviewedAt')) END,
  core_suggested_capacity_pomodoros = CASE WHEN JSON_EXTRACT(payload, '$.suggestedCapacityPomodoros') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.suggestedCapacityPomodoros')) = 'NULL' THEN NULL ELSE (JSON_UNQUOTE(JSON_EXTRACT(payload, '$.suggestedCapacityPomodoros')) + 0e0) END,
  core_updated_at = CASE WHEN JSON_EXTRACT(payload, '$.updatedAt') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.updatedAt')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.updatedAt')) END,
  core_workspace_id = CASE WHEN JSON_EXTRACT(payload, '$.workspaceId') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.workspaceId')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.workspaceId')) END,
  core_review_present = COALESCE(JSON_TYPE(JSON_EXTRACT(payload,'$.review')) = 'OBJECT',0),
  core_committed_task_ids_present = COALESCE(JSON_TYPE(JSON_EXTRACT(payload,'$.committedTaskIds')) = 'ARRAY',0),
  core_suggested_task_ids_present = COALESCE(JSON_TYPE(JSON_EXTRACT(payload,'$.suggestedTaskIds')) = 'ARRAY',0);

CREATE TABLE daily_plan_committed_tasks (
  workspace_id VARCHAR(128) NOT NULL,
  parent_id VARCHAR(128) NOT NULL,
  position INT UNSIGNED NOT NULL,
  snapshot JSON NOT NULL,
  core_value LONGTEXT NOT NULL,
  PRIMARY KEY (workspace_id,parent_id,position),
  CONSTRAINT fk_daily_plan_committed_tasks FOREIGN KEY (workspace_id,parent_id) REFERENCES business_daily_plans(workspace_id,id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO daily_plan_committed_tasks (workspace_id,parent_id,position,snapshot,core_value)
SELECT b.workspace_id,
  b.id,
  j.position - 1,
  JSON_EXTRACT(b.payload, CONCAT('$.committedTaskIds[', j.position - 1, ']')),
  JSON_UNQUOTE(JSON_EXTRACT(b.payload, CONCAT('$.committedTaskIds[', j.position - 1, ']')))
FROM business_daily_plans b JOIN JSON_TABLE(CASE WHEN JSON_TYPE(JSON_EXTRACT(b.payload,'$.committedTaskIds'))='ARRAY' THEN JSON_EXTRACT(b.payload,'$.committedTaskIds') ELSE JSON_ARRAY() END, '$[*]' COLUMNS (position FOR ORDINALITY)) j;

CREATE TABLE daily_plan_suggested_tasks (
  workspace_id VARCHAR(128) NOT NULL,
  parent_id VARCHAR(128) NOT NULL,
  position INT UNSIGNED NOT NULL,
  snapshot JSON NOT NULL,
  core_value LONGTEXT NOT NULL,
  PRIMARY KEY (workspace_id,parent_id,position),
  CONSTRAINT fk_daily_plan_suggested_tasks FOREIGN KEY (workspace_id,parent_id) REFERENCES business_daily_plans(workspace_id,id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO daily_plan_suggested_tasks (workspace_id,parent_id,position,snapshot,core_value)
SELECT b.workspace_id,
  b.id,
  j.position - 1,
  JSON_EXTRACT(b.payload, CONCAT('$.suggestedTaskIds[', j.position - 1, ']')),
  JSON_UNQUOTE(JSON_EXTRACT(b.payload, CONCAT('$.suggestedTaskIds[', j.position - 1, ']')))
FROM business_daily_plans b JOIN JSON_TABLE(CASE WHEN JSON_TYPE(JSON_EXTRACT(b.payload,'$.suggestedTaskIds'))='ARRAY' THEN JSON_EXTRACT(b.payload,'$.suggestedTaskIds') ELSE JSON_ARRAY() END, '$[*]' COLUMNS (position FOR ORDINALITY)) j;

ALTER TABLE business_focus_sessions
  ADD COLUMN core_duration DOUBLE NULL,
  ADD COLUMN core_ended_at LONGTEXT NULL,
  ADD COLUMN core_id LONGTEXT NULL,
  ADD COLUMN core_interruption_counts_external DOUBLE NULL,
  ADD COLUMN core_interruption_counts_internal DOUBLE NULL,
  ADD COLUMN core_mode LONGTEXT NULL,
  ADD COLUMN core_outcome LONGTEXT NULL,
  ADD COLUMN core_started_at LONGTEXT NULL,
  ADD COLUMN core_task_id LONGTEXT NULL,
  ADD COLUMN core_workspace_id LONGTEXT NULL,
  ADD COLUMN core_interruption_counts_present BOOLEAN NOT NULL DEFAULT 0;
UPDATE business_focus_sessions SET
  core_duration = CASE WHEN JSON_EXTRACT(payload, '$.duration') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.duration')) = 'NULL' THEN NULL ELSE (JSON_UNQUOTE(JSON_EXTRACT(payload, '$.duration')) + 0e0) END,
  core_ended_at = CASE WHEN JSON_EXTRACT(payload, '$.endedAt') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.endedAt')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.endedAt')) END,
  core_id = CASE WHEN JSON_EXTRACT(payload, '$.id') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.id')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.id')) END,
  core_interruption_counts_external = CASE WHEN JSON_EXTRACT(payload, '$.interruptionCounts.external') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.interruptionCounts.external')) = 'NULL' THEN NULL ELSE (JSON_UNQUOTE(JSON_EXTRACT(payload, '$.interruptionCounts.external')) + 0e0) END,
  core_interruption_counts_internal = CASE WHEN JSON_EXTRACT(payload, '$.interruptionCounts.internal') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.interruptionCounts.internal')) = 'NULL' THEN NULL ELSE (JSON_UNQUOTE(JSON_EXTRACT(payload, '$.interruptionCounts.internal')) + 0e0) END,
  core_mode = CASE WHEN JSON_EXTRACT(payload, '$.mode') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.mode')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.mode')) END,
  core_outcome = CASE WHEN JSON_EXTRACT(payload, '$.outcome') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.outcome')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.outcome')) END,
  core_started_at = CASE WHEN JSON_EXTRACT(payload, '$.startedAt') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.startedAt')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.startedAt')) END,
  core_task_id = CASE WHEN JSON_EXTRACT(payload, '$.taskId') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.taskId')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.taskId')) END,
  core_workspace_id = CASE WHEN JSON_EXTRACT(payload, '$.workspaceId') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.workspaceId')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.workspaceId')) END,
  core_interruption_counts_present = COALESCE(JSON_TYPE(JSON_EXTRACT(payload,'$.interruptionCounts')) = 'OBJECT',0);

ALTER TABLE business_work_sessions
  ADD COLUMN core_created_at LONGTEXT NULL,
  ADD COLUMN core_ended_at LONGTEXT NULL,
  ADD COLUMN core_executor_member_id LONGTEXT NULL,
  ADD COLUMN core_focus_session_id LONGTEXT NULL,
  ADD COLUMN core_id LONGTEXT NULL,
  ADD COLUMN core_outcome LONGTEXT NULL,
  ADD COLUMN core_owner_account_id LONGTEXT NULL,
  ADD COLUMN core_paused_at LONGTEXT NULL,
  ADD COLUMN core_resumed_at LONGTEXT NULL,
  ADD COLUMN core_started_at LONGTEXT NULL,
  ADD COLUMN core_status LONGTEXT NULL,
  ADD COLUMN core_task_id LONGTEXT NULL,
  ADD COLUMN core_total_paused_seconds DOUBLE NULL,
  ADD COLUMN core_updated_at LONGTEXT NULL,
  ADD COLUMN core_workspace_id LONGTEXT NULL;
UPDATE business_work_sessions SET
  core_created_at = CASE WHEN JSON_EXTRACT(payload, '$.createdAt') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.createdAt')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.createdAt')) END,
  core_ended_at = CASE WHEN JSON_EXTRACT(payload, '$.endedAt') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.endedAt')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.endedAt')) END,
  core_executor_member_id = CASE WHEN JSON_EXTRACT(payload, '$.executorMemberId') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.executorMemberId')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.executorMemberId')) END,
  core_focus_session_id = CASE WHEN JSON_EXTRACT(payload, '$.focusSessionId') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.focusSessionId')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.focusSessionId')) END,
  core_id = CASE WHEN JSON_EXTRACT(payload, '$.id') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.id')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.id')) END,
  core_outcome = CASE WHEN JSON_EXTRACT(payload, '$.outcome') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.outcome')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.outcome')) END,
  core_owner_account_id = CASE WHEN JSON_EXTRACT(payload, '$.ownerAccountId') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.ownerAccountId')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.ownerAccountId')) END,
  core_paused_at = CASE WHEN JSON_EXTRACT(payload, '$.pausedAt') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.pausedAt')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.pausedAt')) END,
  core_resumed_at = CASE WHEN JSON_EXTRACT(payload, '$.resumedAt') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.resumedAt')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.resumedAt')) END,
  core_started_at = CASE WHEN JSON_EXTRACT(payload, '$.startedAt') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.startedAt')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.startedAt')) END,
  core_status = CASE WHEN JSON_EXTRACT(payload, '$.status') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.status')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.status')) END,
  core_task_id = CASE WHEN JSON_EXTRACT(payload, '$.taskId') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.taskId')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.taskId')) END,
  core_total_paused_seconds = CASE WHEN JSON_EXTRACT(payload, '$.totalPausedSeconds') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.totalPausedSeconds')) = 'NULL' THEN NULL ELSE (JSON_UNQUOTE(JSON_EXTRACT(payload, '$.totalPausedSeconds')) + 0e0) END,
  core_updated_at = CASE WHEN JSON_EXTRACT(payload, '$.updatedAt') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.updatedAt')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.updatedAt')) END,
  core_workspace_id = CASE WHEN JSON_EXTRACT(payload, '$.workspaceId') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.workspaceId')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.workspaceId')) END;

ALTER TABLE business_execution_signals
  ADD COLUMN core_created_at LONGTEXT NULL,
  ADD COLUMN core_executor_member_id LONGTEXT NULL,
  ADD COLUMN core_id LONGTEXT NULL,
  ADD COLUMN core_task_id LONGTEXT NULL,
  ADD COLUMN core_type LONGTEXT NULL,
  ADD COLUMN core_work_session_id LONGTEXT NULL,
  ADD COLUMN core_workspace_id LONGTEXT NULL;
UPDATE business_execution_signals SET
  core_created_at = CASE WHEN JSON_EXTRACT(payload, '$.createdAt') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.createdAt')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.createdAt')) END,
  core_executor_member_id = CASE WHEN JSON_EXTRACT(payload, '$.executorMemberId') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.executorMemberId')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.executorMemberId')) END,
  core_id = CASE WHEN JSON_EXTRACT(payload, '$.id') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.id')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.id')) END,
  core_task_id = CASE WHEN JSON_EXTRACT(payload, '$.taskId') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.taskId')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.taskId')) END,
  core_type = CASE WHEN JSON_EXTRACT(payload, '$.type') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.type')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.type')) END,
  core_work_session_id = CASE WHEN JSON_EXTRACT(payload, '$.workSessionId') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.workSessionId')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.workSessionId')) END,
  core_workspace_id = CASE WHEN JSON_EXTRACT(payload, '$.workspaceId') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.workspaceId')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.workspaceId')) END;

ALTER TABLE business_interruptions
  ADD COLUMN core_action LONGTEXT NULL,
  ADD COLUMN core_converted_task_id LONGTEXT NULL,
  ADD COLUMN core_created_at LONGTEXT NULL,
  ADD COLUMN core_id LONGTEXT NULL,
  ADD COLUMN core_note LONGTEXT NULL,
  ADD COLUMN core_resolved_at LONGTEXT NULL,
  ADD COLUMN core_session_id LONGTEXT NULL,
  ADD COLUMN core_task_id LONGTEXT NULL,
  ADD COLUMN core_type LONGTEXT NULL,
  ADD COLUMN core_workspace_id LONGTEXT NULL;
UPDATE business_interruptions SET
  core_action = CASE WHEN JSON_EXTRACT(payload, '$.action') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.action')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.action')) END,
  core_converted_task_id = CASE WHEN JSON_EXTRACT(payload, '$.convertedTaskId') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.convertedTaskId')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.convertedTaskId')) END,
  core_created_at = CASE WHEN JSON_EXTRACT(payload, '$.createdAt') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.createdAt')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.createdAt')) END,
  core_id = CASE WHEN JSON_EXTRACT(payload, '$.id') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.id')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.id')) END,
  core_note = CASE WHEN JSON_EXTRACT(payload, '$.note') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.note')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.note')) END,
  core_resolved_at = CASE WHEN JSON_EXTRACT(payload, '$.resolvedAt') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.resolvedAt')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.resolvedAt')) END,
  core_session_id = CASE WHEN JSON_EXTRACT(payload, '$.sessionId') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.sessionId')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.sessionId')) END,
  core_task_id = CASE WHEN JSON_EXTRACT(payload, '$.taskId') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.taskId')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.taskId')) END,
  core_type = CASE WHEN JSON_EXTRACT(payload, '$.type') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.type')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.type')) END,
  core_workspace_id = CASE WHEN JSON_EXTRACT(payload, '$.workspaceId') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.workspaceId')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.workspaceId')) END;

ALTER TABLE business_reward_state
  ADD COLUMN core_daily_goal DOUBLE NULL,
  ADD COLUMN core_focus_garden DOUBLE NULL,
  ADD COLUMN core_last_rewarded_at LONGTEXT NULL,
  ADD COLUMN core_streak DOUBLE NULL,
  ADD COLUMN core_visual_progress DOUBLE NULL,
  ADD COLUMN core_badges_present BOOLEAN NOT NULL DEFAULT 0;
UPDATE business_reward_state SET
  core_daily_goal = CASE WHEN JSON_EXTRACT(payload, '$.dailyGoal') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.dailyGoal')) = 'NULL' THEN NULL ELSE (JSON_UNQUOTE(JSON_EXTRACT(payload, '$.dailyGoal')) + 0e0) END,
  core_focus_garden = CASE WHEN JSON_EXTRACT(payload, '$.focusGarden') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.focusGarden')) = 'NULL' THEN NULL ELSE (JSON_UNQUOTE(JSON_EXTRACT(payload, '$.focusGarden')) + 0e0) END,
  core_last_rewarded_at = CASE WHEN JSON_EXTRACT(payload, '$.lastRewardedAt') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.lastRewardedAt')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.lastRewardedAt')) END,
  core_streak = CASE WHEN JSON_EXTRACT(payload, '$.streak') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.streak')) = 'NULL' THEN NULL ELSE (JSON_UNQUOTE(JSON_EXTRACT(payload, '$.streak')) + 0e0) END,
  core_visual_progress = CASE WHEN JSON_EXTRACT(payload, '$.visualProgress') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.visualProgress')) = 'NULL' THEN NULL ELSE (JSON_UNQUOTE(JSON_EXTRACT(payload, '$.visualProgress')) + 0e0) END,
  core_badges_present = COALESCE(JSON_TYPE(JSON_EXTRACT(payload,'$.badges')) = 'ARRAY',0);

CREATE TABLE reward_badges (
  workspace_id VARCHAR(128) NOT NULL,
  parent_id VARCHAR(128) NOT NULL,
  position INT UNSIGNED NOT NULL,
  snapshot JSON NOT NULL,
  core_value LONGTEXT NOT NULL,
  PRIMARY KEY (workspace_id,parent_id,position),
  CONSTRAINT fk_reward_badges FOREIGN KEY (workspace_id,parent_id) REFERENCES business_reward_state(workspace_id,id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO reward_badges (workspace_id,parent_id,position,snapshot,core_value)
SELECT b.workspace_id,
  b.id,
  j.position - 1,
  JSON_EXTRACT(b.payload, CONCAT('$.badges[', j.position - 1, ']')),
  JSON_UNQUOTE(JSON_EXTRACT(b.payload, CONCAT('$.badges[', j.position - 1, ']')))
FROM business_reward_state b JOIN JSON_TABLE(CASE WHEN JSON_TYPE(JSON_EXTRACT(b.payload,'$.badges'))='ARRAY' THEN JSON_EXTRACT(b.payload,'$.badges') ELSE JSON_ARRAY() END, '$[*]' COLUMNS (position FOR ORDINALITY)) j;

ALTER TABLE business_task_templates
  ADD COLUMN core_description LONGTEXT NULL,
  ADD COLUMN core_estimate_pomodoros DOUBLE NULL,
  ADD COLUMN core_id LONGTEXT NULL,
  ADD COLUMN core_name LONGTEXT NULL,
  ADD COLUMN core_priority LONGTEXT NULL,
  ADD COLUMN core_project LONGTEXT NULL,
  ADD COLUMN core_repeat_rule LONGTEXT NULL,
  ADD COLUMN core_severity LONGTEXT NULL,
  ADD COLUMN core_stage LONGTEXT NULL,
  ADD COLUMN core_tags_present BOOLEAN NOT NULL DEFAULT 0,
  ADD COLUMN core_subtasks_present BOOLEAN NOT NULL DEFAULT 0;
UPDATE business_task_templates SET
  core_description = CASE WHEN JSON_EXTRACT(payload, '$.description') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.description')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.description')) END,
  core_estimate_pomodoros = CASE WHEN JSON_EXTRACT(payload, '$.estimatePomodoros') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.estimatePomodoros')) = 'NULL' THEN NULL ELSE (JSON_UNQUOTE(JSON_EXTRACT(payload, '$.estimatePomodoros')) + 0e0) END,
  core_id = CASE WHEN JSON_EXTRACT(payload, '$.id') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.id')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.id')) END,
  core_name = CASE WHEN JSON_EXTRACT(payload, '$.name') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.name')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.name')) END,
  core_priority = CASE WHEN JSON_EXTRACT(payload, '$.priority') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.priority')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.priority')) END,
  core_project = CASE WHEN JSON_EXTRACT(payload, '$.project') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.project')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.project')) END,
  core_repeat_rule = CASE WHEN JSON_EXTRACT(payload, '$.repeatRule') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.repeatRule')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.repeatRule')) END,
  core_severity = CASE WHEN JSON_EXTRACT(payload, '$.severity') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.severity')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.severity')) END,
  core_stage = CASE WHEN JSON_EXTRACT(payload, '$.stage') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.stage')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.stage')) END,
  core_tags_present = COALESCE(JSON_TYPE(JSON_EXTRACT(payload,'$.tags')) = 'ARRAY',0),
  core_subtasks_present = COALESCE(JSON_TYPE(JSON_EXTRACT(payload,'$.subtasks')) = 'ARRAY',0);

CREATE TABLE task_template_tags (
  workspace_id VARCHAR(128) NOT NULL,
  parent_id VARCHAR(128) NOT NULL,
  position INT UNSIGNED NOT NULL,
  snapshot JSON NOT NULL,
  core_value LONGTEXT NOT NULL,
  PRIMARY KEY (workspace_id,parent_id,position),
  CONSTRAINT fk_task_template_tags FOREIGN KEY (workspace_id,parent_id) REFERENCES business_task_templates(workspace_id,id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO task_template_tags (workspace_id,parent_id,position,snapshot,core_value)
SELECT b.workspace_id,
  b.id,
  j.position - 1,
  JSON_EXTRACT(b.payload, CONCAT('$.tags[', j.position - 1, ']')),
  JSON_UNQUOTE(JSON_EXTRACT(b.payload, CONCAT('$.tags[', j.position - 1, ']')))
FROM business_task_templates b JOIN JSON_TABLE(CASE WHEN JSON_TYPE(JSON_EXTRACT(b.payload,'$.tags'))='ARRAY' THEN JSON_EXTRACT(b.payload,'$.tags') ELSE JSON_ARRAY() END, '$[*]' COLUMNS (position FOR ORDINALITY)) j;

CREATE TABLE task_template_subtasks (
  workspace_id VARCHAR(128) NOT NULL,
  parent_id VARCHAR(128) NOT NULL,
  position INT UNSIGNED NOT NULL,
  snapshot JSON NOT NULL,
  core_value LONGTEXT NOT NULL,
  PRIMARY KEY (workspace_id,parent_id,position),
  CONSTRAINT fk_task_template_subtasks FOREIGN KEY (workspace_id,parent_id) REFERENCES business_task_templates(workspace_id,id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO task_template_subtasks (workspace_id,parent_id,position,snapshot,core_value)
SELECT b.workspace_id,
  b.id,
  j.position - 1,
  JSON_EXTRACT(b.payload, CONCAT('$.subtasks[', j.position - 1, ']')),
  JSON_UNQUOTE(JSON_EXTRACT(b.payload, CONCAT('$.subtasks[', j.position - 1, ']')))
FROM business_task_templates b JOIN JSON_TABLE(CASE WHEN JSON_TYPE(JSON_EXTRACT(b.payload,'$.subtasks'))='ARRAY' THEN JSON_EXTRACT(b.payload,'$.subtasks') ELSE JSON_ARRAY() END, '$[*]' COLUMNS (position FOR ORDINALITY)) j;

ALTER TABLE business_template_instances
  ADD COLUMN core_created_at LONGTEXT NULL,
  ADD COLUMN core_task_id LONGTEXT NULL,
  ADD COLUMN core_template_id LONGTEXT NULL;
UPDATE business_template_instances SET
  core_created_at = CASE WHEN JSON_EXTRACT(payload, '$.createdAt') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.createdAt')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.createdAt')) END,
  core_task_id = CASE WHEN JSON_EXTRACT(payload, '$.taskId') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.taskId')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.taskId')) END,
  core_template_id = CASE WHEN JSON_EXTRACT(payload, '$.templateId') IS NULL OR JSON_TYPE(JSON_EXTRACT(payload, '$.templateId')) = 'NULL' THEN NULL ELSE JSON_UNQUOTE(JSON_EXTRACT(payload, '$.templateId')) END;


-- +goose Down
-- Rebuild the compatibility snapshot from authoritative columns and ordered detail rows before dropping them.
UPDATE business_projects SET payload = JSON_MERGE_PATCH(payload,JSON_OBJECT('archivedAt',core_archived_at,'createdAt',core_created_at,'defaultExpectedStartHours',core_default_expected_start_hours,'description',core_description,'id',core_id,'name',core_name,'sortOrder',core_sort_order,'taskStageMode',core_task_stage_mode,'updatedAt',core_updated_at,'workspaceId',core_workspace_id));
UPDATE business_project_members SET payload = JSON_MERGE_PATCH(payload,JSON_OBJECT('accountId',core_account_id,'createdAt',core_created_at,'email',core_email,'id',core_id,'name',core_name,'projectId',core_project_id,'status',core_status,'updatedAt',core_updated_at,'workspaceId',core_workspace_id,'roles',IF(core_roles_present,JSON_ARRAY(),NULL)));
UPDATE business_tasks SET payload = JSON_MERGE_PATCH(payload,JSON_OBJECT('actualPomodoros',core_actual_pomodoros,'completedAt',core_completed_at,'createdAt',core_created_at,'creatorMemberId',core_creator_member_id,'dueAt',core_due_at,'estimatePomodoros',core_estimate_pomodoros,'expectedFinishAt',core_expected_finish_at,'expectedStartAt',core_expected_start_at,'id',core_id,'lastReminderSentAt',core_last_reminder_sent_at,'nextRepeatAt',core_next_repeat_at,'notes',core_notes,'primaryExecutorMemberId',core_primary_executor_member_id,'priority',core_priority,'progressNote',core_progress_note,'progressPercent',core_progress_percent,'project',core_project,'projectId',core_project_id,'recurrenceParentId',core_recurrence_parent_id,'reminderAt',core_reminder_at,'repeatDayOfMonth',core_repeat_day_of_month,'repeatIntervalDays',core_repeat_interval_days,'repeatRule',core_repeat_rule,'reviewAcceptedAt',core_review_accepted_at,'reviewAcceptedByMemberId',core_review_accepted_by_member_id,'reviewReturnReason',core_review_return_reason,'reviewReturnedAt',core_review_returned_at,'reviewReturnedByMemberId',core_review_returned_by_member_id,'reviewSubmittedAt',core_review_submitted_at,'reviewSubmittedByMemberId',core_review_submitted_by_member_id,'severity',core_severity,'sortOrder',core_sort_order,'stage',core_stage,'status',core_status,'title',core_title,'updatedAt',core_updated_at,'workspaceId',core_workspace_id,'tags',IF(core_tags_present,JSON_ARRAY(),NULL),'collaboratorMemberIds',IF(core_collaborator_member_ids_present,JSON_ARRAY(),NULL),'repeatWeekdays',IF(core_repeat_weekdays_present,JSON_ARRAY(),NULL),'subtasks',IF(core_subtasks_present,JSON_ARRAY(),NULL),'estimateHistory',IF(core_estimate_history_present,JSON_ARRAY(),NULL)));
UPDATE business_daily_plans SET payload = JSON_MERGE_PATCH(payload,JSON_OBJECT('capacityPomodoros',core_capacity_pomodoros,'completedPomodoros',core_completed_pomodoros,'createdAt',core_created_at,'date',core_date,'id',core_id,'overloadAcknowledged',IF(core_overload_acknowledged IS NULL, NULL, JSON_EXTRACT(IF(core_overload_acknowledged, 'true', 'false'), '$')),'ownerAccountId',core_owner_account_id,'recommendedCapacityPomodoros',core_recommended_capacity_pomodoros,'reflection',core_reflection,'reviewedAt',core_reviewed_at,'suggestedCapacityPomodoros',core_suggested_capacity_pomodoros,'updatedAt',core_updated_at,'workspaceId',core_workspace_id,'review',IF(core_review_present,JSON_OBJECT('blockers',core_review_blockers,'interruptionPattern',core_review_interruption_pattern,'mood',core_review_mood,'tomorrowFocus',core_review_tomorrow_focus,'wins',core_review_wins),NULL),'committedTaskIds',IF(core_committed_task_ids_present,JSON_ARRAY(),NULL),'suggestedTaskIds',IF(core_suggested_task_ids_present,JSON_ARRAY(),NULL)));
UPDATE business_focus_sessions SET payload = JSON_MERGE_PATCH(payload,JSON_OBJECT('duration',core_duration,'endedAt',core_ended_at,'id',core_id,'mode',core_mode,'outcome',core_outcome,'startedAt',core_started_at,'taskId',core_task_id,'workspaceId',core_workspace_id,'interruptionCounts',IF(core_interruption_counts_present,JSON_OBJECT('external',core_interruption_counts_external,'internal',core_interruption_counts_internal),NULL)));
UPDATE business_work_sessions SET payload = JSON_MERGE_PATCH(payload,JSON_OBJECT('createdAt',core_created_at,'endedAt',core_ended_at,'executorMemberId',core_executor_member_id,'focusSessionId',core_focus_session_id,'id',core_id,'outcome',core_outcome,'ownerAccountId',core_owner_account_id,'pausedAt',core_paused_at,'resumedAt',core_resumed_at,'startedAt',core_started_at,'status',core_status,'taskId',core_task_id,'totalPausedSeconds',core_total_paused_seconds,'updatedAt',core_updated_at,'workspaceId',core_workspace_id));
UPDATE business_execution_signals SET payload = JSON_MERGE_PATCH(payload,JSON_OBJECT('createdAt',core_created_at,'executorMemberId',core_executor_member_id,'id',core_id,'taskId',core_task_id,'type',core_type,'workSessionId',core_work_session_id,'workspaceId',core_workspace_id));
UPDATE business_interruptions SET payload = JSON_MERGE_PATCH(payload,JSON_OBJECT('action',core_action,'convertedTaskId',core_converted_task_id,'createdAt',core_created_at,'id',core_id,'note',core_note,'resolvedAt',core_resolved_at,'sessionId',core_session_id,'taskId',core_task_id,'type',core_type,'workspaceId',core_workspace_id));
UPDATE business_reward_state SET payload = JSON_MERGE_PATCH(payload,JSON_OBJECT('dailyGoal',core_daily_goal,'focusGarden',core_focus_garden,'lastRewardedAt',core_last_rewarded_at,'streak',core_streak,'visualProgress',core_visual_progress,'badges',IF(core_badges_present,JSON_ARRAY(),NULL)));
UPDATE business_task_templates SET payload = JSON_MERGE_PATCH(payload,JSON_OBJECT('description',core_description,'estimatePomodoros',core_estimate_pomodoros,'id',core_id,'name',core_name,'priority',core_priority,'project',core_project,'repeatRule',core_repeat_rule,'severity',core_severity,'stage',core_stage,'tags',IF(core_tags_present,JSON_ARRAY(),NULL),'subtasks',IF(core_subtasks_present,JSON_ARRAY(),NULL)));
UPDATE business_template_instances SET payload = JSON_MERGE_PATCH(payload,JSON_OBJECT('createdAt',core_created_at,'taskId',core_task_id,'templateId',core_template_id));
-- +goose StatementBegin
CREATE PROCEDURE timemanage_relational_down()
BEGIN
  DECLARE finished BOOLEAN DEFAULT FALSE;
  DECLARE table_name,workspace,parent_id VARCHAR(128);
  DECLARE field_name VARCHAR(128);
  DECLARE item LONGTEXT;
  DECLARE details CURSOR FOR SELECT d.table_name,d.workspace_id,d.parent_id,d.field_name,d.item FROM (
    SELECT 'business_project_members' AS table_name,c.workspace_id,c.parent_id,'roles' AS field_name,c.position,JSON_EXTRACT(JSON_ARRAY(c.core_value),'$[0]') AS item FROM project_member_roles c JOIN business_project_members b ON b.workspace_id=c.workspace_id AND b.id=c.parent_id WHERE b.core_roles_present
    UNION ALL
    SELECT 'business_tasks' AS table_name,c.workspace_id,c.parent_id,'tags' AS field_name,c.position,JSON_EXTRACT(JSON_ARRAY(c.core_value),'$[0]') AS item FROM task_tags c JOIN business_tasks b ON b.workspace_id=c.workspace_id AND b.id=c.parent_id WHERE b.core_tags_present
    UNION ALL
    SELECT 'business_tasks' AS table_name,c.workspace_id,c.parent_id,'collaboratorMemberIds' AS field_name,c.position,JSON_EXTRACT(JSON_ARRAY(c.core_value),'$[0]') AS item FROM task_collaborators c JOIN business_tasks b ON b.workspace_id=c.workspace_id AND b.id=c.parent_id WHERE b.core_collaborator_member_ids_present
    UNION ALL
    SELECT 'business_tasks' AS table_name,c.workspace_id,c.parent_id,'repeatWeekdays' AS field_name,c.position,JSON_EXTRACT(JSON_ARRAY(c.core_value),'$[0]') AS item FROM task_repeat_weekdays c JOIN business_tasks b ON b.workspace_id=c.workspace_id AND b.id=c.parent_id WHERE b.core_repeat_weekdays_present
    UNION ALL
    SELECT 'business_tasks' AS table_name,c.workspace_id,c.parent_id,'subtasks' AS field_name,c.position,JSON_MERGE_PATCH(c.snapshot,JSON_OBJECT('completed',IF(c.core_completed IS NULL, NULL, JSON_EXTRACT(IF(c.core_completed, 'true', 'false'), '$')),'completedAt',c.core_completed_at,'createdAt',c.core_created_at,'id',c.core_id,'title',c.core_title)) AS item FROM task_subtasks c JOIN business_tasks b ON b.workspace_id=c.workspace_id AND b.id=c.parent_id WHERE b.core_subtasks_present
    UNION ALL
    SELECT 'business_tasks' AS table_name,c.workspace_id,c.parent_id,'estimateHistory' AS field_name,c.position,JSON_MERGE_PATCH(c.snapshot,JSON_OBJECT('actualPomodoros',c.core_actual_pomodoros,'estimatedPomodoros',c.core_estimated_pomodoros,'id',c.core_id,'recordedAt',c.core_recorded_at,'source',c.core_source)) AS item FROM task_estimate_history c JOIN business_tasks b ON b.workspace_id=c.workspace_id AND b.id=c.parent_id WHERE b.core_estimate_history_present
    UNION ALL
    SELECT 'business_daily_plans' AS table_name,c.workspace_id,c.parent_id,'committedTaskIds' AS field_name,c.position,JSON_EXTRACT(JSON_ARRAY(c.core_value),'$[0]') AS item FROM daily_plan_committed_tasks c JOIN business_daily_plans b ON b.workspace_id=c.workspace_id AND b.id=c.parent_id WHERE b.core_committed_task_ids_present
    UNION ALL
    SELECT 'business_daily_plans' AS table_name,c.workspace_id,c.parent_id,'suggestedTaskIds' AS field_name,c.position,JSON_EXTRACT(JSON_ARRAY(c.core_value),'$[0]') AS item FROM daily_plan_suggested_tasks c JOIN business_daily_plans b ON b.workspace_id=c.workspace_id AND b.id=c.parent_id WHERE b.core_suggested_task_ids_present
    UNION ALL
    SELECT 'business_reward_state' AS table_name,c.workspace_id,c.parent_id,'badges' AS field_name,c.position,JSON_EXTRACT(JSON_ARRAY(c.core_value),'$[0]') AS item FROM reward_badges c JOIN business_reward_state b ON b.workspace_id=c.workspace_id AND b.id=c.parent_id WHERE b.core_badges_present
    UNION ALL
    SELECT 'business_task_templates' AS table_name,c.workspace_id,c.parent_id,'tags' AS field_name,c.position,JSON_EXTRACT(JSON_ARRAY(c.core_value),'$[0]') AS item FROM task_template_tags c JOIN business_task_templates b ON b.workspace_id=c.workspace_id AND b.id=c.parent_id WHERE b.core_tags_present
    UNION ALL
    SELECT 'business_task_templates' AS table_name,c.workspace_id,c.parent_id,'subtasks' AS field_name,c.position,JSON_EXTRACT(JSON_ARRAY(c.core_value),'$[0]') AS item FROM task_template_subtasks c JOIN business_task_templates b ON b.workspace_id=c.workspace_id AND b.id=c.parent_id WHERE b.core_subtasks_present
  ) d ORDER BY d.table_name,d.workspace_id,d.parent_id,d.field_name,d.position;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET finished = TRUE;
  OPEN details;
  detail_loop: LOOP
    FETCH details INTO table_name,workspace,parent_id,field_name,item;
    IF finished THEN LEAVE detail_loop; END IF;
    SET @tm_core_sql = CONCAT('UPDATE ',table_name,' SET payload = JSON_ARRAY_APPEND(payload, ''$.',field_name,''', CAST(? AS JSON)) WHERE workspace_id = ? AND id = ?');
    SET @tm_core_item = item;
    SET @tm_core_workspace = workspace;
    SET @tm_core_parent = parent_id;
    PREPARE core_append FROM @tm_core_sql;
    EXECUTE core_append USING @tm_core_item,@tm_core_workspace,@tm_core_parent;
    DEALLOCATE PREPARE core_append;
  END LOOP;
  CLOSE details;
END;
-- +goose StatementEnd
CALL timemanage_relational_down();
DROP PROCEDURE timemanage_relational_down;
ALTER TABLE business_template_instances DROP COLUMN core_template_id, DROP COLUMN core_task_id, DROP COLUMN core_created_at;
DROP TABLE task_template_subtasks;
DROP TABLE task_template_tags;
ALTER TABLE business_task_templates DROP COLUMN core_id, DROP COLUMN core_name, DROP COLUMN core_description, DROP COLUMN core_project, DROP COLUMN core_priority, DROP COLUMN core_severity, DROP COLUMN core_stage, DROP COLUMN core_repeat_rule, DROP COLUMN core_estimate_pomodoros, DROP COLUMN core_tags_present, DROP COLUMN core_subtasks_present;
DROP TABLE reward_badges;
ALTER TABLE business_reward_state DROP COLUMN core_last_rewarded_at, DROP COLUMN core_streak, DROP COLUMN core_daily_goal, DROP COLUMN core_focus_garden, DROP COLUMN core_visual_progress, DROP COLUMN core_badges_present;
ALTER TABLE business_interruptions DROP COLUMN core_id, DROP COLUMN core_workspace_id, DROP COLUMN core_session_id, DROP COLUMN core_task_id, DROP COLUMN core_type, DROP COLUMN core_note, DROP COLUMN core_action, DROP COLUMN core_created_at, DROP COLUMN core_resolved_at, DROP COLUMN core_converted_task_id;
ALTER TABLE business_execution_signals DROP COLUMN core_id, DROP COLUMN core_workspace_id, DROP COLUMN core_work_session_id, DROP COLUMN core_task_id, DROP COLUMN core_executor_member_id, DROP COLUMN core_type, DROP COLUMN core_created_at;
ALTER TABLE business_work_sessions DROP COLUMN core_id, DROP COLUMN core_workspace_id, DROP COLUMN core_owner_account_id, DROP COLUMN core_task_id, DROP COLUMN core_executor_member_id, DROP COLUMN core_focus_session_id, DROP COLUMN core_status, DROP COLUMN core_started_at, DROP COLUMN core_paused_at, DROP COLUMN core_ended_at, DROP COLUMN core_created_at, DROP COLUMN core_updated_at, DROP COLUMN core_outcome, DROP COLUMN core_total_paused_seconds, DROP COLUMN core_resumed_at;
ALTER TABLE business_focus_sessions DROP COLUMN core_id, DROP COLUMN core_workspace_id, DROP COLUMN core_task_id, DROP COLUMN core_mode, DROP COLUMN core_started_at, DROP COLUMN core_ended_at, DROP COLUMN core_outcome, DROP COLUMN core_duration, DROP COLUMN core_interruption_counts_internal, DROP COLUMN core_interruption_counts_external, DROP COLUMN core_interruption_counts_present;
DROP TABLE daily_plan_suggested_tasks;
DROP TABLE daily_plan_committed_tasks;
ALTER TABLE business_daily_plans DROP COLUMN core_id, DROP COLUMN core_workspace_id, DROP COLUMN core_owner_account_id, DROP COLUMN core_date, DROP COLUMN core_reflection, DROP COLUMN core_reviewed_at, DROP COLUMN core_created_at, DROP COLUMN core_updated_at, DROP COLUMN core_review_mood, DROP COLUMN core_review_wins, DROP COLUMN core_review_blockers, DROP COLUMN core_review_interruption_pattern, DROP COLUMN core_review_tomorrow_focus, DROP COLUMN core_capacity_pomodoros, DROP COLUMN core_completed_pomodoros, DROP COLUMN core_recommended_capacity_pomodoros, DROP COLUMN core_suggested_capacity_pomodoros, DROP COLUMN core_overload_acknowledged, DROP COLUMN core_review_present, DROP COLUMN core_committed_task_ids_present, DROP COLUMN core_suggested_task_ids_present;
DROP TABLE task_estimate_history;
DROP TABLE task_subtasks;
DROP TABLE task_repeat_weekdays;
DROP TABLE task_collaborators;
DROP TABLE task_tags;
ALTER TABLE business_tasks DROP COLUMN core_id, DROP COLUMN core_workspace_id, DROP COLUMN core_title, DROP COLUMN core_notes, DROP COLUMN core_project_id, DROP COLUMN core_project, DROP COLUMN core_creator_member_id, DROP COLUMN core_primary_executor_member_id, DROP COLUMN core_expected_start_at, DROP COLUMN core_expected_finish_at, DROP COLUMN core_progress_note, DROP COLUMN core_priority, DROP COLUMN core_severity, DROP COLUMN core_stage, DROP COLUMN core_status, DROP COLUMN core_due_at, DROP COLUMN core_reminder_at, DROP COLUMN core_repeat_rule, DROP COLUMN core_recurrence_parent_id, DROP COLUMN core_next_repeat_at, DROP COLUMN core_last_reminder_sent_at, DROP COLUMN core_created_at, DROP COLUMN core_updated_at, DROP COLUMN core_review_submitted_at, DROP COLUMN core_review_submitted_by_member_id, DROP COLUMN core_review_accepted_at, DROP COLUMN core_review_accepted_by_member_id, DROP COLUMN core_review_returned_at, DROP COLUMN core_review_returned_by_member_id, DROP COLUMN core_review_return_reason, DROP COLUMN core_completed_at, DROP COLUMN core_progress_percent, DROP COLUMN core_estimate_pomodoros, DROP COLUMN core_repeat_interval_days, DROP COLUMN core_repeat_day_of_month, DROP COLUMN core_sort_order, DROP COLUMN core_actual_pomodoros, DROP COLUMN core_tags_present, DROP COLUMN core_collaborator_member_ids_present, DROP COLUMN core_repeat_weekdays_present, DROP COLUMN core_subtasks_present, DROP COLUMN core_estimate_history_present;
DROP TABLE project_member_roles;
ALTER TABLE business_project_members DROP COLUMN core_id, DROP COLUMN core_workspace_id, DROP COLUMN core_project_id, DROP COLUMN core_account_id, DROP COLUMN core_name, DROP COLUMN core_email, DROP COLUMN core_status, DROP COLUMN core_created_at, DROP COLUMN core_updated_at, DROP COLUMN core_roles_present;
ALTER TABLE business_projects DROP COLUMN core_id, DROP COLUMN core_workspace_id, DROP COLUMN core_name, DROP COLUMN core_description, DROP COLUMN core_task_stage_mode, DROP COLUMN core_created_at, DROP COLUMN core_updated_at, DROP COLUMN core_archived_at, DROP COLUMN core_default_expected_start_hours, DROP COLUMN core_sort_order;
