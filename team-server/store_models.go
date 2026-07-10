package main

type store struct {
	Version    int                      `json:"version"`
	Workspaces map[string]workspaceData `json:"workspaces"`
	Accounts   map[string]accountRecord `json:"accounts"`
}

type workspaceData struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	Type           string `json:"type"`
	OwnerAccountID string `json:"owner_account_id,omitempty"`
	CreatedAt      string `json:"created_at"`
	UpdatedAt      string `json:"updated_at"`
	Revision       int64  `json:"revision"`
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
	Revision     int64  `json:"revision"`
}

type workspaceMembershipRecord struct {
	ID          string `json:"id"`
	WorkspaceID string `json:"workspace_id"`
	AccountID   string `json:"account_id"`
	Role        string `json:"role"`
	Status      string `json:"status"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
	Revision    int64  `json:"revision"`
}
