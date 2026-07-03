package main

import (
	"context"
	"net/http"
	"time"
)

func (a *app) handleAuthStatusMySQL(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	count, err := mysqlAccountCount(ctx, a.db)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load auth status failed")
		return
	}
	workspace, _, err := mysqlFirstWorkspace(ctx, a.db)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load workspace failed")
		return
	}
	writeJSON(w, http.StatusOK, authStatusResponse{
		Bootstrapped:  count > 0,
		WorkspaceID:   workspace.ID,
		WorkspaceName: workspace.Name,
	})
}
