package main

import (
	"sort"
	"strings"
)

func teamUniqueStrings(values []string) []string {
	seen := map[string]bool{}
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" || seen[value] {
			continue
		}
		seen[value] = true
		result = append(result, value)
	}
	return result
}

func teamPlaceholders(count int) string {
	if count <= 0 {
		return ""
	}
	parts := make([]string, count)
	for index := range parts {
		parts[index] = "?"
	}
	return strings.Join(parts, ",")
}

func teamRowsDedupeAndSort(groups ...[]syncRow) []syncRow {
	byKey := map[string]syncRow{}
	for _, rows := range groups {
		for _, row := range rows {
			key := row.WorkspaceID + "/" + row.Entity + "/" + row.ID
			if existing, ok := byKey[key]; !ok || row.Revision >= existing.Revision {
				byKey[key] = row
			}
		}
	}
	result := make([]syncRow, 0, len(byKey))
	for _, row := range byKey {
		result = append(result, row)
	}
	sort.SliceStable(result, func(i, j int) bool {
		if result[i].Revision != result[j].Revision {
			return result[i].Revision < result[j].Revision
		}
		if result[i].Entity != result[j].Entity {
			return result[i].Entity < result[j].Entity
		}
		return result[i].ID < result[j].ID
	})
	return result
}
