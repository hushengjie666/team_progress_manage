package main

import (
	"context"
	"database/sql"
	"net/http"
	"strings"
	"time"
)

type workspaceUpdateInput struct {
	workspaceID            string
	name                   string
	kind                   string
	ownerID                string
	expectedRevision       int64
	confirmRestrictMembers bool
}

func updateWorkspaceInTx(ctx context.Context, tx *sql.Tx, auth authContext, input workspaceUpdateInput) (workspaceData, memberWriteFailure) {
	workspace, found, err := mysqlWorkspaceVisibleToAccount(ctx, tx, auth.AccountID, input.workspaceID)
	if err != nil {
		return workspaceData{}, memberWriteFailure{status: http.StatusInternalServerError, message: "save failed"}
	}
	if !found {
		return workspaceData{}, memberWriteFailure{status: http.StatusForbidden, message: "workspace access denied"}
	}
	if input.expectedRevision <= 0 {
		return workspaceData{}, memberWriteFailure{status: http.StatusPreconditionRequired, message: "expected revision is required"}
	}
	if workspace.Revision != input.expectedRevision {
		return workspaceData{}, memberWriteFailure{status: http.StatusConflict, message: "revision_conflict"}
	}
	workspaceType := input.kind
	if workspace.Type == "private" && workspaceType != "private" {
		return workspaceData{}, memberWriteFailure{status: http.StatusBadRequest, message: "private workspace type cannot be changed"}
	}
	membership, found, err := mysqlActiveMembershipByAccountAndWorkspace(ctx, tx, auth.AccountID, input.workspaceID)
	if err != nil {
		return workspaceData{}, memberWriteFailure{status: http.StatusInternalServerError, message: "load workspace membership failed"}
	}
	if !found {
		return workspaceData{}, memberWriteFailure{status: http.StatusForbidden, message: "workspace access denied"}
	}
	currentOwnerAccountID := workspace.OwnerAccountID
	if currentOwnerAccountID == "" {
		currentOwnerAccountID = auth.AccountID
	}
	ownerAccountID := strings.TrimSpace(input.ownerID)
	if ownerAccountID == "" {
		ownerAccountID = currentOwnerAccountID
	}
	if workspaceType != workspace.Type && membership.Role != "owner" && membership.Role != "admin" {
		return workspaceData{}, memberWriteFailure{status: http.StatusForbidden, message: "only workspace owner or admin can change workspace type"}
	}
	if workspace.Type == "shared" && workspaceType == "private" && !input.confirmRestrictMembers {
		return workspaceData{}, memberWriteFailure{status: http.StatusPreconditionRequired, message: "confirm_restrict_members is required"}
	}
	if failure := validateWorkspaceOwnerUpdate(ctx, tx, auth, input.workspaceID, workspace, membership, workspaceType, currentOwnerAccountID, ownerAccountID); failure.status != 0 {
		return workspaceData{}, failure
	}
	now := time.Now().UTC().Format(time.RFC3339)
	workspace.Name = input.name
	workspace.Type = workspaceType
	workspace.OwnerAccountID = ownerAccountID
	workspace.UpdatedAt = now
	updated, err := mysqlUpdateWorkspaceAtRevision(ctx, tx, workspace, input.expectedRevision)
	if err != nil {
		return workspaceData{}, memberWriteFailure{status: http.StatusInternalServerError, message: "save failed"}
	}
	if !updated {
		return workspaceData{}, memberWriteFailure{status: http.StatusConflict, message: "revision_conflict"}
	}
	workspace.Revision = input.expectedRevision + 1
	if err := mysqlSetWorkspaceOwner(ctx, tx, workspace.ID, workspace.OwnerAccountID, now); err != nil {
		return workspaceData{}, memberWriteFailure{status: http.StatusInternalServerError, message: "save failed"}
	}
	if workspaceType == "private" {
		if err := mysqlRestrictWorkspaceToOwner(ctx, tx, workspace.ID, workspace.OwnerAccountID, now); err != nil {
			return workspaceData{}, memberWriteFailure{status: http.StatusInternalServerError, message: "save failed"}
		}
	}
	return workspace, memberWriteFailure{}
}

func validateWorkspaceOwnerUpdate(
	ctx context.Context,
	tx *sql.Tx,
	auth authContext,
	workspaceID string,
	workspace workspaceData,
	membership workspaceMembershipRecord,
	workspaceType string,
	currentOwnerAccountID string,
	ownerAccountID string,
) memberWriteFailure {
	if workspace.Type == "private" && ownerAccountID != currentOwnerAccountID {
		return memberWriteFailure{status: http.StatusBadRequest, message: "private workspace owner cannot be changed"}
	}
	if workspaceType == "private" && ownerAccountID != auth.AccountID {
		return memberWriteFailure{status: http.StatusForbidden, message: "only workspace owner can make a workspace private"}
	}
	if ownerAccountID == currentOwnerAccountID {
		return memberWriteFailure{}
	}
	if membership.Role != "owner" {
		return memberWriteFailure{status: http.StatusForbidden, message: "only workspace owner can change workspace owner"}
	}
	if workspaceType == "private" {
		return memberWriteFailure{status: http.StatusBadRequest, message: "private workspace owner cannot be changed"}
	}
	if _, found, err := mysqlActiveMembershipByAccountAndWorkspace(ctx, tx, ownerAccountID, workspaceID); err != nil {
		return memberWriteFailure{status: http.StatusInternalServerError, message: "load workspace membership failed"}
	} else if !found {
		return memberWriteFailure{status: http.StatusBadRequest, message: "workspace owner must be an active workspace member"}
	}
	return memberWriteFailure{}
}
