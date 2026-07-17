package main

import (
	"context"
	"database/sql"
	"time"
)

func ensureDefaultAdminAccount(ctx context.Context, db *sql.DB) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer mysqlRollback(tx)
	count, err := mysqlAccountCount(ctx, tx)
	if err != nil {
		return err
	}
	if count > 0 {
		if err := ensureDefaultAdminAccountCredentials(ctx, tx); err != nil {
			return err
		}
		return tx.Commit()
	}
	hash, err := hashPassword(defaultAdminPassword)
	if err != nil {
		return err
	}
	now := time.Now().UTC().Format(time.RFC3339)
	accountID := defaultAdminAccountID
	workspace := workspaceData{
		ID:             privateWorkspaceID(accountID),
		Name:           defaultAdminName + "的私人工作区",
		Type:           "private",
		OwnerAccountID: accountID,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	account := accountRecord{
		ID:           accountID,
		WorkspaceID:  workspace.ID,
		Name:         defaultAdminName,
		Email:        defaultAdminUsername,
		PasswordHash: hash,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if err := mysqlUpsertWorkspace(ctx, tx, workspace); err != nil {
		return err
	}
	if err := mysqlUpsertAccount(ctx, tx, account); err != nil {
		return err
	}
	if err := mysqlEnsureWorkspaceMembership(ctx, tx, workspace.ID, account.ID, "owner", "active", now); err != nil {
		return err
	}
	return tx.Commit()
}

func ensureDefaultAdminAccountCredentials(ctx context.Context, tx *sql.Tx) error {
	account, found, err := mysqlAccountByID(ctx, tx, defaultAdminAccountID)
	if err != nil || !found {
		return err
	}
	if normalizeEmail(account.Email) != previousDefaultAdminUsername {
		return nil
	}
	hash, err := hashPassword(defaultAdminPassword)
	if err != nil {
		return err
	}
	now := time.Now().UTC().Format(time.RFC3339)
	_, err = tx.ExecContext(
		ctx,
		`UPDATE accounts SET name = ?, email = ?, password_hash = ?, disabled_at = NULL, updated_at = ? WHERE id = ?`,
		defaultAdminName,
		defaultAdminUsername,
		hash,
		now,
		defaultAdminAccountID,
	)
	return err
}
