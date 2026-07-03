package main

import (
	"context"
	"net/http"
	"strings"
	"time"
)

func (a *app) handleWorkspaceInvitationCreate(w http.ResponseWriter, r *http.Request, auth authContext) {
	var req workspaceInvitationRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	workspaceID := strings.TrimSpace(req.WorkspaceID)
	email := normalizeEmail(req.Email)
	if workspaceID == "" || email == "" {
		writeError(w, http.StatusBadRequest, "workspace_id and email are required")
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
	workspace, foundWorkspace, err := mysqlWorkspaceByID(ctx, tx, workspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if !foundWorkspace {
		writeError(w, http.StatusNotFound, "workspace not found")
		return
	}
	if fallback(workspace.Type, "shared") == "private" {
		writeError(w, http.StatusForbidden, "private workspace does not support invitations")
		return
	}
	canManage, err := teamAccountCanManageWorkspace(ctx, tx, auth, workspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if !canManage {
		writeError(w, http.StatusForbidden, "workspace access denied")
		return
	}
	account, foundAccount, err := mysqlAccountByEmail(ctx, tx, email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if !foundAccount {
		writeError(w, http.StatusNotFound, "account not found; create the platform account first")
		return
	}
	if account.DisabledAt != "" {
		writeError(w, http.StatusBadRequest, "account is disabled")
		return
	}
	if account.ID == auth.AccountID {
		writeError(w, http.StatusBadRequest, "cannot invite yourself")
		return
	}
	if _, alreadyMember, err := mysqlActiveMembershipByAccountAndWorkspace(ctx, tx, account.ID, workspaceID); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	} else if alreadyMember {
		writeError(w, http.StatusConflict, "account already belongs to this workspace")
		return
	}
	now := time.Now().UTC().Format(time.RFC3339)
	invitationID := newID("workspace_invitation")
	createdAt := now
	if existing, ok, err := mysqlPendingWorkspaceInvitation(ctx, tx, workspaceID, account.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	} else if ok {
		invitationID = existing.ID
		createdAt = existing.CreatedAt
	}
	invitation := workspaceInvitationSummary{
		ID:               invitationID,
		WorkspaceID:      workspaceID,
		InviterAccountID: auth.AccountID,
		InviteeAccountID: account.ID,
		InviteeEmail:     account.Email,
		Status:           "pending",
		CreatedAt:        createdAt,
		UpdatedAt:        now,
	}
	if err := mysqlUpsertWorkspaceInvitation(ctx, tx, invitation); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	saved, _, err := mysqlWorkspaceInvitationSummaryByID(ctx, a.db, invitationID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load workspace invitation failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"invitation": saved})
}
