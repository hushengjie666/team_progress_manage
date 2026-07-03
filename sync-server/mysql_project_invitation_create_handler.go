package main

import (
	"context"
	"net/http"
	"strings"
	"time"
)

func (a *app) handleProjectInvitationCreate(w http.ResponseWriter, r *http.Request, auth authContext) {
	var req projectInvitationRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	projectID := strings.TrimSpace(req.ProjectID)
	workspaceID := strings.TrimSpace(req.WorkspaceID)
	email := normalizeEmail(req.Email)
	if projectID == "" || email == "" {
		writeError(w, http.StatusBadRequest, "project_id and email are required")
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
	projectRow, foundProject, err := mysqlProjectRowByID(ctx, tx, workspaceID, projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if !foundProject {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}
	targetWorkspaceID := projectRow.WorkspaceID
	workspace, foundWorkspace, err := mysqlWorkspaceByID(ctx, tx, targetWorkspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if !foundWorkspace {
		writeError(w, http.StatusNotFound, "workspace not found")
		return
	}
	if workspace.Type == "private" {
		writeError(w, http.StatusForbidden, "private workspace does not support project invitations")
		return
	}
	canManageWorkspace, err := teamAccountCanManageWorkspace(ctx, tx, auth, targetWorkspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if !canManageWorkspace {
		canManageProject, err := teamAccountCanManageProjectMembers(ctx, tx, targetWorkspaceID, auth.AccountID, projectID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		if !canManageProject {
			writeError(w, http.StatusForbidden, "project access denied")
			return
		}
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
	if alreadyMember, err := teamAccountCanAccessProject(ctx, tx, targetWorkspaceID, account.ID, projectID); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	} else if alreadyMember {
		writeError(w, http.StatusConflict, "account already belongs to this project")
		return
	}
	now := time.Now().UTC().Format(time.RFC3339)
	invitationID := newID("project_invitation")
	createdAt := now
	if existing, ok, err := mysqlPendingProjectInvitation(ctx, tx, targetWorkspaceID, projectID, account.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	} else if ok {
		invitationID = existing.ID
		createdAt = existing.CreatedAt
	}
	invitation := projectInvitationSummary{
		ID:               invitationID,
		WorkspaceID:      targetWorkspaceID,
		ProjectID:        projectID,
		InviterAccountID: auth.AccountID,
		InviteeAccountID: account.ID,
		InviteeEmail:     account.Email,
		Roles:            normalizeRoles(req.Roles),
		Status:           "pending",
		CreatedAt:        createdAt,
		UpdatedAt:        now,
	}
	if err := mysqlUpsertProjectInvitation(ctx, tx, invitation); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	saved, _, err := mysqlProjectInvitationSummaryByID(ctx, a.db, invitationID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load project invitation failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"invitation": saved})
}
