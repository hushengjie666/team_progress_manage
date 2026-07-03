package main

import (
	"context"
	"net/http"
	"time"
)

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
