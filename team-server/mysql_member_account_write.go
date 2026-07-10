package main

import (
	"context"
	"database/sql"
	"net/http"
	"strings"
)

type memberWriteFailure struct {
	status  int
	message string
}

func writeMemberFailure(w http.ResponseWriter, failure memberWriteFailure) bool {
	if failure.status == 0 {
		return false
	}
	writeError(w, failure.status, failure.message)
	return true
}

func upsertMemberAccountForRequest(
	ctx context.Context,
	tx *sql.Tx,
	req memberRequest,
	email string,
	targetWorkspaceID string,
	projectID string,
	now string,
) (accountRecord, memberWriteFailure) {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return accountRecord{}, memberWriteFailure{status: http.StatusBadRequest, message: "name is required"}
	}
	account, found, err := mysqlAccountByEmailForUpdate(ctx, tx, email)
	if err != nil {
		return accountRecord{}, memberWriteFailure{status: http.StatusInternalServerError, message: "save failed"}
	}
	if !found && strings.TrimSpace(req.Password) == "" {
		return accountRecord{}, memberWriteFailure{status: http.StatusBadRequest, message: "password is required for a new account"}
	}
	if !found {
		hash, err := hashPassword(req.Password)
		if err != nil {
			return accountRecord{}, memberWriteFailure{status: http.StatusInternalServerError, message: "password hashing failed"}
		}
		accountID := newID("account")
		accountWorkspaceID := targetWorkspaceID
		if projectID != "" {
			accountWorkspaceID = privateWorkspaceID(accountID)
		}
		account = accountRecord{ID: accountID, WorkspaceID: accountWorkspaceID, Name: name, Email: email, PasswordHash: hash, CreatedAt: now, UpdatedAt: now, Revision: 1}
	} else {
		account.Name = name
		account.Email = email
		account.DisabledAt = ""
		account.UpdatedAt = now
		if strings.TrimSpace(req.Password) != "" && projectID == "" {
			hash, err := hashPassword(req.Password)
			if err != nil {
				return accountRecord{}, memberWriteFailure{status: http.StatusInternalServerError, message: "password hashing failed"}
			}
			account.PasswordHash = hash
		}
	}
	if found {
		updated, err := mysqlUpdateAccountAtRevision(ctx, tx, account, account.Revision)
		if err != nil {
			return accountRecord{}, memberWriteFailure{status: http.StatusInternalServerError, message: "save failed"}
		}
		if !updated {
			return accountRecord{}, memberWriteFailure{status: http.StatusConflict, message: "revision_conflict"}
		}
		account.Revision++
	} else if err := mysqlUpsertAccount(ctx, tx, account); err != nil {
		return accountRecord{}, memberWriteFailure{status: http.StatusConflict, message: "account already exists"}
	}
	if _, err := mysqlEnsurePrivateWorkspaceForAccount(ctx, tx, account, now); err != nil {
		return accountRecord{}, memberWriteFailure{status: http.StatusInternalServerError, message: "save failed"}
	}
	return account, memberWriteFailure{}
}
