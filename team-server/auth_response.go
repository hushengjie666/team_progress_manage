package main

import (
	"context"
	"net/http"
	"time"
)

func (a *app) writeLoginResponse(w http.ResponseWriter, account accountRecord, workspace workspaceData) {
	if !a.requireMySQL(w) {
		return
	}
	expires := time.Now().UTC().Add(30 * 24 * time.Hour)
	token, err := a.signToken(tokenClaims{
		UserID:      account.ID,
		AccountID:   account.ID,
		WorkspaceID: workspace.ID,
		Exp:         expires.Unix(),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "token signing failed")
		return
	}
	publicAccount := account
	publicAccount.PasswordHash = ""
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	membership, ok, err := mysqlMembershipSummaryByAccountAndWorkspace(ctx, a.db, account.ID, workspace.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load workspace membership failed")
		return
	}
	if !ok {
		writeError(w, http.StatusForbidden, "workspace access denied")
		return
	}
	workspaces, err := mysqlWorkspaceSummariesForAccount(ctx, a.db, account.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load workspaces failed")
		return
	}
	writeJSON(w, http.StatusOK, loginResponse{
		Token:      token,
		UserID:     account.ID,
		ExpiresAt:  expires.Format(time.RFC3339),
		Account:    publicAccount,
		Workspace:  publicWorkspace(workspace),
		Membership: membership,
		Workspaces: workspaces,
	})
}

func publicWorkspace(workspace workspaceData) workspaceSummary {
	return workspaceSummary{
		ID:             workspace.ID,
		Name:           workspace.Name,
		Type:           workspace.Type,
		OwnerAccountID: workspace.OwnerAccountID,
		CreatedAt:      workspace.CreatedAt,
		UpdatedAt:      workspace.UpdatedAt,
	}
}
