package main

type teamEntityTable struct {
	entity string
	table  string
}

var teamEntityTables = []teamEntityTable{
	{entity: "project", table: "team_projects"},
	{entity: "project_member", table: "team_project_members"},
	{entity: "task", table: "team_tasks"},
	{entity: "daily_plan", table: "team_daily_plans"},
	{entity: "focus_session", table: "team_focus_sessions"},
	{entity: "work_session", table: "team_work_sessions"},
	{entity: "execution_signal", table: "team_execution_signals"},
	{entity: "interruption", table: "team_interruptions"},
	{entity: "settings", table: "team_settings"},
	{entity: "reward_state", table: "team_reward_state"},
}

var teamSingletonEntities = map[string]bool{
	"settings":     true,
	"reward_state": true,
}

func teamTableForEntity(entity string) (teamEntityTable, bool) {
	for _, spec := range teamEntityTables {
		if spec.entity == entity {
			return spec, true
		}
	}
	return teamEntityTable{}, false
}
