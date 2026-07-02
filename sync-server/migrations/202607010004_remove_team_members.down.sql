CREATE TABLE IF NOT EXISTS team_team_members LIKE team_projects;
INSERT IGNORE INTO team_team_members SELECT * FROM team_team_members_legacy_backup;
INSERT IGNORE INTO sync_rows SELECT * FROM sync_rows_team_members_legacy_backup;

UPDATE team_project_members pm
JOIN team_team_members_legacy_backup tm
  ON tm.workspace_id = pm.workspace_id
 AND JSON_UNQUOTE(JSON_EXTRACT(tm.payload, '$.accountId')) = pm.account_ref
SET pm.payload = JSON_SET(pm.payload, '$.teamMemberId', tm.id)
WHERE NOT JSON_CONTAINS_PATH(pm.payload, 'one', '$.teamMemberId');

UPDATE sync_rows sr
JOIN team_team_members_legacy_backup tm
  ON tm.workspace_id = sr.workspace_id
 AND JSON_UNQUOTE(JSON_EXTRACT(tm.payload, '$.accountId')) = JSON_UNQUOTE(JSON_EXTRACT(sr.payload, '$.accountId'))
SET sr.payload = JSON_SET(sr.payload, '$.teamMemberId', tm.id)
WHERE sr.entity = 'project_member'
  AND NOT JSON_CONTAINS_PATH(sr.payload, 'one', '$.teamMemberId');

DROP TABLE IF EXISTS team_team_members_legacy_backup;
DROP TABLE IF EXISTS sync_rows_team_members_legacy_backup;
