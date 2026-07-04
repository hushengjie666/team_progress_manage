package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

func (a *app) handleTeamData(w http.ResponseWriter, r *http.Request, auth authContext) {
	if a.db == nil {
		writeError(w, http.StatusServiceUnavailable, "team api requires mysql storage")
		return
	}
	if r.Method == http.MethodGet {
		a.handleTeamDataLoad(w, r, auth)
		return
	}
	if r.Method == http.MethodPut {
		a.handleTeamDataSave(w, r, auth)
		return
	}
	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
}

func (a *app) handleTeamDataLoad(w http.ResponseWriter, r *http.Request, auth authContext) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()
	rows, err := a.businessRowsForAccount(ctx, auth)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load team data failed")
		return
	}
	writeJSON(w, http.StatusOK, teamDataResponse{Rows: rows})
}

func (a *app) handleTeamDataSave(w http.ResponseWriter, r *http.Request, auth authContext) {
	if r.Method != http.MethodPut {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req teamDataSaveRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if len(req.Rows) > 2000 {
		writeError(w, http.StatusBadRequest, "too many rows")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	tx, err := a.db.BeginTx(ctx, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	defer mysqlRollback(tx)

	currentRows, err := a.businessRowsForAccount(ctx, auth)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load team data failed")
		return
	}
	nextRows := []businessRow{}
	nextKeys := map[string]bool{}
	submittedTaskProjects := map[string]string{}
	for _, row := range req.Rows {
		targetWorkspaceID := businessWorkspaceIDForRow(auth, row)
		if strings.TrimSpace(targetWorkspaceID) == "" {
			continue
		}
		row.WorkspaceID = targetWorkspaceID
		if strings.TrimSpace(row.AccountID) == "" {
			row.AccountID = auth.AccountID
		}
		row.Entity = strings.TrimSpace(row.Entity)
		row.ID = strings.TrimSpace(row.ID)
		if row.Entity == "" || row.ID == "" {
			continue
		}
		if _, ok := businessTableForEntity(row.Entity); !ok {
			continue
		}
		if row.UpdatedAt == "" {
			row.UpdatedAt = time.Now().UTC().Format(time.RFC3339Nano)
		}
		if !json.Valid(row.Payload) || len(row.Payload) == 0 {
			row.Payload = json.RawMessage(`{}`)
		}
		nextRows = append(nextRows, row)
		nextKeys[businessRowKey(row)] = true
		if row.Entity == "task" {
			submittedTaskProjects[businessTaskWorkspaceKey(row.WorkspaceID, row.ID)] = businessProjectID(row)
		}
	}
	for _, row := range nextRows {
		if _, found, err := mysqlWorkspaceVisibleToAccount(ctx, tx, auth.AccountID, row.WorkspaceID); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		} else if !found {
			allowed, err := businessRowWritableByProjectAccess(ctx, tx, auth, row, submittedTaskProjects)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "save failed")
				return
			}
			if !allowed {
				writeError(w, http.StatusForbidden, "workspace access denied")
				return
			}
		}
	}
	for _, current := range currentRows {
		if nextKeys[businessRowKey(current)] {
			continue
		}
		if err := businessDeleteRow(ctx, tx, current); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
	}
	for _, row := range nextRows {
		if err := businessUpsertRow(ctx, tx, row); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	rows, err := a.businessRowsForAccount(ctx, auth)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load team data failed")
		return
	}
	writeJSON(w, http.StatusOK, teamDataResponse{Rows: rows})
}

func (a *app) businessRowsForAccount(ctx context.Context, auth authContext) ([]businessRow, error) {
	workspaces, err := mysqlWorkspaceSummariesForAccount(ctx, a.db, auth.AccountID)
	if err != nil {
		return nil, err
	}
	rows := []businessRow{}
	for _, workspace := range workspaces {
		if _, fullAccess, err := mysqlWorkspaceVisibleToAccount(ctx, a.db, auth.AccountID, workspace.ID); err != nil {
			return nil, err
		} else if fullAccess {
			workspaceRows, err := businessLoadRows(ctx, a.db, workspace.ID)
			if err != nil {
				return nil, err
			}
			rows = append(rows, workspaceRows...)
			continue
		}
		projectIDs, err := teamProjectIDsForAccount(ctx, a.db, workspace.ID, auth.AccountID)
		if err != nil {
			return nil, err
		}
		workspaceRows, err := businessLoadRowsForProjects(ctx, a.db, workspace.ID, projectIDs, auth.AccountID)
		if err != nil {
			return nil, err
		}
		rows = append(rows, workspaceRows...)
	}
	return rows, nil
}

