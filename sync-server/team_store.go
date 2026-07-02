package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"
)

type teamEntityTable struct {
	entity string
	table  string
}

var teamEntityTables = []teamEntityTable{
	{entity: "project", table: "team_projects"},
	{entity: "project_member", table: "team_project_members"},
	{entity: "task", table: "team_tasks"},
	{entity: "daily_plan", table: "team_daily_plans"},
	{entity: "focus_session", table: "team_focus_sessions"},
	{entity: "work_session", table: "team_work_sessions"},
	{entity: "execution_signal", table: "team_execution_signals"},
	{entity: "interruption", table: "team_interruptions"},
	{entity: "strict_violation", table: "team_strict_violations"},
	{entity: "block_profile", table: "team_block_profiles"},
	{entity: "settings", table: "team_settings"},
	{entity: "onboarding", table: "team_onboarding"},
	{entity: "reward_state", table: "team_reward_state"},
}

var teamSingletonEntities = map[string]bool{
	"settings":     true,
	"onboarding":   true,
	"reward_state": true,
}

func teamTableForEntity(entity string) (teamEntityTable, bool) {
	for _, spec := range teamEntityTables {
		if spec.entity == entity {
			return spec, true
		}
	}
	return teamEntityTable{}, false
}

func teamTableTotalRows(ctx context.Context, q sqlRunner, workspaceID string) (int, error) {
	total := 0
	for _, spec := range teamEntityTables {
		var count int
		if err := q.QueryRowContext(ctx, fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE workspace_id = ?", spec.table), workspaceID).Scan(&count); err != nil {
			return total, err
		}
		total += count
	}
	return total, nil
}

func teamEnsureMigrated(ctx context.Context, db *sql.DB, workspaceID string) error {
	total, err := teamTableTotalRows(ctx, db, workspaceID)
	if err != nil {
		return err
	}
	if total > 0 {
		return nil
	}
	rows, err := mysqlPullRows(ctx, db, workspaceID, 0)
	if err != nil {
		return err
	}
	if len(rows) == 0 {
		return nil
	}
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer mysqlRollback(tx)
	for _, row := range rows {
		if _, ok := teamTableForEntity(row.Entity); !ok {
			continue
		}
		if err := teamUpsertRow(ctx, tx, row); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func teamLoadRows(ctx context.Context, q sqlRunner, workspaceID string) ([]syncRow, error) {
	return teamLoadRowsWithOptions(ctx, q, workspaceID, true)
}

func teamLoadRowsWithOptions(ctx context.Context, q sqlRunner, workspaceID string, includeSingletons bool) ([]syncRow, error) {
	result := []syncRow{}
	for _, spec := range teamEntityTables {
		if !includeSingletons && teamSingletonEntities[spec.entity] {
			continue
		}
		query := fmt.Sprintf(
			`SELECT workspace_id, '%s' AS entity, id, user_id, account_id, device_id, updated_at, deleted_at, version, revision, payload
			 FROM %s WHERE workspace_id = ? ORDER BY revision ASC`,
			spec.entity,
			spec.table,
		)
		rows, err := q.QueryContext(ctx, query, workspaceID)
		if err != nil {
			return result, err
		}
		items, scanErr := scanSyncRows(rows)
		closeErr := rows.Close()
		if scanErr != nil {
			return result, scanErr
		}
		if closeErr != nil {
			return result, closeErr
		}
		result = append(result, items...)
	}
	return result, nil
}

func teamUniqueStrings(values []string) []string {
	seen := map[string]bool{}
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" || seen[value] {
			continue
		}
		seen[value] = true
		result = append(result, value)
	}
	return result
}

func teamPlaceholders(count int) string {
	if count <= 0 {
		return ""
	}
	parts := make([]string, count)
	for index := range parts {
		parts[index] = "?"
	}
	return strings.Join(parts, ",")
}

func teamLoadRowsByColumn(ctx context.Context, q sqlRunner, spec teamEntityTable, workspaceID string, column string, values []string) ([]syncRow, error) {
	values = teamUniqueStrings(values)
	if len(values) == 0 {
		return nil, nil
	}
	args := make([]any, 0, len(values)+1)
	args = append(args, workspaceID)
	for _, value := range values {
		args = append(args, value)
	}
	query := fmt.Sprintf(
		`SELECT workspace_id, '%s' AS entity, id, user_id, account_id, device_id, updated_at, deleted_at, version, revision, payload
		 FROM %s WHERE workspace_id = ? AND %s IN (%s) ORDER BY revision ASC`,
		spec.entity,
		spec.table,
		column,
		teamPlaceholders(len(values)),
	)
	rows, err := q.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanSyncRows(rows)
}

