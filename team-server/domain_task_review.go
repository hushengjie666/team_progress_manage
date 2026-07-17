package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

type taskReviewFailure struct {
	status  int
	message string
}

func applyTaskReviewActionInTx(ctx context.Context, tx *sql.Tx, task businessRow, payload map[string]any, action string, reason string, memberID string, now string) *taskReviewFailure {
	switch action {
	case "submit-review":
		if status := stringField(task.Payload, "status"); status != "committed" && status != "in_progress" {
			return &taskReviewFailure{status: http.StatusConflict, message: "task is not ready for review"}
		}
		payload["status"] = "pending_review"
		payload["progressPercent"] = 100
		payload["reviewSubmittedAt"] = now
		if memberID != "" {
			payload["reviewSubmittedByMemberId"] = memberID
		}
		for _, field := range []string{"reviewAcceptedAt", "reviewAcceptedByMemberId", "reviewReturnedAt", "reviewReturnedByMemberId", "reviewReturnReason"} {
			delete(payload, field)
		}
		if err := endTaskWorkSessionsForReview(ctx, tx, task, now); err != nil {
			return &taskReviewFailure{status: http.StatusInternalServerError, message: "end task sessions failed"}
		}
	case "accept-review":
		if stringField(task.Payload, "status") != "pending_review" {
			return &taskReviewFailure{status: http.StatusConflict, message: "task is not pending review"}
		}
		payload["status"] = "completed"
		payload["progressPercent"] = 100
		payload["reviewAcceptedAt"] = now
		payload["completedAt"] = now
		if memberID != "" {
			payload["reviewAcceptedByMemberId"] = memberID
		}
		if err := createNextRecurringTaskInTx(ctx, tx, task, payload, now); err != nil {
			return &taskReviewFailure{status: http.StatusInternalServerError, message: "create recurring task failed"}
		}
	case "return-review":
		if stringField(task.Payload, "status") != "pending_review" {
			return &taskReviewFailure{status: http.StatusConflict, message: "task is not pending review"}
		}
		payload["status"] = "in_progress"
		if progress := numericInt(payload["progressPercent"]); progress > 99 {
			payload["progressPercent"] = 99
		}
		payload["reviewReturnedAt"] = now
		payload["reviewReturnReason"] = strings.TrimSpace(reason)
		if memberID != "" {
			payload["reviewReturnedByMemberId"] = memberID
		}
	}
	return nil
}

func taskReviewPermissions(ctx context.Context, q sqlRunner, auth authContext, task businessRow) (string, bool, bool, error) {
	projectID := businessProjectID(task)
	canManageWorkspace, err := teamAccountCanManageWorkspace(ctx, q, auth, task.WorkspaceID)
	if err != nil {
		return "", false, false, err
	}
	canManageProject, err := teamAccountCanManageProjectMembers(ctx, q, task.WorkspaceID, auth.AccountID, projectID)
	if err != nil {
		return "", false, false, err
	}

	rows, err := q.QueryContext(
		ctx,
		`SELECT workspace_id, 'project_member' AS entity, id, account_id, updated_at, payload
		 FROM business_project_members
		 WHERE workspace_id = ? AND project_id = ? AND account_ref = ? AND status = 'active'`,
		task.WorkspaceID,
		projectID,
		auth.AccountID,
	)
	if err != nil {
		return "", false, false, err
	}
	defer rows.Close()
	members, err := scanBusinessRows(rows)
	if err != nil {
		return "", false, false, err
	}

	primaryExecutorID := stringField(task.Payload, "primaryExecutorMemberId")
	collaboratorIDs := stringSliceField(task.Payload, "collaboratorMemberIds")
	memberID := ""
	isExecutor := false
	for _, member := range members {
		if memberID == "" {
			memberID = member.ID
		}
		assigned := member.ID == primaryExecutorID || containsString(collaboratorIDs, member.ID)
		if assigned && hasRole(member.Payload, "executor") {
			isExecutor = true
			memberID = member.ID
		}
	}
	canReview := canManageWorkspace || canManageProject
	return memberID, canReview || isExecutor, canReview, nil
}

func endTaskWorkSessionsForReview(ctx context.Context, tx *sql.Tx, task businessRow, now string) error {
	return endTaskWorkSessionsInTx(ctx, tx, task, now, "submitted_for_review")
}

