package main

import (
	"context"
	"strings"
)

const defaultAdminAccountID = "account_admin"
const defaultAdminUsername = "admin"
const previousDefaultAdminUsername = "demo"
const defaultAdminName = "超级管理员"
const defaultAdminPassword = "hu626699"

func isDefaultAdminAuth(auth authContext) bool {
	return auth.AccountID == defaultAdminAccountID
}

type platformAccountRequest struct {
	Name             string `json:"name"`
	Email            string `json:"email"`
	Password         string `json:"password"`
	Status           string `json:"status"`
	ExpectedRevision int64  `json:"expected_revision"`
}

type platformAccountsResponse struct {
	Accounts []accountRecord `json:"accounts"`
}

type platformAccountResponse struct {
	Account accountRecord `json:"account"`
}

func publicAccountRecord(account accountRecord) accountRecord {
	account.PasswordHash = ""
	return account
}

func publicAccountRecords(accounts []accountRecord) []accountRecord {
	result := make([]accountRecord, 0, len(accounts))
	for _, account := range accounts {
		result = append(result, publicAccountRecord(account))
	}
	return result
}

func normalizePlatformAccountStatus(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "active":
		return "active"
	case "disabled":
		return "disabled"
	default:
		return ""
	}
}

func mysqlPlatformAccounts(ctx context.Context, q sqlRunner) ([]accountRecord, error) {
	rows, err := q.QueryContext(
		ctx,
		`SELECT id, workspace_id, name, email, password_hash, disabled_at, created_at, updated_at, row_version
		 FROM accounts
		 ORDER BY CASE WHEN id = ? THEN 0 ELSE 1 END, created_at ASC, name ASC`,
		defaultAdminAccountID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []accountRecord{}
	for rows.Next() {
		account, err := scanAccount(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, account)
	}
	return result, rows.Err()
}
