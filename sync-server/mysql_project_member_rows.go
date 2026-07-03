package main

import (
	"encoding/json"
	"strings"
)

func makeProjectMemberRow(auth authContext, account accountRecord, workspaceID string, projectID string, memberID string, name string, roles []string, status string, now string, revision int64) syncRow {
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
	return syncRow{UserID: auth.AccountID, AccountID: auth.AccountID, WorkspaceID: workspaceID, Entity: "project_member", ID: memberID, DeviceID: "server", UpdatedAt: now, Version: 1, Revision: revision, Payload: payload}
}
