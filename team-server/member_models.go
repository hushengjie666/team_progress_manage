package main

type memberRequest struct {
	WorkspaceID      string   `json:"workspace_id,omitempty"`
	ProjectID        string   `json:"project_id"`
	Name             string   `json:"name"`
	Email            string   `json:"email"`
	Password         string   `json:"password"`
	Roles            []string `json:"roles"`
	Status           string   `json:"status,omitempty"`
	ExpectedRevision int64    `json:"expected_revision,omitempty"`
}

type memberResponse struct {
	Account accountRecord `json:"account"`
	Member  businessRow   `json:"member"`
}

type changePasswordRequest struct {
	OldPassword string `json:"old_password"`
	NewPassword string `json:"new_password"`
}
