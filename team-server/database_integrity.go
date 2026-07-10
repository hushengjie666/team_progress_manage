package main

import (
	"context"
	"database/sql"
	"fmt"
)

type databaseIntegrityCheck struct {
	Name  string
	Query string
}

var databaseIntegrityChecks = []databaseIntegrityCheck{
	{Name: "tasks_without_project", Query: `SELECT COUNT(*) FROM business_tasks t LEFT JOIN business_projects p ON p.workspace_id = t.workspace_id AND p.id = t.project_id WHERE t.project_id IS NULL OR p.id IS NULL`},
	{Name: "project_members_without_project", Query: `SELECT COUNT(*) FROM business_project_members m LEFT JOIN business_projects p ON p.workspace_id = m.workspace_id AND p.id = m.project_id WHERE m.project_id IS NULL OR p.id IS NULL`},
	{Name: "project_members_without_account", Query: `SELECT COUNT(*) FROM business_project_members m LEFT JOIN accounts a ON a.id = m.account_ref WHERE m.account_ref IS NOT NULL AND m.account_ref <> '' AND a.id IS NULL`},
	{Name: "work_sessions_without_task", Query: `SELECT COUNT(*) FROM business_work_sessions s LEFT JOIN business_tasks t ON t.workspace_id = s.workspace_id AND t.id = s.task_id WHERE s.task_id IS NULL OR t.id IS NULL`},
	{Name: "execution_signals_without_task", Query: `SELECT COUNT(*) FROM business_execution_signals s LEFT JOIN business_tasks t ON t.workspace_id = s.workspace_id AND t.id = s.task_id WHERE s.task_id IS NULL OR t.id IS NULL`},
	{Name: "personal_rows_without_owner", Query: `SELECT (SELECT COUNT(*) FROM business_daily_plans WHERE account_id IS NULL OR account_id = '') + (SELECT COUNT(*) FROM business_focus_sessions WHERE account_id IS NULL OR account_id = '') + (SELECT COUNT(*) FROM business_work_sessions WHERE account_id IS NULL OR account_id = '') + (SELECT COUNT(*) FROM business_execution_signals WHERE account_id IS NULL OR account_id = '') + (SELECT COUNT(*) FROM business_interruptions WHERE account_id IS NULL OR account_id = '') + (SELECT COUNT(*) FROM business_reward_state WHERE account_id IS NULL OR account_id = '')`},
}

func auditDatabaseIntegrity(ctx context.Context, db *sql.DB) (int, error) {
	total := 0
	for _, check := range databaseIntegrityChecks {
		var count int
		if err := db.QueryRowContext(ctx, check.Query).Scan(&count); err != nil {
			return total, fmt.Errorf("%s: %w", check.Name, err)
		}
		fmt.Printf("%s: %d\n", check.Name, count)
		total += count
	}
	fmt.Printf("integrity issues: %d\n", total)
	return total, nil
}
