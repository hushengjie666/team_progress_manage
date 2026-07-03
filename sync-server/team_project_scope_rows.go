package main

import "context"

func teamLoadRowsForProjects(ctx context.Context, q sqlRunner, workspaceID string, projectIDs []string) ([]syncRow, error) {
	projectIDs = teamUniqueStrings(projectIDs)
	if len(projectIDs) == 0 {
		return nil, nil
	}
	projectSpec, _ := teamTableForEntity("project")
	projectMemberSpec, _ := teamTableForEntity("project_member")
	taskSpec, _ := teamTableForEntity("task")
	workSessionSpec, _ := teamTableForEntity("work_session")
	executionSignalSpec, _ := teamTableForEntity("execution_signal")
	focusSessionSpec, _ := teamTableForEntity("focus_session")
	interruptionSpec, _ := teamTableForEntity("interruption")

	projectRows, err := teamLoadRowsByColumn(ctx, q, projectSpec, workspaceID, "id", projectIDs)
	if err != nil {
		return nil, err
	}
	projectMemberRows, err := teamLoadRowsByColumn(ctx, q, projectMemberSpec, workspaceID, "project_id", projectIDs)
	if err != nil {
		return nil, err
	}
	taskRows, err := teamLoadRowsByColumn(ctx, q, taskSpec, workspaceID, "project_id", projectIDs)
	if err != nil {
		return nil, err
	}

	taskIDs := []string{}
	for _, row := range taskRows {
		taskIDs = append(taskIDs, row.ID)
	}
	workSessionRows, err := teamLoadRowsByColumn(ctx, q, workSessionSpec, workspaceID, "task_id", taskIDs)
	if err != nil {
		return nil, err
	}
	executionSignalRows, err := teamLoadRowsByColumn(ctx, q, executionSignalSpec, workspaceID, "task_id", taskIDs)
	if err != nil {
		return nil, err
	}
	focusSessionRowsByTask, err := teamLoadRowsByColumn(ctx, q, focusSessionSpec, workspaceID, "task_id", taskIDs)
	if err != nil {
		return nil, err
	}
	focusSessionIDs := []string{}
	for _, row := range workSessionRows {
		if value := stringField(row.Payload, "focusSessionId"); value != "" {
			focusSessionIDs = append(focusSessionIDs, value)
		}
	}
	focusSessionRowsByID, err := teamLoadRowsByColumn(ctx, q, focusSessionSpec, workspaceID, "id", focusSessionIDs)
	if err != nil {
		return nil, err
	}
	interruptionRows, err := teamLoadRowsByColumn(ctx, q, interruptionSpec, workspaceID, "task_id", taskIDs)
	if err != nil {
		return nil, err
	}
	return teamRowsDedupeAndSort(
		projectRows,
		projectMemberRows,
		taskRows,
		workSessionRows,
		executionSignalRows,
		focusSessionRowsByTask,
		focusSessionRowsByID,
		interruptionRows,
	), nil
}
