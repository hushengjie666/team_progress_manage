package main

import (
	"encoding/json"
	"strings"
)

func key(entity, id string) string {
	return entity + "/" + id
}

func sanitizeID(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	var builder strings.Builder
	for _, r := range value {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			builder.WriteRune(r)
		} else if r == '-' || r == '_' {
			builder.WriteRune('_')
		}
	}
	return builder.String()
}

func stringField(payload json.RawMessage, field string) string {
	var value map[string]any
	if err := json.Unmarshal(payload, &value); err != nil {
		return ""
	}
	raw, _ := value[field].(string)
	return raw
}

func hasRole(payload json.RawMessage, role string) bool {
	var value map[string]any
	if err := json.Unmarshal(payload, &value); err != nil {
		return false
	}
	roles, ok := value["roles"].([]any)
	if !ok {
		return false
	}
	for _, item := range roles {
		if item == role {
			return true
		}
	}
	return false
}

func normalizeRoles(roles []string) []string {
	seen := map[string]bool{}
	result := make([]string, 0, len(roles))
	for _, role := range roles {
		role = strings.TrimSpace(role)
		if (role == "project_owner" || role == "executor") && !seen[role] {
			seen[role] = true
			result = append(result, role)
		}
	}
	if len(result) == 0 {
		result = []string{"executor"}
	}
	return result
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func fallback(value string, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return strings.TrimSpace(value)
}
