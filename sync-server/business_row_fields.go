package main

func businessProjectID(row businessRow) string {
	if row.Entity == "project" {
		return row.ID
	}
	if row.Entity == "project_member" || row.Entity == "task" {
		return stringField(row.Payload, "projectId")
	}
	return ""
}

func businessTaskID(row businessRow) string {
	if row.Entity == "task" {
		return row.ID
	}
	return stringField(row.Payload, "taskId")
}

func businessAccountRef(row businessRow) string {
	if value := stringField(row.Payload, "accountId"); value != "" {
		return value
	}
	return row.AccountID
}

func businessStatus(row businessRow) string {
	if value := stringField(row.Payload, "status"); value != "" {
		return value
	}
	return stringField(row.Payload, "outcome")
}

func businessKind(row businessRow) string {
	for _, field := range []string{"stage", "mode", "type", "priority", "severity"} {
		if value := stringField(row.Payload, field); value != "" {
			return value
		}
	}
	return ""
}

func businessRowDate(row businessRow) string {
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