func teamRowsDedupeAndSort(groups ...[]syncRow) []syncRow {
	byKey := map[string]syncRow{}
	for _, rows := range groups {
		for _, row := range rows {
			key := row.WorkspaceID + "/" + row.Entity + "/" + row.ID
			if existing, ok := byKey[key]; !ok || row.Revision >= existing.Revision {
				byKey[key] = row
			}
		}
	}
	result := make([]syncRow, 0, len(byKey))
	for _, row := range byKey {
		result = append(result, row)
	}
	sort.SliceStable(result, func(i, j int) bool {
		if result[i].Revision != result[j].Revision {
			return result[i].Revision < result[j].Revision
		}
		if result[i].Entity != result[j].Entity {
			return result[i].Entity < result[j].Entity
		}
		return result[i].ID < result[j].ID
	})
	return result
}

func teamProjectIDsForAccount(ctx context.Context, q sqlRunner, workspaceID string, accountID string) ([]string, error) {
	rows, err := q.QueryContext(
		ctx,
		`SELECT DISTINCT project_id
		 FROM team_project_members
		 WHERE workspace_id = ? AND account_ref = ? AND project_id IS NOT NULL AND project_id <> ''
		   AND deleted_at IS NULL AND COALESCE(NULLIF(status, ''), 'active') = 'active'`,
		workspaceID,
		accountID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	projectIDs := []string{}
	for rows.Next() {
		var projectID string
		if err := rows.Scan(&projectID); err != nil {
			return nil, err
		}
		projectIDs = append(projectIDs, projectID)
	}
	return teamUniqueStrings(projectIDs), rows.Err()
}

func teamAccountCanAccessProject(ctx context.Context, q sqlRunner, workspaceID string, accountID string, projectID string) (bool, error) {
	if strings.TrimSpace(projectID) == "" {
		return false, nil
	}
	var count int
	err := q.QueryRowContext(
		ctx,
		`SELECT COUNT(*)
		 FROM team_project_members
		 WHERE workspace_id = ? AND project_id = ? AND account_ref = ?
		   AND deleted_at IS NULL AND COALESCE(NULLIF(status, ''), 'active') = 'active'`,
		workspaceID,
		projectID,
		accountID,
	).Scan(&count)
	return count > 0, err
}

func teamAccountCanManageWorkspace(ctx context.Context, q sqlRunner, auth authContext, workspaceID string) (bool, error) {
	if isDefaultAdminAuth(auth) {
		if _, found, err := mysqlWorkspaceByID(ctx, q, workspaceID); err != nil || !found {
			return false, err
		}
		return true, nil
	}
	membership, found, err := mysqlActiveMembershipByAccountAndWorkspace(ctx, q, auth.AccountID, workspaceID)
	if err != nil || !found {
		return false, err
	}
	return membership.Role == "owner" || membership.Role == "admin", nil
}

func teamAccountCanManageProjectMembers(ctx context.Context, q sqlRunner, workspaceID string, accountID string, projectID string) (bool, error) {
	rows, err := q.QueryContext(
		ctx,
		`SELECT workspace_id, 'project_member' AS entity, id, user_id, account_id, device_id, updated_at, deleted_at, version, revision, payload
		 FROM team_project_members
		 WHERE workspace_id = ? AND project_id = ? AND account_ref = ?
		   AND deleted_at IS NULL AND COALESCE(NULLIF(status, ''), 'active') = 'active'`,
		workspaceID,
		projectID,
		accountID,
	)
	if err != nil {
		return false, err
	}
	defer rows.Close()
	items, err := scanSyncRows(rows)
	if err != nil {
		return false, err
	}
	for _, row := range items {
		if hasRole(row.Payload, "project_owner") {
			return true, nil
		}
	}
	return false, nil
}

func teamLoadRowsForProjects(ctx context.Context, q sqlRunner, workspaceID string, projectIDs []string) ([]syncRow, error) {
	projectIDs = teamUniqueStrings(projectIDs)
	if len(projectIDs) == 0 {
		return nil, nil
	}
	projectSpec, _ := teamTableForEntity("project")
	projectMemberSpec, _ := teamTableForEntity("project_member")
	taskSpec, _ := teamTableForEntity("task")
	workSessionSpec, _ := teamTableForEntity("work_session")
	executionSignalSpec, _ := teamTableForEntity("execution_signal")
	focusSessionSpec, _ := teamTableForEntity("focus_session")
	interruptionSpec, _ := teamTableForEntity("interruption")
	strictViolationSpec, _ := teamTableForEntity("strict_violation")

	projectRows, err := teamLoadRowsByColumn(ctx, q, projectSpec, workspaceID, "id", projectIDs)
	if err != nil {
		return nil, err
	}
	projectMemberRows, err := teamLoadRowsByColumn(ctx, q, projectMemberSpec, workspaceID, "project_id", projectIDs)
	if err != nil {
		return nil, err
	}
	taskRows, err := teamLoadRowsByColumn(ctx, q, taskSpec, workspaceID, "project_id", projectIDs)
	if err != nil {
		return nil, err
	}

	taskIDs := []string{}
	for _, row := range taskRows {
		taskIDs = append(taskIDs, row.ID)
	}
	workSessionRows, err := teamLoadRowsByColumn(ctx, q, workSessionSpec, workspaceID, "task_id", taskIDs)
	if err != nil {
		return nil, err
	}
	executionSignalRows, err := teamLoadRowsByColumn(ctx, q, executionSignalSpec, workspaceID, "task_id", taskIDs)
	if err != nil {
		return nil, err
	}
	focusSessionRowsByTask, err := teamLoadRowsByColumn(ctx, q, focusSessionSpec, workspaceID, "task_id", taskIDs)
	if err != nil {
		return nil, err
	}
	focusSessionIDs := []string{}
	for _, row := range workSessionRows {
		if value := stringField(row.Payload, "focusSessionId"); value != "" {
			focusSessionIDs = append(focusSessionIDs, value)
		}
	}
	focusSessionRowsByID, err := teamLoadRowsByColumn(ctx, q, focusSessionSpec, workspaceID, "id", focusSessionIDs)
	if err != nil {
		return nil, err
	}
	interruptionRows, err := teamLoadRowsByColumn(ctx, q, interruptionSpec, workspaceID, "task_id", taskIDs)
	if err != nil {
		return nil, err
	}
	strictViolationRows, err := teamLoadRowsByColumn(ctx, q, strictViolationSpec, workspaceID, "task_id", taskIDs)
	if err != nil {
		return nil, err
	}

	return teamRowsDedupeAndSort(
		projectRows,
		projectMemberRows,
		taskRows,
		workSessionRows,
		executionSignalRows,
		focusSessionRowsByTask,
		focusSessionRowsByID,
		interruptionRows,
		strictViolationRows,
	), nil
}

func teamExistingRow(ctx context.Context, q sqlRunner, workspaceID string, entity string, id string) (syncRow, bool, error) {
	spec, ok := teamTableForEntity(entity)
	if !ok || id == "" {
		return syncRow{}, false, nil
	}
	rows, err := teamLoadRowsByColumn(ctx, q, spec, workspaceID, "id", []string{id})
	if err != nil {
		return syncRow{}, false, err
	}
	if len(rows) == 0 {
		return syncRow{}, false, nil
	}
	return rows[0], true, nil
}

func teamTaskProjectID(ctx context.Context, q sqlRunner, workspaceID string, taskID string) (string, error) {
	if strings.TrimSpace(taskID) == "" {
		return "", nil
	}
	var projectID sql.NullString
	err := q.QueryRowContext(ctx, `SELECT project_id FROM team_tasks WHERE workspace_id = ? AND id = ?`, workspaceID, taskID).Scan(&projectID)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	if projectID.Valid {
		return projectID.String, nil
	}
	return "", nil
}

func teamProjectIDForWriteRow(ctx context.Context, q sqlRunner, workspaceID string, row syncRow) (string, error) {
	if projectID := teamProjectID(row); projectID != "" {
		return projectID, nil
	}
	if existing, found, err := teamExistingRow(ctx, q, workspaceID, row.Entity, row.ID); err != nil {
		return "", err
	} else if found {
		if projectID := teamProjectID(existing); projectID != "" {
			return projectID, nil
		}
		if taskID := teamTaskID(existing); taskID != "" {
			return teamTaskProjectID(ctx, q, workspaceID, taskID)
		}
	}
	if taskID := teamTaskID(row); taskID != "" {
		return teamTaskProjectID(ctx, q, workspaceID, taskID)
	}
	return "", nil
}

func teamWorkspaceIDForChange(auth authContext, change syncRow) string {
	if value := strings.TrimSpace(change.WorkspaceID); value != "" {
		return value
	}
	if value := stringField(change.Payload, "workspaceId"); value != "" {
		return value
	}
	return auth.WorkspaceID
}

func teamProjectID(row syncRow) string {
	if row.Entity == "project" {
		return row.ID
	}
	if row.Entity == "project_member" || row.Entity == "task" {
		return stringField(row.Payload, "projectId")
	}
	return ""
}

func teamTaskID(row syncRow) string {
	if row.Entity == "task" {
		return row.ID
	}
	return stringField(row.Payload, "taskId")
}

func teamAccountRef(row syncRow) string {
	if value := stringField(row.Payload, "accountId"); value != "" {
		return value
	}
	return row.AccountID
}

func teamStatus(row syncRow) string {
	if value := stringField(row.Payload, "status"); value != "" {
		return value
	}
	return stringField(row.Payload, "outcome")
}

func teamKind(row syncRow) string {
	for _, field := range []string{"stage", "mode", "type", "priority", "severity"} {
		if value := stringField(row.Payload, field); value != "" {
			return value
		}
	}
	return ""
}

func teamRowDate(row syncRow) string {
	if row.Entity == "daily_plan" {
		return stringField(row.Payload, "date")
	}
	for _, field := range []string{"startedAt", "createdAt", "updatedAt"} {
		if value := stringField(row.Payload, field); len(value) >= 10 {
			return value[:10]
		}
	}
	if len(row.UpdatedAt) >= 10 {
		return row.UpdatedAt[:10]
	}
	return ""
}

func teamUpsertRow(ctx context.Context, tx *sql.Tx, row syncRow) error {
	spec, ok := teamTableForEntity(row.Entity)
	if !ok {
		return nil
	}
	payload := row.Payload
	if len(payload) == 0 {
		payload = []byte(`{}`)
	}
	_, err := tx.ExecContext(
		ctx,
		fmt.Sprintf(`INSERT INTO %s
			(workspace_id, id, user_id, account_id, device_id, project_id, task_id, account_ref, status, kind, row_date, updated_at, deleted_at, version, revision, payload)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE
				user_id = VALUES(user_id),
				account_id = VALUES(account_id),
				device_id = VALUES(device_id),
				project_id = VALUES(project_id),
				task_id = VALUES(task_id),
				account_ref = VALUES(account_ref),
				status = VALUES(status),
				kind = VALUES(kind),
				row_date = VALUES(row_date),
				updated_at = VALUES(updated_at),
				deleted_at = VALUES(deleted_at),
				version = VALUES(version),
				revision = VALUES(revision),
				payload = VALUES(payload)`, spec.table),
		row.WorkspaceID,
		row.ID,
		nullString(row.UserID),
		nullString(row.AccountID),
		row.DeviceID,
		nullString(teamProjectID(row)),
		nullString(teamTaskID(row)),
		nullString(teamAccountRef(row)),
		nullString(teamStatus(row)),
		nullString(teamKind(row)),
		nullString(teamRowDate(row)),
		row.UpdatedAt,
		nullString(row.DeletedAt),
		row.Version,
		row.Revision,
		payload,
	)
	return err
}

func (a *app) handleTeamState(w http.ResponseWriter, r *http.Request, auth authContext) {
	if a.db == nil {
		writeError(w, http.StatusServiceUnavailable, "team api requires mysql storage")
		return
	}
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	if err := teamEnsureMigrated(ctx, a.db, auth.WorkspaceID); err != nil {
		writeError(w, http.StatusInternalServerError, "load team state failed")
		return
	}
	rows, err := teamLoadRows(ctx, a.db, auth.WorkspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load team state failed")
		return
	}
	revision, err := mysqlCurrentRevision(ctx, a.db)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load revision failed")
		return
	}
	writeJSON(w, http.StatusOK, pullResponse{Changes: rows, CurrentRevision: revision})
}

