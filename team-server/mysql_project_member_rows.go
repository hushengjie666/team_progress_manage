package main

import (
	"encoding/json"
	"strings"
)

func makeProjectMemberRow(account accountRecord, workspaceID string, projectID string, memberID string, name string, roles []string, status string, now string) businessRow {
	payload, _ := json.Marshal(map[string]any{
		"id":          memberID,
		"workspaceId": workspaceID,
		"projectId":   projectID,
		"accountId":   account.ID,
		"name":        strings.TrimSpace(name),
		"email":       account.Email,
		"roles":       normalizeRoles(roles),
		"status":      strings.TrimSpace(status),
		"createdAt":   now,
		"updatedAt":   now,
	})
	return businessRow{WorkspaceID: workspaceID, Entity: "project_member", ID: memberID, UpdatedAt: now, Payload: payload}
}
