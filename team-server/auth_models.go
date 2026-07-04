package main

type loginRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
	DeviceID string `json:"device_id"`
}

type bootstrapRequest struct {
	WorkspaceName string `json:"workspace_name"`
	Name          string `json:"name"`
	Email         string `json:"email"`
	Password      string `json:"password"`
	DeviceID      string `json:"device_id"`
}

type loginResponse struct {
	Token      string                     `json:"token"`
	UserID     string                     `json:"user_id"`
	ExpiresAt  string                     `json:"expires_at"`
	Account    accountRecord              `json:"account"`
	Workspace  workspaceSummary           `json:"workspace"`
	Membership workspaceMembershipSummary `json:"membership"`
	Workspaces []workspaceSummary         `json:"workspaces"`
}

type authStatusResponse struct {
	Bootstrapped  bool   `json:"bootstrapped"`
	WorkspaceID   string `json:"workspace_id,omitempty"`
	WorkspaceName string `json:"workspace_name,omitempty"`
}

type tokenClaims struct {
	UserID      string `json:"user_id,omitempty"`
	AccountID   string `json:"account_id"`
	WorkspaceID string `json:"workspace_id"`
	Exp         int64  `json:"exp"`
}

type authContext struct {
	AccountID   string
	WorkspaceID string
}