func (a *app) handleTeamStateAll(w http.ResponseWriter, r *http.Request, auth authContext) {
	if a.db == nil {
		writeError(w, http.StatusServiceUnavailable, "team api requires mysql storage")
		return
	}
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()

	workspaces, err := mysqlWorkspaceSummariesForAccount(ctx, a.db, auth.AccountID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load workspaces failed")
		return
	}
	rows := []syncRow{}
	for _, workspace := range workspaces {
		if err := teamEnsureMigrated(ctx, a.db, workspace.ID); err != nil {
			writeError(w, http.StatusInternalServerError, "load team state failed")
			return
		}
		if _, fullAccess, err := mysqlWorkspaceVisibleToAccount(ctx, a.db, auth.AccountID, workspace.ID); err != nil {
			writeError(w, http.StatusInternalServerError, "load team state failed")
			return
		} else if fullAccess {
			includeSingletons := workspace.ID == auth.WorkspaceID
			workspaceRows, err := teamLoadRowsWithOptions(ctx, a.db, workspace.ID, includeSingletons)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "load team state failed")
				return
			}
			rows = append(rows, workspaceRows...)
			continue
		}
		projectIDs, err := teamProjectIDsForAccount(ctx, a.db, workspace.ID, auth.AccountID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "load team state failed")
			return
		}
		workspaceRows, err := teamLoadRowsForProjects(ctx, a.db, workspace.ID, projectIDs)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "load team state failed")
			return
		}
		rows = append(rows, workspaceRows...)
	}
	rows = teamRowsDedupeAndSort(rows)
	revision, err := mysqlCurrentRevision(ctx, a.db)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load revision failed")
		return
	}
	writeJSON(w, http.StatusOK, pullResponse{Changes: rows, CurrentRevision: revision})
}

