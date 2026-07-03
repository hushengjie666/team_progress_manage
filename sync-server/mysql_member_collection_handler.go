package main

import (
	"context"
	"net/http"
	"strings"
	"time"
)

func (a *app) handleMembersMySQL(w http.ResponseWriter, r *http.Request, auth authContext) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
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
	projectID := strings.TrimSpace(req.ProjectID)
	email := normalizeEmail(req.Email)
	if email == "" {
		writeError(w, http.StatusBadRequest, "email is required")
		return
	}
	status := strings.TrimSpace(req.Status)
	if !isWorkspaceMembershipStatus(status) {
		writeError(w, http.StatusBadRequest, "member status must be active or disabled")
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
	if failure := validateMemberWriteTarget(ctx, tx, auth, targetWorkspaceID, projectID); writeMemberFailure(w, failure) {
		return
	}
	nextRevision, err := mysqlNextRevisionForUpdate(ctx, tx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	now := time.Now().UTC().Format(time.RFC3339)
	account, failure := upsertMemberAccountForRequest(ctx, tx, req, email, targetWorkspaceID, projectID, now)
	if writeMemberFailure(w, failure) {
		return
	}
	if projectID == "" {
		if err := mysqlEnsureWorkspaceMembership(ctx, tx, targetWorkspaceID, account.ID, "member", status, now); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
	}

	memberID := "member_" + projectID + "_" + account.ID
	if projectID == "" {
		if err := mysqlTouchWorkspace(ctx, tx, targetWorkspaceID, now); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		if err := mysqlSetNextRevision(ctx, tx, nextRevision); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		if err := tx.Commit(); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		writeJSON(w, http.StatusOK, memberResponse{Account: account})
		return
	}
	existingProjectMemberRow, projectMemberExists, err := teamExistingRow(ctx, tx, targetWorkspaceID, "project_member", memberID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if !projectMemberCanBeRecreated(existingProjectMemberRow, projectMemberExists) {
		writeError(w, http.StatusConflict, "account already belongs to this project")
		return
	}
	row := makeProjectMemberRow(auth, account, targetWorkspaceID, projectID, memberID, req.Name, req.Roles, req.Status, now, nextRevision)
	nextRevision++
	if err := teamUpsertRow(ctx, tx, row); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if err := mysqlTouchWorkspace(ctx, tx, targetWorkspaceID, now); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if err := mysqlSetNextRevision(ctx, tx, nextRevision); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	writeJSON(w, http.StatusOK, memberResponse{Account: account, Member: row})
}
