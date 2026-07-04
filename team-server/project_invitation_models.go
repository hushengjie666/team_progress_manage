package main

type projectInvitationRequest struct {
	WorkspaceID string   `json:"workspace_id,omitempty"`
	ProjectID   string   `json:"project_id"`
	Email       string   `json:"email"`
	Roles       []string `json:"roles"`
}

type projectInvitationSummary struct {
	ID               string   `json:"id"`
	WorkspaceID      string   `json:"workspace_id"`
	WorkspaceName    string   `json:"workspace_name"`
	ProjectID        string   `json:"project_id"`
	ProjectName      string   `json:"project_name"`
	InviterAccountID string   `json:"inviter_account_id"`
	InviterName      string   `json:"inviter_name"`
	InviterEmail     string   `json:"inviter_email"`
	InviteeAccountID string   `json:"invitee_account_id"`
	InviteeEmail     string   `json:"invitee_email"`
	Roles            []string `json:"roles"`
	Status           string   `json:"status"`
	CreatedAt        string   `json:"created_at"`
	UpdatedAt        string   `json:"updated_at"`
	AcceptedAt       string   `json:"accepted_at,omitempty"`
}
