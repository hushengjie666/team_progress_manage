package main

import "encoding/json"

type businessRow struct {
	WorkspaceID string          `json:"workspace_id,omitempty"`
	AccountID   string          `json:"account_id,omitempty"`
	Entity      string          `json:"entity"`
	ID          string          `json:"id"`
	UpdatedAt   string          `json:"updated_at"`
	Payload     json.RawMessage `json:"payload"`
}

type teamDataResponse struct {
	Rows []businessRow `json:"rows"`
}

type teamDataSaveRequest struct {
	Rows []businessRow `json:"rows"`
}
