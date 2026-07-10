package main

import (
	"context"
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
	if req.ProtocolVersion != 2 || req.Rows != nil {
		writeError(w, http.StatusUpgradeRequired, "client write protocol must be upgraded")
		return
	}
	if len(req.Operations) > 2000 {
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

	for _, operation := range req.Operations {
		failure := applyBusinessOperation(ctx, tx, auth, operation)
		if failure.status != 0 {
			writeError(w, failure.status, failure.message)
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

func businessPayloadWithWorkspaceID(entity string, payload json.RawMessage, workspaceID string) json.RawMessage {
	if strings.TrimSpace(workspaceID) == "" {
		return payload
	}
	switch entity {
	case "project", "project_member", "task", "daily_plan", "interruption":
	default:
		return payload
	}
	var value map[string]any
	if err := json.Unmarshal(payload, &value); err != nil {
		return payload
	}
	if current, ok := value["workspaceId"].(string); ok && strings.TrimSpace(current) == strings.TrimSpace(workspaceID) {
		return payload
	}
	value["workspaceId"] = strings.TrimSpace(workspaceID)
	next, err := json.Marshal(value)
	if err != nil {
		return payload
	}
	return next
}

func businessRowKey(row businessRow) string {
	return strings.TrimSpace(row.WorkspaceID) + ":" + strings.TrimSpace(row.Entity) + ":" + strings.TrimSpace(row.ID)
}
