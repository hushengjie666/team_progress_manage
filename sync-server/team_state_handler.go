package main

import (
	"context"
	"net/http"
	"time"
)

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
