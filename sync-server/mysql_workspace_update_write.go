package main

import (
	"context"
	"database/sql"
	"net/http"
	"strings"
	"time"
)

type workspaceUpdateInput struct {
	workspaceID string
	name        string
	kind        string
	ownerID     string
}

func updateWorkspaceInTx(ctx context.Context, tx *sql.Tx, auth authContext, input workspaceUpdateInput) (workspaceData, memberWriteFailure) {
	workspace, found, err := mysqlWorkspaceVisibleToAccount(ctx, tx, auth.AccountID, input.workspaceID)
	if err != nil {
		return workspaceData{}, memberWriteFailure{status: http.StatusInternalServerError, message: "save failed"}
	}
	if !found {
		return workspaceData{}, memberWriteFailure{status: http.StatusForbidden, message: "workspace access denied"}
	}
	workspaceType := input.kind
	if workspaceType == "" {
		workspaceType = fallback(workspace.Type, "shared")
	}
	if fallback(workspace.Type, "shared") == "private" && workspaceType != "private" {
		return workspaceData{}, memberWriteFailure{status: http.StatusBadRequest, message: "private workspace type cannot be changed"}
	}
	membership, found, err := mysqlActiveMembershipByAccountAndWorkspace(ctx, tx, auth.AccountID, input.workspaceID)
	if err != nil {
		return workspaceData{}, memberWriteFailure{status: http.StatusInternalServerError, message: "load workspace membership failed"}
	}
	if !found || (membership.Role != "owner" && membership.Role != "admin") {
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
	if failure := validateWorkspaceOwnerUpdate(ctx, tx, auth, input.workspaceID, workspace, membership, workspaceType, currentOwnerAccountID, ownerAccountID); failure.status != 0 {
		return workspaceData{}, failure
	}
	now := time.Now().UTC().Format(time.RFC3339)
	workspace.Name = input.name
	workspace.Type = workspaceType
	workspace.OwnerAccountID = ownerAccountID
	workspace.UpdatedAt = now
	if err := mysqlUpsertWorkspace(ctx, tx, workspace); err != nil {
		return workspaceData{}, memberWriteFailure{status: http.StatusInternalServerError, message: "save failed"}
	}
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
	if fallback(workspace.Type, "shared") == "private" && ownerAccountID != currentOwnerAccountID {
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
