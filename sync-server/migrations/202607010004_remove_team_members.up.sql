CREATE TABLE IF NOT EXISTS team_team_members_legacy_backup LIKE team_team_members;
INSERT IGNORE INTO team_team_members_legacy_backup SELECT * FROM team_team_members;

CREATE TABLE IF NOT EXISTS sync_rows_team_members_legacy_backup LIKE sync_rows;
INSERT IGNORE INTO sync_rows_team_members_legacy_backup SELECT * FROM sync_rows WHERE entity = 'team_member';

UPDATE team_project_members pm
JOIN team_team_members tm
  ON tm.workspace_id = pm.workspace_id
 AND tm.id = JSON_UNQUOTE(JSON_EXTRACT(pm.payload, '$.teamMemberId'))
SET pm.payload = JSON_SET(pm.payload, '$.accountId', JSON_UNQUOTE(JSON_EXTRACT(tm.payload, '$.accountId')))
WHERE JSON_CONTAINS_PATH(pm.payload, 'one', '$.teamMemberId')
  AND NOT JSON_CONTAINS_PATH(pm.payload, 'one', '$.accountId')
  AND JSON_CONTAINS_PATH(tm.payload, 'one', '$.accountId');

UPDATE team_project_members pm
JOIN team_team_members tm
  ON tm.workspace_id = pm.workspace_id
 AND tm.id = JSON_UNQUOTE(JSON_EXTRACT(pm.payload, '$.teamMemberId'))
SET pm.payload = JSON_SET(pm.payload, '$.name', JSON_UNQUOTE(JSON_EXTRACT(tm.payload, '$.name')))
WHERE JSON_CONTAINS_PATH(pm.payload, 'one', '$.teamMemberId')
  AND NOT JSON_CONTAINS_PATH(pm.payload, 'one', '$.name')
  AND JSON_CONTAINS_PATH(tm.payload, 'one', '$.name');

UPDATE team_project_members pm
JOIN team_team_members tm
  ON tm.workspace_id = pm.workspace_id
 AND tm.id = JSON_UNQUOTE(JSON_EXTRACT(pm.payload, '$.teamMemberId'))
SET pm.payload = JSON_SET(pm.payload, '$.email', JSON_UNQUOTE(JSON_EXTRACT(tm.payload, '$.email')))
WHERE JSON_CONTAINS_PATH(pm.payload, 'one', '$.teamMemberId')
  AND NOT JSON_CONTAINS_PATH(pm.payload, 'one', '$.email')
  AND JSON_CONTAINS_PATH(tm.payload, 'one', '$.email');

UPDATE team_project_members pm
LEFT JOIN team_team_members tm
  ON tm.workspace_id = pm.workspace_id
 AND tm.id = JSON_UNQUOTE(JSON_EXTRACT(pm.payload, '$.teamMemberId'))
SET pm.account_ref = COALESCE(
    NULLIF(NULLIF(pm.account_ref, ''), 'null'),
    NULLIF(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(pm.payload, '$.accountId')), ''), 'null'),
    NULLIF(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(tm.payload, '$.accountId')), ''), 'null'),
    pm.account_ref
  ),
  pm.payload = JSON_REMOVE(pm.payload, '$.teamMemberId')
WHERE JSON_CONTAINS_PATH(pm.payload, 'one', '$.teamMemberId');

UPDATE sync_rows sr
JOIN team_team_members_legacy_backup tm
  ON tm.workspace_id = sr.workspace_id
 AND tm.id = JSON_UNQUOTE(JSON_EXTRACT(sr.payload, '$.teamMemberId'))
SET sr.payload = JSON_SET(sr.payload, '$.accountId', JSON_UNQUOTE(JSON_EXTRACT(tm.payload, '$.accountId')))
WHERE sr.entity = 'project_member'
  AND JSON_CONTAINS_PATH(sr.payload, 'one', '$.teamMemberId')
  AND NOT JSON_CONTAINS_PATH(sr.payload, 'one', '$.accountId')
  AND JSON_CONTAINS_PATH(tm.payload, 'one', '$.accountId');

UPDATE sync_rows sr
JOIN team_team_members_legacy_backup tm
  ON tm.workspace_id = sr.workspace_id
 AND tm.id = JSON_UNQUOTE(JSON_EXTRACT(sr.payload, '$.teamMemberId'))
SET sr.payload = JSON_SET(sr.payload, '$.name', JSON_UNQUOTE(JSON_EXTRACT(tm.payload, '$.name')))
WHERE sr.entity = 'project_member'
  AND JSON_CONTAINS_PATH(sr.payload, 'one', '$.teamMemberId')
  AND NOT JSON_CONTAINS_PATH(sr.payload, 'one', '$.name')
  AND JSON_CONTAINS_PATH(tm.payload, 'one', '$.name');

UPDATE sync_rows sr
JOIN team_team_members_legacy_backup tm
  ON tm.workspace_id = sr.workspace_id
 AND tm.id = JSON_UNQUOTE(JSON_EXTRACT(sr.payload, '$.teamMemberId'))
SET sr.payload = JSON_SET(sr.payload, '$.email', JSON_UNQUOTE(JSON_EXTRACT(tm.payload, '$.email')))
WHERE sr.entity = 'project_member'
  AND JSON_CONTAINS_PATH(sr.payload, 'one', '$.teamMemberId')
  AND NOT JSON_CONTAINS_PATH(sr.payload, 'one', '$.email')
  AND JSON_CONTAINS_PATH(tm.payload, 'one', '$.email');

UPDATE sync_rows
SET payload = JSON_REMOVE(payload, '$.teamMemberId')
WHERE entity = 'project_member'
  AND JSON_CONTAINS_PATH(payload, 'one', '$.teamMemberId');

DELETE FROM sync_rows WHERE entity = 'team_member';

DROP TABLE IF EXISTS team_team_members;
