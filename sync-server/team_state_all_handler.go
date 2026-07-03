package main

import (
	"context"
	"net/http"
	"time"
)

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
