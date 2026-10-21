-- +goose Up
ALTER TABLE business_projects ADD COLUMN core_auto_accept_completed_tasks TINYINT(1) NULL;
UPDATE business_projects
SET core_auto_accept_completed_tasks = CASE
  WHEN JSON_TYPE(JSON_EXTRACT(payload, '$.autoAcceptCompletedTasks')) = 'BOOLEAN'
    THEN IF(JSON_UNQUOTE(JSON_EXTRACT(payload, '$.autoAcceptCompletedTasks')) = 'true', 1, 0)
  ELSE NULL
END;

-- +goose Down
UPDATE business_projects
SET payload = JSON_MERGE_PATCH(payload, JSON_OBJECT('autoAcceptCompletedTasks',
  IF(core_auto_accept_completed_tasks IS NULL, NULL,
    JSON_EXTRACT(IF(core_auto_accept_completed_tasks, 'true', 'false'), '$'))));
ALTER TABLE business_projects DROP COLUMN core_auto_accept_completed_tasks;
