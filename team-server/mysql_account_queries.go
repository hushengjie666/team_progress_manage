package main

import (
	"context"
	"database/sql"
	"errors"
)

func mysqlAccountCount(ctx context.Context, q sqlRunner) (int, error) {
	var count int
	err := q.QueryRowContext(ctx, `SELECT COUNT(*) FROM accounts`).Scan(&count)
	return count, err
}

func mysqlAccountByEmail(ctx context.Context, q sqlRunner, email string) (accountRecord, bool, error) {
	account, err := scanAccount(q.QueryRowContext(ctx, `SELECT id, workspace_id, name, email, password_hash, disabled_at, created_at, updated_at, row_version FROM accounts WHERE email = ?`, normalizeEmail(email)))
	if errors.Is(err, sql.ErrNoRows) {
		return accountRecord{}, false, nil
	}
	return account, err == nil, err
}

func mysqlAccountByEmailForUpdate(ctx context.Context, tx *sql.Tx, email string) (accountRecord, bool, error) {
	account, err := scanAccount(tx.QueryRowContext(ctx, `SELECT id, workspace_id, name, email, password_hash, disabled_at, created_at, updated_at, row_version FROM accounts WHERE email = ? FOR UPDATE`, normalizeEmail(email)))
	if errors.Is(err, sql.ErrNoRows) {
		return accountRecord{}, false, nil
	}
	return account, err == nil, err
}

func mysqlAccountByID(ctx context.Context, q sqlRunner, accountID string) (accountRecord, bool, error) {
	account, err := scanAccount(q.QueryRowContext(ctx, `SELECT id, workspace_id, name, email, password_hash, disabled_at, created_at, updated_at, row_version FROM accounts WHERE id = ?`, accountID))
	if errors.Is(err, sql.ErrNoRows) {
		return accountRecord{}, false, nil
	}
	return account, err == nil, err
}

func mysqlAccountByEmailInWorkspace(ctx context.Context, q sqlRunner, workspaceID string, email string) (accountRecord, bool, error) {
	account, err := scanAccount(q.QueryRowContext(ctx, `SELECT id, workspace_id, name, email, password_hash, disabled_at, created_at, updated_at, row_version FROM accounts WHERE workspace_id = ? AND email = ?`, workspaceID, normalizeEmail(email)))
	if errors.Is(err, sql.ErrNoRows) {
		return accountRecord{}, false, nil
	}
	return account, err == nil, err
}