func endTaskWorkSessionsInTx(ctx context.Context, tx *sql.Tx, task businessRow, now string, outcome string) error {
	rows, err := tx.QueryContext(
		ctx,
		`SELECT workspace_id, 'work_session' AS entity, id, account_id, updated_at, payload
		 FROM business_work_sessions
		 WHERE workspace_id = ? AND task_id = ? AND status IN ('active', 'paused')
		 FOR UPDATE`,
		task.WorkspaceID,
		task.ID,
	)
	if err != nil {
		return err
	}
	sessions, err := scanBusinessRows(rows)
	_ = rows.Close()
	if err != nil {
		return err
	}
	for _, session := range sessions {
		payload, err := rowPayloadObject(session)
		if err != nil {
			return err
		}
		payload["status"] = "ended"
		payload["endedAt"] = now
		payload["outcome"] = outcome
		if err := savePayloadObject(ctx, tx, session, payload, now); err != nil {
			return err
		}
		focusID := stringField(session.Payload, "focusSessionId")
		if focusID == "" {
			continue
		}
		focus, found, err := businessExistingRowForUpdate(ctx, tx, task.WorkspaceID, "focus_session", focusID)
		if err != nil {
			return err
		}
		if !found {
			continue
		}
		focusPayload, err := rowPayloadObject(focus)
		if err != nil {
			return err
		}
		focusPayload["endedAt"] = now
		focusPayload["outcome"] = outcome
		if err := savePayloadObject(ctx, tx, focus, focusPayload, now); err != nil {
			return err
		}
	}
	return nil
}

func createNextRecurringTaskInTx(ctx context.Context, tx *sql.Tx, task businessRow, completedPayload map[string]any, now string) error {
	rule := stringField(task.Payload, "repeatRule")
	if rule == "" || rule == "none" {
		return nil
	}
	baseText := now
	if rule != "after_completion" {
		if dueAt := stringField(task.Payload, "dueAt"); dueAt != "" {
			baseText = dueAt
		} else if completedAt := stringField(task.Payload, "completedAt"); completedAt != "" {
			baseText = completedAt
		}
	}
	base, err := time.Parse(time.RFC3339Nano, baseText)
	if err != nil {
		return err
	}
	next := base
	switch rule {
	case "daily":
		next = next.AddDate(0, 0, 1)
	case "weekly":
		next = next.AddDate(0, 0, 7)
	case "interval", "after_completion":
		interval := numericInt(completedPayload["repeatIntervalDays"])
		if interval < 1 {
			interval = 1
		}
		next = next.AddDate(0, 0, interval)
	case "weekdays":
		weekdays := numericSlice(completedPayload["repeatWeekdays"])
		if len(weekdays) == 0 {
			weekdays = []int{1, 2, 3, 4, 5}
		}
		for {
			next = next.AddDate(0, 0, 1)
			if containsInt(weekdays, int(next.Weekday())) {
				break
			}
		}
	case "monthly":
		day := numericInt(completedPayload["repeatDayOfMonth"])
		if day < 1 {
			day = next.Day()
		}
		if day > 28 {
			day = 28
		}
		next = time.Date(next.Year(), next.Month()+1, day, next.Hour(), next.Minute(), next.Second(), next.Nanosecond(), next.Location())
	default:
		return nil
	}

	child := map[string]any{}
	for key, value := range completedPayload {
		child[key] = value
	}
	childID := newID("task")
	child["id"] = childID
	child["status"] = "pool"
	child["progressPercent"] = 0
	child["actualPomodoros"] = 0
	child["estimateHistory"] = []any{}
	child["recurrenceParentId"] = stringField(task.Payload, "recurrenceParentId")
	if child["recurrenceParentId"] == "" {
		child["recurrenceParentId"] = task.ID
	}
	child["nextRepeatAt"] = next.UTC().Format(time.RFC3339Nano)
	if stringField(task.Payload, "dueAt") != "" {
		child["dueAt"] = next.UTC().Format(time.RFC3339Nano)
	} else {
		delete(child, "dueAt")
	}
	if stringField(task.Payload, "reminderAt") != "" {
		child["reminderAt"] = next.UTC().Format(time.RFC3339Nano)
	} else {
		delete(child, "reminderAt")
	}
	for _, field := range []string{"completedAt", "lastReminderSentAt", "reviewSubmittedAt", "reviewSubmittedByMemberId", "reviewAcceptedAt", "reviewAcceptedByMemberId", "reviewReturnedAt", "reviewReturnedByMemberId", "reviewReturnReason"} {
		delete(child, field)
	}
	child["createdAt"] = now
	child["updatedAt"] = now
	child["sortOrder"] = time.Now().UnixMilli()
	raw, err := json.Marshal(child)
	if err != nil {
		return err
	}
	return businessCreateRow(ctx, tx, businessRow{WorkspaceID: task.WorkspaceID, AccountID: task.AccountID, Entity: "task", ID: childID, UpdatedAt: now, Payload: raw})
}

func numericSlice(value any) []int {
	items, ok := value.([]any)
	if !ok {
		return nil
	}
	result := make([]int, 0, len(items))
	for _, item := range items {
		result = append(result, numericInt(item))
	}
	return result
}

func containsInt(items []int, target int) bool {
	for _, item := range items {
		if item == target {
			return true
		}
	}
	return false
}
