package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

func (a *app) handleMemberByIDMySQL(w http.ResponseWriter, r *http.Request, auth authContext) {
	if r.Method != http.MethodPatch {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	memberID := strings.Trim(strings.TrimPrefix(r.URL.Path, "/members/"), "/")
	if memberID == "" {
		writeError(w, http.StatusBadRequest, "member id is required")
		return
	}
	var req memberRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	targetWorkspaceID := strings.TrimSpace(req.WorkspaceID)
	if targetWorkspaceID == "" {
		targetWorkspaceID = auth.WorkspaceID
	}
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	tx, err := a.db.BeginTx(ctx, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	defer mysqlRollback(tx)
	if failure := validateMemberWriteTarget(ctx, tx, auth, targetWorkspaceID, ""); writeMemberFailure(w, failure) {
		return
	}
	existing, found, err := businessExistingRow(ctx, tx, targetWorkspaceID, "project_member", memberID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if !found {
		writeError(w, http.StatusNotFound, "member not found")
		return
	}
	var payload map[string]any
	if err := json.Unmarshal(existing.Payload, &payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid member payload")
		return
	}
	now := time.Now().UTC().Format(time.RFC3339)
	applyMemberUpdateRequest(payload, req, targetWorkspaceID, now)
	if failure := syncMemberAccountPasswordForUpdate(ctx, tx, payload, req, now); writeMemberFailure(w, failure) {
		return
	}
	bytes, _ := json.Marshal(payload)
	existing.WorkspaceID = targetWorkspaceID
	existing.UpdatedAt = now
	existing.Payload = bytes
	if err := businessUpsertRow(ctx, tx, existing); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if err := mysqlTouchWorkspace(ctx, tx, targetWorkspaceID, now); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	writeJSON(w, http.StatusOK, memberResponse{Member: existing})
}