func (a *app) handleTeamRevision(w http.ResponseWriter, r *http.Request, auth authContext) {
	if a.db == nil {
		writeError(w, http.StatusServiceUnavailable, "team api requires mysql storage")
		return
	}
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	revision, err := mysqlCurrentRevision(ctx, a.db)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load revision failed")
		return
	}
	writeJSON(w, http.StatusOK, revisionResponse{CurrentRevision: revision})
}

func (a *app) handleTeamChanges(w http.ResponseWriter, r *http.Request, auth authContext) {
	if a.db == nil {
		writeError(w, http.StatusServiceUnavailable, "team api requires mysql storage")
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req pushRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if strings.TrimSpace(req.DeviceID) == "" {
		writeError(w, http.StatusBadRequest, "device_id is required")
		return
	}
	if len(req.Changes) > 2000 {
		writeError(w, http.StatusBadRequest, "too many changes")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	targetWorkspaceIDs := map[string]bool{}
	for _, change := range req.Changes {
		workspaceID := teamWorkspaceIDForChange(auth, change)
		if workspaceID != "" {
			targetWorkspaceIDs[workspaceID] = true
		}
	}
	for workspaceID := range targetWorkspaceIDs {
		if err := teamEnsureMigrated(ctx, a.db, workspaceID); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
	}
	tx, err := a.db.BeginTx(ctx, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	defer mysqlRollback(tx)
	nextRevision, err := mysqlNextRevisionForUpdate(ctx, tx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	accepted := make([]syncRow, 0, len(req.Changes))
	changedWorkspaceRevisions := map[string]int64{}
	for _, change := range req.Changes {
		targetWorkspaceID := teamWorkspaceIDForChange(auth, change)
		if strings.TrimSpace(targetWorkspaceID) == "" {
			continue
		}
		change.UserID = auth.AccountID
		change.AccountID = auth.AccountID
		change.WorkspaceID = targetWorkspaceID
		change.DeviceID = req.DeviceID
		change.Entity = strings.TrimSpace(change.Entity)
		change.ID = strings.TrimSpace(change.ID)
		if change.Entity == "" || change.ID == "" {
			continue
		}
		if _, ok := teamTableForEntity(change.Entity); !ok {
			continue
		}
		if change.UpdatedAt == "" {
			change.UpdatedAt = time.Now().UTC().Format(time.RFC3339Nano)
		}
		if !json.Valid(change.Payload) || len(change.Payload) == 0 {
			change.Payload = json.RawMessage(`{}`)
		}
		if change.Version == 0 {
			change.Version = 1
		}
		if _, found, err := mysqlWorkspaceVisibleToAccount(ctx, tx, auth.AccountID, targetWorkspaceID); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		} else if !found {
			projectID, err := teamProjectIDForWriteRow(ctx, tx, targetWorkspaceID, change)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "save failed")
				return
			}
			allowed, err := teamAccountCanAccessProject(ctx, tx, targetWorkspaceID, auth.AccountID, projectID)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "save failed")
				return
			}
			if !allowed {
				writeError(w, http.StatusForbidden, "workspace access denied")
				return
			}
		}
		change.Revision = nextRevision
		nextRevision++
		if err := teamUpsertRow(ctx, tx, change); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		accepted = append(accepted, change)
		if change.Revision > changedWorkspaceRevisions[targetWorkspaceID] {
			changedWorkspaceRevisions[targetWorkspaceID] = change.Revision
		}
	}
	if err := mysqlSetNextRevision(ctx, tx, nextRevision); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	currentRevision := nextRevision - 1
	for workspaceID, revision := range changedWorkspaceRevisions {
		if revision == 0 {
			revision = currentRevision
		}
		a.notifyWorkspaceChanged(workspaceID, revision, req.DeviceID)
	}
	writeJSON(w, http.StatusOK, pushResponse{Accepted: accepted, Conflicts: nil, CurrentRevision: currentRevision})
}
