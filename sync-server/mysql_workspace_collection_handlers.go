package main

import (
	"context"
	"net/http"
	"strings"
	"time"
)

func (a *app) handleWorkspacesMySQL(w http.ResponseWriter, r *http.Request, auth authContext) {
	switch r.Method {
	case http.MethodGet:
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		if _, found, err := mysqlWorkspaceVisibleToAccount(ctx, a.db, auth.AccountID, auth.WorkspaceID); err != nil {
			writeError(w, http.StatusInternalServerError, "load workspace failed")
			return
		} else if !found {
			writeError(w, http.StatusForbidden, "workspace access denied")
			return
		}
		workspaces, err := mysqlWorkspaceSummariesForAccount(ctx, a.db, auth.AccountID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "load workspaces failed")
			return
		}
		memberships := []workspaceMembershipSummary{}
		seenMemberships := map[string]bool{}
		appendMembership := func(item workspaceMembershipSummary) {
			key := item.WorkspaceID + ":" + item.AccountID
			if seenMemberships[key] {
				return
			}
			seenMemberships[key] = true
			memberships = append(memberships, item)
		}
		for _, workspace := range workspaces {
			requestMembership, foundMembership, err := mysqlMembershipSummaryByAccountAndWorkspace(ctx, a.db, auth.AccountID, workspace.ID)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "load workspace members failed")
				return
			}
			if !foundMembership || requestMembership.Status != "active" {
				continue
			}
			items, err := mysqlWorkspaceMembershipSummaries(ctx, a.db, workspace.ID)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "load workspace members failed")
				return
			}
			if workspace.Type == "private" {
				for _, item := range items {
					if item.AccountID == workspace.OwnerAccountID {
						appendMembership(item)
					}
				}
				continue
			}
			for _, item := range items {
				appendMembership(item)
			}
		}
		writeJSON(w, http.StatusOK, map[string]any{"workspaces": workspaces, "memberships": memberships})
	case http.MethodPost:
		var req workspaceCreateRequest
		if err := decodeJSON(w, r, &req); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		name := strings.TrimSpace(req.Name)
		if name == "" {
			writeError(w, http.StatusBadRequest, "workspace name is required")
			return
		}
		workspaceType := strings.TrimSpace(req.Type)
		if workspaceType != "shared" {
			writeError(w, http.StatusBadRequest, "workspace type must be shared")
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()
		account, found, err := mysqlAccountByID(ctx, a.db, auth.AccountID)
		if err != nil || !found || account.DisabledAt != "" {
			writeError(w, http.StatusUnauthorized, "account not found")
			return
		}
		tx, err := a.db.BeginTx(ctx, nil)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		defer mysqlRollback(tx)
		now := time.Now().UTC().Format(time.RFC3339)
		workspace := workspaceData{
			ID:             newID("workspace"),
			Name:           name,
			Type:           workspaceType,
			OwnerAccountID: account.ID,
			Rows:           map[string]syncRow{},
			CreatedAt:      now,
			UpdatedAt:      now,
		}
		if err := mysqlUpsertWorkspace(ctx, tx, workspace); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		if err := mysqlEnsureWorkspaceMembership(ctx, tx, workspace.ID, account.ID, "owner", "active", now); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		account.WorkspaceID = workspace.ID
		account.UpdatedAt = now
		if err := mysqlUpsertAccount(ctx, tx, account); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		if err := tx.Commit(); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		a.writeLoginResponse(w, account, workspace)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}
