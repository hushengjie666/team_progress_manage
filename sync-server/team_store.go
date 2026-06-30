package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type teamEntityTable struct {
	entity string
	table  string
}

var teamEntityTables = []teamEntityTable{
	{entity: "project", table: "team_projects"},
	{entity: "team_member", table: "team_team_members"},
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
	result := []syncRow{}
	for _, spec := range teamEntityTables {
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
	if err := teamEnsureMigrated(ctx, a.db, auth.WorkspaceID); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
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
	for _, change := range req.Changes {
		change.UserID = auth.AccountID
		change.AccountID = auth.AccountID
		change.WorkspaceID = auth.WorkspaceID
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
		change.Revision = nextRevision
		nextRevision++
		if err := teamUpsertRow(ctx, tx, change); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		accepted = append(accepted, change)
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
	if len(accepted) > 0 {
		a.notifyWorkspaceChanged(auth.WorkspaceID, currentRevision, req.DeviceID)
	}
	writeJSON(w, http.StatusOK, pushResponse{Accepted: accepted, Conflicts: nil, CurrentRevision: currentRevision})
}
