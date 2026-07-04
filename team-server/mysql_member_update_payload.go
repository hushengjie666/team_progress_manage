package main

import (
	"context"
	"database/sql"
	"net/http"
	"strings"
)

func applyMemberUpdateRequest(payload map[string]any, req memberRequest, targetWorkspaceID string, now string) {
	if strings.TrimSpace(req.Name) != "" {
		payload["name"] = strings.TrimSpace(req.Name)
	}
	if strings.TrimSpace(req.Email) != "" {
		payload["email"] = normalizeEmail(req.Email)
	}
	if len(req.Roles) > 0 {
		payload["roles"] = normalizeRoles(req.Roles)
	}
	if strings.TrimSpace(req.Status) != "" {
		payload["status"] = strings.TrimSpace(req.Status)
	}
	payload["workspaceId"] = targetWorkspaceID
	payload["updatedAt"] = now
}

func syncMemberAccountPasswordForUpdate(
	ctx context.Context,
	tx *sql.Tx,
	payload map[string]any,
	req memberRequest,
	now string,
) memberWriteFailure {
	if strings.TrimSpace(req.Password) == "" {
		return memberWriteFailure{}
	}
	accountID, _ := payload["accountId"].(string)
	if accountID == "" {
		return memberWriteFailure{status: http.StatusBadRequest, message: "member account is required to update password"}
	}
	account, ok, err := mysqlAccountByID(ctx, tx, accountID)
	if err != nil {
		return memberWriteFailure{status: http.StatusInternalServerError, message: "save failed"}
	}
	if !ok {
		return memberWriteFailure{status: http.StatusNotFound, message: "member account not found"}
	}
	hash, err := hashPassword(req.Password)
	if err != nil {
		return memberWriteFailure{status: http.StatusInternalServerError, message: "password hashing failed"}
	}
	account.PasswordHash = hash
	if name, ok := payload["name"].(string); ok && strings.TrimSpace(name) != "" {
		account.Name = strings.TrimSpace(name)
	}
	if email, ok := payload["email"].(string); ok && strings.TrimSpace(email) != "" {
		account.Email = normalizeEmail(email)
	}
	account.UpdatedAt = now
	if err := mysqlUpsertAccount(ctx, tx, account); err != nil {
		return memberWriteFailure{status: http.StatusInternalServerError, message: "save failed"}
	}
	if _, err := mysqlEnsurePrivateWorkspaceForAccount(ctx, tx, account, now); err != nil {
		return memberWriteFailure{status: http.StatusInternalServerError, message: "save failed"}
	}
	return memberWriteFailure{}
}
