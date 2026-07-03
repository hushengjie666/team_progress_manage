package main

func teamProjectID(row syncRow) string {
	if row.Entity == "project" {
		return row.ID
	}
	if row.Entity == "project_member" || row.Entity == "task" {
		return stringField(row.Payload, "projectId")
	}
	return ""
}

func teamTaskID(row syncRow) string {
	if row.Entity == "task" {
		return row.ID
	}
	return stringField(row.Payload, "taskId")
}

func teamAccountRef(row syncRow) string {
	if value := stringField(row.Payload, "accountId"); value != "" {
		return value
	}
	return row.AccountID
}

func teamStatus(row syncRow) string {
	if value := stringField(row.Payload, "status"); value != "" {
		return value
	}
	return stringField(row.Payload, "outcome")
}

func teamKind(row syncRow) string {
	for _, field := range []string{"stage", "mode", "type", "priority", "severity"} {
		if value := stringField(row.Payload, field); value != "" {
			return value
		}
	}
	return ""
}

func teamRowDate(row syncRow) string {
	if row.Entity == "daily_plan" {
		return stringField(row.Payload, "date")
	}
	for _, field := range []string{"startedAt", "createdAt", "updatedAt"} {
		if value := stringField(row.Payload, field); len(value) >= 10 {
			return value[:10]
		}
	}
	if len(row.UpdatedAt) >= 10 {
		return row.UpdatedAt[:10]
	}
	return ""
}
