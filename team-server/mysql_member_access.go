package main

import (
	"context"
	"database/sql"
	"net/http"
)

func validateMemberWriteTarget(ctx context.Context, tx *sql.Tx, auth authContext, targetWorkspaceID string, projectID string) memberWriteFailure {
	targetWorkspace, foundWorkspace, err := mysqlWorkspaceByID(ctx, tx, targetWorkspaceID)
	if err != nil {
		return memberWriteFailure{status: http.StatusInternalServerError, message: "save failed"}
	}
	if !foundWorkspace {
		return memberWriteFailure{status: http.StatusNotFound, message: "workspace not found"}
	}
	if targetWorkspace.Type == "private" {
		return memberWriteFailure{status: http.StatusForbidden, message: "private workspace does not support members"}
	}
	canManageWorkspace, err := teamAccountCanManageWorkspace(ctx, tx, auth, targetWorkspaceID)
	if err != nil {
		return memberWriteFailure{status: http.StatusInternalServerError, message: "save failed"}
	}
	if projectID == "" {
		if !canManageWorkspace {
			return memberWriteFailure{status: http.StatusForbidden, message: "workspace access denied"}
		}
		return memberWriteFailure{}
	}
	if canManageWorkspace {
		return memberWriteFailure{}
	}
	canManageProject, err := teamAccountCanManageProjectMembers(ctx, tx, targetWorkspaceID, auth.AccountID, projectID)
	if err != nil {
		return memberWriteFailure{status: http.StatusInternalServerError, message: "save failed"}
	}
	if !canManageProject {
		return memberWriteFailure{status: http.StatusForbidden, message: "workspace access denied"}
	}
	return memberWriteFailure{}
}
