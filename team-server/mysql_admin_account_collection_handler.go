package main

import (
	"context"
	"net/http"
	"strings"
	"time"
)

func (a *app) handleAdminAccounts(w http.ResponseWriter, r *http.Request, auth authContext) {
	if a.db == nil {
		writeError(w, http.StatusNotImplemented, "admin account management requires mysql backend")
		return
	}
	if !isDefaultAdminAuth(auth) {
		writeError(w, http.StatusForbidden, "only super admin can manage platform accounts")
		return
	}
	switch r.Method {
	case http.MethodGet:
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		accounts, err := mysqlPlatformAccounts(ctx, a.db)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "load accounts failed")
			return
		}
		writeJSON(w, http.StatusOK, platformAccountsResponse{Accounts: publicAccountRecords(accounts)})
	case http.MethodPost:
		var req platformAccountRequest
		if err := decodeJSON(w, r, &req); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		email := normalizeEmail(req.Email)
		if email == "" {
			writeError(w, http.StatusBadRequest, "email is required")
			return
		}
		name := strings.TrimSpace(req.Name)
		if name == "" {
			writeError(w, http.StatusBadRequest, "name is required")
			return
		}
		status := normalizePlatformAccountStatus(req.Status)
		if status == "" {
			writeError(w, http.StatusBadRequest, "invalid account status")
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
		account, found, err := mysqlAccountByEmail(ctx, tx, email)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		if found {
			writeError(w, http.StatusConflict, "account already exists; use PATCH")
			return
		}
		if strings.TrimSpace(req.Password) == "" {
			writeError(w, http.StatusBadRequest, "password is required for a new account")
			return
		}
		now := time.Now().UTC().Format(time.RFC3339)
		hash, err := hashPassword(req.Password)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "password hashing failed")
			return
		}
		accountID := newID("account")
		account = accountRecord{
			ID:           accountID,
			WorkspaceID:  privateWorkspaceID(accountID),
			Name:         name,
			Email:        email,
			PasswordHash: hash,
			CreatedAt:    now,
			UpdatedAt:    now,
			Revision:     1,
		}
		if status == "disabled" {
			if account.ID == defaultAdminAccountID {
				writeError(w, http.StatusBadRequest, "default admin account cannot be disabled")
				return
			}
			account.DisabledAt = now
		} else {
			account.DisabledAt = ""
		}
		if err := mysqlUpsertAccount(ctx, tx, account); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		if _, err := mysqlEnsurePrivateWorkspaceForAccount(ctx, tx, account, now); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		if err := tx.Commit(); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		writeJSON(w, http.StatusOK, platformAccountResponse{Account: publicAccountRecord(account)})
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}
