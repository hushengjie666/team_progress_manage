package main

import (
	"context"
	"net/http"
	"time"
)

func (a *app) handleProjectInvitationList(w http.ResponseWriter, r *http.Request, auth authContext) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	invitations, err := mysqlProjectInvitationSummariesForAccount(ctx, a.db, auth.AccountID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load project invitations failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"invitations": invitations})
}
