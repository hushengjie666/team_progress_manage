package main

type domainActionRequest struct {
	WorkspaceID       string         `json:"workspace_id"`
	Date              string         `json:"date"`
	TaskID            string         `json:"task_id"`
	Direction         int            `json:"direction"`
	Reason            string         `json:"reason"`
	ChildTitles       []string       `json:"child_titles"`
	Outcome           string         `json:"outcome"`
	Task              map[string]any `json:"task"`
	TargetWorkspaceID string         `json:"target_workspace_id"`
	Patch             map[string]any `json:"patch"`
	MutationID        string         `json:"mutation_id"`
	FocusSessionID    string         `json:"focus_session_id"`
	WorkSessionID     string         `json:"work_session_id"`
	Duration          int            `json:"duration"`
	Items             []projectOrder `json:"items"`
}

type projectOrder struct {
	ID          string `json:"id"`
	WorkspaceID string `json:"workspace_id"`
	SortOrder   int64  `json:"sort_order"`
}
