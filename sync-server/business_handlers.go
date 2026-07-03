package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

func (a *app) handleBusinessState(w http.ResponseWriter, r *http.Request, auth authContext) {
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
	rows, err := a.businessRowsForAccount(ctx, auth)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load business state failed")
		return
	}
	writeJSON(w, http.StatusOK, businessStateResponse{Rows: rows})
}

func (a *app) handleBusinessChanges(w http.ResponseWriter, r *http.Request, auth authContext) {
	if a.db == nil {
		writeError(w, http.StatusServiceUnavailable, "team api requires mysql storage")
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req businessChangesRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if len(req.Changes) > 2000 {
		writeError(w, http.StatusBadRequest, "too many changes")
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
	for _, change := range req.Changes {
		targetWorkspaceID := businessWorkspaceIDForChange(auth, change)
		if strings.TrimSpace(targetWorkspaceID) == "" {
			continue
		}
		change.WorkspaceID = targetWorkspaceID
		change.AccountID = auth.AccountID
		change.Entity = strings.TrimSpace(change.Entity)
		change.ID = strings.TrimSpace(change.ID)
		if change.Entity == "" || change.ID == "" {
			continue
		}
		if _, ok := businessTableForEntity(change.Entity); !ok {
			continue
		}
		if change.UpdatedAt == "" {
			change.UpdatedAt = time.Now().UTC().Format(time.RFC3339Nano)
		}
		if change.DeletedAt == "" && (!json.Valid(change.Payload) || len(change.Payload) == 0) {
			change.Payload = json.RawMessage(`{}`)
		}
		if _, found, err := mysqlWorkspaceVisibleToAccount(ctx, tx, auth.AccountID, targetWorkspaceID); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		} else if !found {
			projectID, err := businessProjectIDForWriteRow(ctx, tx, targetWorkspaceID, change)
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
		if err := businessUpsertRow(ctx, tx, change); err != nil {
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
		writeError(w, http.StatusInternalServerError, "load business state failed")
		return
	}
	writeJSON(w, http.StatusOK, businessStateResponse{Rows: rows})
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
		workspaceRows, err := businessLoadRowsForProjects(ctx, a.db, workspace.ID, projectIDs)
		if err != nil {
			return nil, err
		}
		rows = append(rows, workspaceRows...)
	}
	return rows, nil
}

func businessWorkspaceIDForChange(auth authContext, row businessRow) string {
	if strings.TrimSpace(row.WorkspaceID) != "" {
		return strings.TrimSpace(row.WorkspaceID)
	}
	return auth.WorkspaceID
}

func businessProjectIDForWriteRow(ctx context.Context, q sqlRunner, workspaceID string, row businessRow) (string, error) {
	if projectID := businessProjectID(row); projectID != "" {
		return projectID, nil
	}
	if taskID := businessTaskID(row); taskID != "" {
		return mysqlBusinessTaskProjectID(ctx, q, workspaceID, taskID)
	}
	return "", nil
}

func mysqlBusinessTaskProjectID(ctx context.Context, q sqlRunner, workspaceID string, taskID string) (string, error) {
	var projectID string
	err := q.QueryRowContext(ctx, `SELECT project_id FROM business_tasks WHERE workspace_id = ? AND id = ?`, workspaceID, taskID).Scan(&projectID)
	return projectID, err
}
