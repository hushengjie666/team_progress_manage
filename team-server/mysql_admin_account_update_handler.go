package main

import (
	"context"
	"net/http"
	"strings"
	"time"
)

func (a *app) handleAdminAccountByID(w http.ResponseWriter, r *http.Request, auth authContext) {
	if a.db == nil {
		writeError(w, http.StatusNotImplemented, "admin account management requires mysql backend")
		return
	}
	if !isDefaultAdminAuth(auth) {
		writeError(w, http.StatusForbidden, "only super admin can manage platform accounts")
		return
	}
	if r.Method != http.MethodPatch {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	accountID := strings.Trim(strings.TrimPrefix(r.URL.Path, "/admin/accounts/"), "/")
	if accountID == "" {
		writeError(w, http.StatusBadRequest, "account id is required")
		return
	}
	var req platformAccountRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if req.ExpectedRevision <= 0 {
		writeError(w, http.StatusPreconditionRequired, "expected revision is required")
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
	account, found, err := mysqlAccountByID(ctx, tx, accountID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if !found {
		writeError(w, http.StatusNotFound, "account not found")
		return
	}
	if account.Revision != req.ExpectedRevision {
		writeError(w, http.StatusConflict, "revision_conflict")
		return
	}
	now := time.Now().UTC().Format(time.RFC3339)
	if strings.TrimSpace(req.Name) != "" {
		account.Name = strings.TrimSpace(req.Name)
	}
	if strings.TrimSpace(req.Email) != "" {
		email := normalizeEmail(req.Email)
		if email == "" {
			writeError(w, http.StatusBadRequest, "email is required")
			return
		}
		if conflict, ok, err := mysqlAccountByEmail(ctx, tx, email); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		} else if ok && conflict.ID != account.ID {
			writeError(w, http.StatusConflict, "email belongs to another account")
			return
		}
		account.Email = email
	}
	if strings.TrimSpace(req.Password) != "" {
		hash, err := hashPassword(req.Password)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "password hashing failed")
			return
		}
		account.PasswordHash = hash
	}
	if strings.TrimSpace(req.Status) != "" {
		status := normalizePlatformAccountStatus(req.Status)
		if status == "" {
			writeError(w, http.StatusBadRequest, "invalid account status")
			return
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
	}
	account.WorkspaceID = privateWorkspaceID(account.ID)
	account.UpdatedAt = now
	updated, err := mysqlUpdateAccountAtRevision(ctx, tx, account, req.ExpectedRevision)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if !updated {
		writeError(w, http.StatusConflict, "revision_conflict")
		return
	}
	account.Revision = req.ExpectedRevision + 1
	if _, err := mysqlEnsurePrivateWorkspaceForAccount(ctx, tx, account, now); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	writeJSON(w, http.StatusOK, platformAccountResponse{Account: publicAccountRecord(account)})
}
