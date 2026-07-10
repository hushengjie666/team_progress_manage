package main

import "encoding/json"

type businessRow struct {
	WorkspaceID string          `json:"workspace_id,omitempty"`
	AccountID   string          `json:"account_id,omitempty"`
	Entity      string          `json:"entity"`
	ID          string          `json:"id"`
	UpdatedAt   string          `json:"updated_at"`
	Revision    int64           `json:"revision"`
	Payload     json.RawMessage `json:"payload"`
}

type teamDataResponse struct {
	Rows []businessRow `json:"rows"`
}

type teamDataSaveRequest struct {
	ProtocolVersion int                 `json:"protocol_version"`
	Rows            []businessRow       `json:"rows,omitempty"`
	Operations      []businessOperation `json:"operations"`
}

type businessOperation struct {
	Operation        string          `json:"operation"`
	WorkspaceID      string          `json:"workspace_id,omitempty"`
	Entity           string          `json:"entity,omitempty"`
	ID               string          `json:"id,omitempty"`
	ExpectedRevision int64           `json:"expected_revision,omitempty"`
	UpdatedAt        string          `json:"updated_at,omitempty"`
	Row              *businessRow    `json:"row,omitempty"`
	Patch            json.RawMessage `json:"patch,omitempty"`
}
