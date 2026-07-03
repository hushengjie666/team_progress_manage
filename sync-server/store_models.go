package main

import "encoding/json"

type store struct {
	Version      int                      `json:"version"`
	NextRevision int64                    `json:"next_revision"`
	Workspaces   map[string]workspaceData `json:"workspaces"`
	Accounts     map[string]accountRecord `json:"accounts"`
}

type workspaceData struct {
	ID             string             `json:"id"`
	Name           string             `json:"name"`
	Type           string             `json:"type"`
	OwnerAccountID string             `json:"owner_account_id,omitempty"`
	Rows           map[string]syncRow `json:"rows"`
	CreatedAt      string             `json:"created_at"`
	UpdatedAt      string             `json:"updated_at"`
}

type accountRecord struct {
	ID           string `json:"id"`
	WorkspaceID  string `json:"workspace_id"`
	Name         string `json:"name"`
	Email        string `json:"email"`
	PasswordHash string `json:"password_hash"`
	DisabledAt   string `json:"disabled_at,omitempty"`
	CreatedAt    string `json:"created_at"`
	UpdatedAt    string `json:"updated_at"`
}

type workspaceMembershipRecord struct {
	ID          string `json:"id"`
	WorkspaceID string `json:"workspace_id"`
	AccountID   string `json:"account_id"`
	Role        string `json:"role"`
	Status      string `json:"status"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}

type syncRow struct {
	UserID      string          `json:"user_id,omitempty"`
	WorkspaceID string          `json:"workspace_id,omitempty"`
	AccountID   string          `json:"account_id,omitempty"`
	Entity      string          `json:"entity"`
	ID          string          `json:"id"`
	DeviceID    string          `json:"device_id"`
	UpdatedAt   string          `json:"updated_at"`
	DeletedAt   string          `json:"deleted_at,omitempty"`
	Version     int             `json:"version"`
	Revision    int64           `json:"revision"`
	Payload     json.RawMessage `json:"payload"`
}
