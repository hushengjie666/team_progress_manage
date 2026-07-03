package main

import "encoding/json"

type businessRow struct {
	WorkspaceID string          `json:"workspace_id,omitempty"`
	AccountID   string          `json:"account_id,omitempty"`
	Entity      string          `json:"entity"`
	ID          string          `json:"id"`
	UpdatedAt   string          `json:"updated_at"`
	DeletedAt   string          `json:"deleted_at,omitempty"`
	Payload     json.RawMessage `json:"payload"`
}

type businessStateResponse struct {
	Rows []businessRow `json:"rows"`
}

type businessChangesRequest struct {
	Changes []businessRow `json:"changes"`
}