func businessWorkspaceIDForRow(auth authContext, row businessRow) string {
	if strings.TrimSpace(row.WorkspaceID) != "" {
		return strings.TrimSpace(row.WorkspaceID)
	}
	return auth.WorkspaceID
}

func businessRowKey(row businessRow) string {
	return strings.TrimSpace(row.WorkspaceID) + ":" + strings.TrimSpace(row.Entity) + ":" + strings.TrimSpace(row.ID)
}

func businessTaskWorkspaceKey(workspaceID string, taskID string) string {
	return strings.TrimSpace(workspaceID) + ":" + strings.TrimSpace(taskID)
}

func businessRowWritableByProjectAccess(ctx context.Context, q sqlRunner, auth authContext, row businessRow, submittedTaskProjects map[string]string) (bool, error) {
	if businessPersonalRowOwnedByAccount(row, auth.AccountID) {
		return businessPersonalRowTaskRefsAllowed(ctx, q, auth, row, submittedTaskProjects)
	}
	projectID, err := businessProjectIDForWriteRow(ctx, q, row.WorkspaceID, row, submittedTaskProjects)
	if err != nil {
		return false, err
	}
	return teamAccountCanAccessProject(ctx, q, row.WorkspaceID, auth.AccountID, projectID)
}

func businessPersonalRowOwnedByAccount(row businessRow, accountID string) bool {
	if row.Entity != "daily_plan" && row.Entity != "reward_state" {
		return false
	}
	rowAccountID := firstNonEmpty(row.AccountID, stringField(row.Payload, "ownerAccountId"), stringField(row.Payload, "accountId"))
	return strings.TrimSpace(rowAccountID) == strings.TrimSpace(accountID)
}

func businessPersonalRowTaskRefsAllowed(ctx context.Context, q sqlRunner, auth authContext, row businessRow, submittedTaskProjects map[string]string) (bool, error) {
	taskIDs := businessReferencedTaskIDs(row)
	if len(taskIDs) == 0 {
		return true, nil
	}
	for _, taskID := range taskIDs {
		projectID, err := businessProjectIDForTask(ctx, q, row.WorkspaceID, taskID, submittedTaskProjects)
		if err != nil {
			return false, err
		}
		allowed, err := teamAccountCanAccessProject(ctx, q, row.WorkspaceID, auth.AccountID, projectID)
		if err != nil || !allowed {
			return allowed, err
		}
	}
	return true, nil
}

func businessReferencedTaskIDs(row businessRow) []string {
	ids := []string{}
	if taskID := businessTaskID(row); taskID != "" {
		ids = append(ids, taskID)
	}
	for _, field := range []string{"committedTaskIds", "suggestedTaskIds"} {
		ids = append(ids, stringSliceField(row.Payload, field)...)
	}
	return teamUniqueStrings(ids)
}

func stringSliceField(payload json.RawMessage, field string) []string {
	var value map[string]any
	if err := json.Unmarshal(payload, &value); err != nil {
		return nil
	}
	raw, ok := value[field].([]any)
	if !ok {
		return nil
	}
	result := []string{}
	for _, item := range raw {
		if text, ok := item.(string); ok && strings.TrimSpace(text) != "" {
			result = append(result, strings.TrimSpace(text))
		}
	}
	return result
}

func businessProjectIDForWriteRow(ctx context.Context, q sqlRunner, workspaceID string, row businessRow, submittedTaskProjects map[string]string) (string, error) {
	if projectID := businessProjectID(row); projectID != "" {
		return projectID, nil
	}
	if taskID := businessTaskID(row); taskID != "" {
		return businessProjectIDForTask(ctx, q, workspaceID, taskID, submittedTaskProjects)
	}
	return "", nil
}

func businessProjectIDForTask(ctx context.Context, q sqlRunner, workspaceID string, taskID string, submittedTaskProjects map[string]string) (string, error) {
	if projectID := submittedTaskProjects[businessTaskWorkspaceKey(workspaceID, taskID)]; projectID != "" {
		return projectID, nil
	}
	return mysqlBusinessTaskProjectID(ctx, q, workspaceID, taskID)
}

func mysqlBusinessTaskProjectID(ctx context.Context, q sqlRunner, workspaceID string, taskID string) (string, error) {
	var projectID string
	err := q.QueryRowContext(ctx, `SELECT project_id FROM business_tasks WHERE workspace_id = ? AND id = ?`, workspaceID, taskID).Scan(&projectID)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return projectID, err
}
