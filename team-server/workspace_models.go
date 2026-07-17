package main

type workspaceSummary struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	Type           string `json:"type"`
	OwnerAccountID string `json:"owner_account_id,omitempty"`
	CreatedAt      string `json:"created_at"`
	UpdatedAt      string `json:"updated_at"`
}

type workspaceMembershipSummary struct {
	ID          string `json:"id"`
	WorkspaceID string `json:"workspace_id"`
	AccountID   string `json:"account_id"`
	Name        string `json:"name"`
	Email       string `json:"email"`
	Role        string `json:"role"`
	Status      string `json:"status"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}

type workspaceCreateRequest struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	DeviceID string `json:"device_id,omitempty"`
}

type workspaceUpdateRequest struct {
	Name                   string `json:"name"`
	Type                   string `json:"type"`
	OwnerAccountID         string `json:"owner_account_id,omitempty"`
	ConfirmRestrictMembers bool   `json:"confirm_restrict_members,omitempty"`
}

type workspaceMembershipUpdateRequest struct {
	Status string `json:"status"`
	Role   string `json:"role"`
}

type workspaceMembershipResponse struct {
	Membership workspaceMembershipSummary `json:"membership"`
}

type workspaceSwitchRequest struct {
	WorkspaceID string `json:"workspace_id"`
	DeviceID    string `json:"device_id,omitempty"`
}

type workspaceInvitationRequest struct {
	WorkspaceID string `json:"workspace_id"`
	Email       string `json:"email"`
}

type invitationActionRequest struct{}

type workspaceInvitationSummary struct {
	ID               string `json:"id"`
	WorkspaceID      string `json:"workspace_id"`
	WorkspaceName    string `json:"workspace_name"`
	WorkspaceType    string `json:"workspace_type"`
	InviterAccountID string `json:"inviter_account_id"`
	InviterName      string `json:"inviter_name"`
	InviterEmail     string `json:"inviter_email"`
	InviteeAccountID string `json:"invitee_account_id"`
	InviteeEmail     string `json:"invitee_email"`
	Status           string `json:"status"`
	CreatedAt        string `json:"created_at"`
	UpdatedAt        string `json:"updated_at"`
	AcceptedAt       string `json:"accepted_at,omitempty"`
}
