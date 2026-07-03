package main

import (
	"context"
	"net/http"
	"strings"
	"time"
)

func (a *app) handleProjectInvitationByID(w http.ResponseWriter, r *http.Request, auth authContext) {
	if a.db == nil {
		writeError(w, http.StatusNotImplemented, "project invitations require mysql backend")
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	actionPath := strings.Trim(strings.TrimPrefix(r.URL.Path, "/project-invitations/"), "/")
	invitationID := strings.TrimSuffix(actionPath, "/accept")
	if invitationID == actionPath || strings.TrimSpace(invitationID) == "" {
		writeError(w, http.StatusBadRequest, "unsupported invitation action")
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
	if failure := acceptProjectInvitationInTx(ctx, tx, auth, invitationID); writeMemberFailure(w, failure) {
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	accepted, _, err := mysqlProjectInvitationSummaryByID(ctx, a.db, invitationID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load project invitation failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"invitation": accepted})
}
