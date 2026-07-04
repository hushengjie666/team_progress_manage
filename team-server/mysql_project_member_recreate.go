package main

import (
	"encoding/json"
	"strings"
)

func projectMemberCanBeRecreated(row businessRow, exists bool) bool {
	if !exists {
		return true
	}
	var payload map[string]any
	if err := json.Unmarshal(row.Payload, &payload); err != nil {
		return false
	}
	status, ok := payload["status"].(string)
	return ok && strings.EqualFold(strings.TrimSpace(status), "disabled")
}
