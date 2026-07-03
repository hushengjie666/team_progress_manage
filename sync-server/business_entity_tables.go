package main

type businessEntityTable struct {
	entity string
	table  string
}

var businessEntityTables = []businessEntityTable{
	{entity: "project", table: "business_projects"},
	{entity: "project_member", table: "business_project_members"},
	{entity: "task", table: "business_tasks"},
	{entity: "daily_plan", table: "business_daily_plans"},
	{entity: "focus_session", table: "business_focus_sessions"},
	{entity: "work_session", table: "business_work_sessions"},
	{entity: "execution_signal", table: "business_execution_signals"},
	{entity: "interruption", table: "business_interruptions"},
	{entity: "reward_state", table: "business_reward_state"},
	{entity: "task_template", table: "business_task_templates"},
	{entity: "template_instance", table: "business_template_instances"},
}

func businessTableForEntity(entity string) (businessEntityTable, bool) {
	for _, spec := range businessEntityTables {
		if spec.entity == entity {
			return spec, true
		}
	}
	return businessEntityTable{}, false
}
