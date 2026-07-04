package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

func acceptProjectInvitationInTx(ctx context.Context, tx *sql.Tx, auth authContext, invitationID string) memberWriteFailure {
	invitation, found, err := mysqlProjectInvitationSummaryByID(ctx, tx, invitationID)
	if err != nil {
		return memberWriteFailure{status: http.StatusInternalServerError, message: "save failed"}
	}
	if !found {
		return memberWriteFailure{status: http.StatusNotFound, message: "project invitation not found"}
	}
	if invitation.InviteeAccountID != auth.AccountID {
		return memberWriteFailure{status: http.StatusForbidden, message: "project invitation access denied"}
	}
	if invitation.Status != "pending" {
		return memberWriteFailure{status: http.StatusConflict, message: "project invitation is not pending"}
	}
	account, foundAccount, err := mysqlAccountByID(ctx, tx, auth.AccountID)
	if err != nil || !foundAccount || account.DisabledAt != "" {
		return memberWriteFailure{status: http.StatusUnauthorized, message: "account not found"}
	}
	if _, err := mysqlEnsurePrivateWorkspaceForAccount(ctx, tx, account, time.Now().UTC().Format(time.RFC3339)); err != nil {
		return memberWriteFailure{status: http.StatusInternalServerError, message: "save failed"}
	}
	projectRow, foundProject, err := mysqlProjectRowByID(ctx, tx, invitation.WorkspaceID, invitation.ProjectID)
	if err != nil {
		return memberWriteFailure{status: http.StatusInternalServerError, message: "save failed"}
	}
	if !foundProject {
		return memberWriteFailure{status: http.StatusNotFound, message: "project not found"}
	}
	workspace, foundWorkspace, err := mysqlWorkspaceByID(ctx, tx, projectRow.WorkspaceID)
	if err != nil {
		return memberWriteFailure{status: http.StatusInternalServerError, message: "save failed"}
	}
	if !foundWorkspace || workspace.Type == "private" {
		return memberWriteFailure{status: http.StatusNotFound, message: "workspace not found"}
	}
	now := time.Now().UTC().Format(time.RFC3339)
	failure := ensureProjectInvitationMember(ctx, tx, auth, invitation, account, now)
	if failure.status != 0 {
		return failure
	}
	if _, err := tx.ExecContext(
		ctx,
		`UPDATE project_invitations SET status = 'accepted', accepted_at = ?, updated_at = ? WHERE id = ?`,
		now,
		now,
		invitation.ID,
	); err != nil {
		return memberWriteFailure{status: http.StatusInternalServerError, message: "save failed"}
	}
	return memberWriteFailure{}
}

func ensureProjectInvitationMember(
	ctx context.Context,
	tx *sql.Tx,
	auth authContext,
	invitation projectInvitationSummary,
	account accountRecord,
	now string,
) memberWriteFailure {
	alreadyMember, err := teamAccountCanAccessProject(ctx, tx, invitation.WorkspaceID, auth.AccountID, invitation.ProjectID)
	if err != nil {
		return memberWriteFailure{status: http.StatusInternalServerError, message: "save failed"}
	}
	if alreadyMember {
		return memberWriteFailure{}
	}
	memberID := "member_" + invitation.ProjectID + "_" + account.ID
	existingProjectMemberRow, exists, err := businessExistingRow(ctx, tx, invitation.WorkspaceID, "project_member", memberID)
	if err != nil {
		return memberWriteFailure{status: http.StatusInternalServerError, message: "save failed"}
	}
	if exists {
		var existingProjectMemberPayload map[string]any
		if err := json.Unmarshal(existingProjectMemberRow.Payload, &existingProjectMemberPayload); err != nil {
			return memberWriteFailure{status: http.StatusInternalServerError, message: "save failed"}
		}
		status, _ := existingProjectMemberPayload["status"].(string)
		if !strings.EqualFold(strings.TrimSpace(status), "disabled") {
			return memberWriteFailure{}
		}
	}
	projectMemberRow := makeProjectMemberRow(account, invitation.WorkspaceID, invitation.ProjectID, memberID, account.Name, invitation.Roles, "active", now)
	if err := businessUpsertRow(ctx, tx, projectMemberRow); err != nil {
		return memberWriteFailure{status: http.StatusInternalServerError, message: "save failed"}
	}
	if err := mysqlTouchWorkspace(ctx, tx, invitation.WorkspaceID, now); err != nil {
		return memberWriteFailure{status: http.StatusInternalServerError, message: "save failed"}
	}
	return memberWriteFailure{}
}
