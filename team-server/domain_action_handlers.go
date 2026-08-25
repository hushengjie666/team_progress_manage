package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

func decodeDomainAction(w http.ResponseWriter, r *http.Request) (domainActionRequest, bool) {
	var req domainActionRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return req, false
	}
	return req, true
}

func domainWorkspaceID(auth authContext, req domainActionRequest) string {
	if value := strings.TrimSpace(req.WorkspaceID); value != "" {
		return value
	}
	return auth.WorkspaceID
}

func rowPayloadObject(row businessRow) (map[string]any, error) {
	value := map[string]any{}
	err := json.Unmarshal(row.Payload, &value)
	return value, err
}

func savePayloadObject(ctx context.Context, tx *sql.Tx, row businessRow, value map[string]any, now string) error {
	value["updatedAt"] = now
	raw, err := json.Marshal(value)
	if err != nil {
		return err
	}
	row.Payload = raw
	row.UpdatedAt = now
	_, err = businessUpdateRow(ctx, tx, row)
	return err
}

func (a *app) handleTaskAction(w http.ResponseWriter, r *http.Request, auth authContext, taskID string, action string) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	req, ok := decodeDomainAction(w, r)
	if !ok {
		return
	}
	workspaceID := domainWorkspaceID(auth, req)
	ctx, recorder := withMutationRecorder(r.Context(), firstNonEmpty(req.MutationID, mutationIDFromRequest(r)))
	r = r.WithContext(ctx)
	tx, err := a.db.BeginTx(r.Context(), nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	defer mysqlRollback(tx)
	if !a.claimIdempotencyOrRespond(w, r, tx, auth) {
		return
	}
	task, found, err := businessExistingRowForUpdate(r.Context(), tx, workspaceID, "task", taskID)
	if err != nil || !found {
		writeError(w, http.StatusNotFound, "task not found")
		return
	}
	if allowed, err := businessRowMutationAllowed(r.Context(), tx, auth, task, task, false); err != nil || !allowed {
		writeError(w, http.StatusForbidden, "task write denied")
		return
	}
	payload, err := rowPayloadObject(task)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid task payload")
		return
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	reviewMemberID := ""
	if action == "submit-review" || action == "accept-review" || action == "return-review" {
		memberID, canSubmit, canReview, accessErr := taskReviewPermissions(r.Context(), tx, auth, task)
		if accessErr != nil {
			writeError(w, http.StatusInternalServerError, "review permission check failed")
			return
		}
		reviewMemberID = memberID
		if (action == "submit-review" && !canSubmit) || (action != "submit-review" && !canReview) {
			writeError(w, http.StatusForbidden, "task review denied")
			return
		}
	}
	switch action {
	case "submit-review", "accept-review", "return-review":
		if failure := applyTaskReviewActionInTx(r.Context(), tx, task, payload, action, req.Reason, reviewMemberID, now); failure != nil {
			writeError(w, failure.status, failure.message)
			return
		}
	case "archive":
		payload["status"] = "archived"
	case "restore":
		payload["status"] = "pool"
	case "split":
		if len(req.ChildTitles) < 2 {
			writeError(w, http.StatusBadRequest, "at least two child titles are required")
			return
		}
		payload["status"] = "split"
		for index, title := range req.ChildTitles {
			childTitle := strings.TrimSpace(title)
			if childTitle == "" {
				continue
			}
			child := map[string]any{}
			for key, value := range payload {
				child[key] = value
			}
			childID := newID("task")
			child["id"] = childID
			child["title"] = childTitle
			child["status"] = "pool"
			child["progressPercent"] = 0
			child["parentTaskId"] = taskID
			child["sortOrder"] = time.Now().UnixMilli() + int64(index)
			child["createdAt"] = now
			child["updatedAt"] = now
			raw, _ := json.Marshal(child)
			row := businessRow{WorkspaceID: workspaceID, AccountID: auth.AccountID, Entity: "task", ID: childID, UpdatedAt: now, Payload: raw}
			if failure := applyBusinessCreate(r.Context(), tx, auth, businessOperation{Operation: "create", Row: &row}); failure.status != 0 {
				writeError(w, failure.status, failure.message)
				return
			}
		}
	case "start":
		payload["status"] = "in_progress"
		if err := a.startTaskInTx(r.Context(), tx, auth, task, payload, req, now); err != nil {
			writeError(w, http.StatusInternalServerError, "start task failed")
			return
		}
	default:
		writeError(w, http.StatusBadRequest, "unsupported task action")
		return
	}
	nextRaw, _ := json.Marshal(payload)
	nextTask := task
	nextTask.Payload = nextRaw
	if action != "submit-review" && action != "accept-review" && action != "return-review" {
		if allowed, err := businessRowMutationAllowed(r.Context(), tx, auth, task, nextTask, false); err != nil || !allowed {
			writeError(w, http.StatusForbidden, "task action denied")
			return
		}
	}
	if err := savePayloadObject(r.Context(), tx, task, payload, now); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	a.commitMutation(w, r, tx, auth, http.StatusOK, recorder)
}

func (a *app) startTaskInTx(ctx context.Context, tx *sql.Tx, auth authContext, task businessRow, taskPayload map[string]any, req domainActionRequest, now string) error {
	if err := endAccountActiveWorkSessionsForStart(ctx, tx, auth, now); err != nil {
		return err
	}
	date := strings.TrimSpace(req.Date)
	if date == "" {
		date = now[:10]
	}
	planID := "plan_" + auth.AccountID + "_" + task.WorkspaceID + "_" + date
	plan, found, err := businessExistingRowForUpdate(ctx, tx, task.WorkspaceID, "daily_plan", planID)
	if err != nil {
		return err
	}
	if !found {
		planPayload := map[string]any{
			"id": planID, "workspaceId": task.WorkspaceID, "ownerAccountId": auth.AccountID, "date": date,
			"capacityPomodoros": 8, "committedTaskIds": []string{task.ID}, "completedPomodoros": 0,
			"suggestedTaskIds": []string{}, "reflection": "", "review": map[string]any{"mood": "normal", "wins": "", "blockers": "", "interruptionPattern": "", "tomorrowFocus": ""},
			"createdAt": now, "updatedAt": now,
		}
		raw, _ := json.Marshal(planPayload)
		plan = businessRow{WorkspaceID: task.WorkspaceID, AccountID: auth.AccountID, Entity: "daily_plan", ID: planID, UpdatedAt: now, Payload: raw}
		if err := businessCreateRow(ctx, tx, plan); err != nil {
			return err
		}
	} else {
		planPayload, err := rowPayloadObject(plan)
		if err != nil {
			return err
		}
		ids := stringSliceField(plan.Payload, "committedTaskIds")
		if !containsString(ids, task.ID) {
			ids = append(ids, task.ID)
		}
		planPayload["committedTaskIds"] = ids
		if err := savePayloadObject(ctx, tx, plan, planPayload, now); err != nil {
			return err
		}
	}
	focusID := firstNonEmpty(req.FocusSessionID, newID("focus_session"))
	duration := req.Duration
	if duration <= 0 || duration > 24*60*60 {
		duration = 1500
	}
	focusPayload := map[string]any{
		"id": focusID, "workspaceId": task.WorkspaceID, "taskId": task.ID, "mode": "focus",
		"duration": duration, "startedAt": now, "interruptionCounts": map[string]any{"internal": 0, "external": 0},
	}
	focusRaw, _ := json.Marshal(focusPayload)
	if err := businessCreateRow(ctx, tx, businessRow{WorkspaceID: task.WorkspaceID, AccountID: auth.AccountID, Entity: "focus_session", ID: focusID, UpdatedAt: now, Payload: focusRaw}); err != nil {
		return err
	}
	sessionID := firstNonEmpty(req.WorkSessionID, newID("work_session"))
	sessionPayload := map[string]any{
		"id": sessionID, "workspaceId": task.WorkspaceID, "taskId": task.ID, "status": "active",
		"focusSessionId": focusID, "startedAt": now, "totalPausedSeconds": 0, "createdAt": now, "updatedAt": now,
	}
	if executor, ok := taskPayload["primaryExecutorMemberId"]; ok {
		sessionPayload["executorMemberId"] = executor
	}
	raw, _ := json.Marshal(sessionPayload)
	if err := businessCreateRow(ctx, tx, businessRow{WorkspaceID: task.WorkspaceID, AccountID: auth.AccountID, Entity: "work_session", ID: sessionID, UpdatedAt: now, Payload: raw}); err != nil {
		return err
	}
	signalID := newID("execution_signal")
	signalPayload := map[string]any{"id": signalID, "workspaceId": task.WorkspaceID, "taskId": task.ID, "workSessionId": sessionID, "type": "work_started", "createdAt": now}
	signalRaw, _ := json.Marshal(signalPayload)
	return businessCreateRow(ctx, tx, businessRow{WorkspaceID: task.WorkspaceID, AccountID: auth.AccountID, Entity: "execution_signal", ID: signalID, UpdatedAt: now, Payload: signalRaw})
}

func containsString(items []string, target string) bool {
	for _, item := range items {
		if item == target {
			return true
		}
	}
	return false
}

func createExecutionSignal(ctx context.Context, tx *sql.Tx, auth authContext, workspaceID string, sessionPayload map[string]any, signalType string, now string) error {
	signalID := newID("execution_signal")
	signalPayload := map[string]any{
		"id": signalID, "workspaceId": workspaceID, "workSessionId": sessionPayload["id"],
		"taskId": sessionPayload["taskId"], "type": signalType, "createdAt": now,
	}
	if executor, ok := sessionPayload["executorMemberId"]; ok {
		signalPayload["executorMemberId"] = executor
	}
	raw, err := json.Marshal(signalPayload)
	if err != nil {
		return err
	}
	return businessCreateRow(ctx, tx, businessRow{
		WorkspaceID: workspaceID, AccountID: auth.AccountID, Entity: "execution_signal",
		ID: signalID, UpdatedAt: now, Payload: raw,
	})
}

func (a *app) handleWorkSessionAction(w http.ResponseWriter, r *http.Request, auth authContext, sessionID string, action string) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	req, ok := decodeDomainAction(w, r)
	if !ok {
		return
	}
	workspaceID := domainWorkspaceID(auth, req)
	ctx, recorder := withMutationRecorder(r.Context(), firstNonEmpty(req.MutationID, mutationIDFromRequest(r)))
	r = r.WithContext(ctx)
	tx, err := a.db.BeginTx(r.Context(), nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	defer mysqlRollback(tx)
	if !a.claimIdempotencyOrRespond(w, r, tx, auth) {
		return
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	if err := lockAccountWorkSessions(r.Context(), tx, auth.AccountID); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	row, found, err := businessExistingRowForUpdate(r.Context(), tx, workspaceID, "work_session", sessionID)
	if err != nil || !found || row.AccountID != auth.AccountID {
		writeError(w, http.StatusNotFound, "work session not found")
		return
	}
	payload, _ := rowPayloadObject(row)
	if err := endOtherAccountActiveWorkSessions(r.Context(), tx, auth, sessionID, now); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	switch action {
	case "pause":
		if stringField(row.Payload, "status") != "active" {
			writeError(w, http.StatusConflict, "work session is not active")
			return
		}
		payload["status"] = "paused"
		payload["pausedAt"] = now
	case "resume":
		if stringField(row.Payload, "status") != "paused" {
			writeError(w, http.StatusConflict, "work session is not paused")
			return
		}
		if pausedAt, ok := payload["pausedAt"].(string); ok {
			if pausedTime, parseErr := time.Parse(time.RFC3339Nano, pausedAt); parseErr == nil {
				current, _ := payload["totalPausedSeconds"].(float64)
				payload["totalPausedSeconds"] = int64(current) + int64(time.Since(pausedTime).Seconds())
			}
		}
		payload["status"] = "active"
		payload["resumedAt"] = now
		delete(payload, "pausedAt")
	case "finish":
		if status := stringField(row.Payload, "status"); status != "active" && status != "paused" {
			writeError(w, http.StatusConflict, "work session is already ended")
			return
		}
		payload["status"] = "ended"
		payload["endedAt"] = now
		if strings.TrimSpace(req.Outcome) != "" {
			payload["outcome"] = strings.TrimSpace(req.Outcome)
		}
	case "reset":
		if status := stringField(row.Payload, "status"); status != "active" && status != "paused" {
			writeError(w, http.StatusConflict, "work session is already ended")
			return
		}
		payload["status"] = "paused"
		payload["startedAt"] = now
		payload["pausedAt"] = now
		payload["totalPausedSeconds"] = 0
		delete(payload, "resumedAt")
	default:
		writeError(w, http.StatusBadRequest, "unsupported work session action")
		return
	}
	signalType := map[string]string{"pause": "work_paused", "resume": "work_resumed", "finish": "work_ended", "reset": "work_reset"}[action]
	if err := createExecutionSignal(r.Context(), tx, auth, workspaceID, payload, signalType, now); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if action == "finish" {
		if focusID, ok := payload["focusSessionId"].(string); ok && strings.TrimSpace(focusID) != "" {
			focus, focusFound, lookupErr := businessExistingRowForUpdate(r.Context(), tx, workspaceID, "focus_session", focusID)
			if lookupErr != nil {
				writeError(w, http.StatusInternalServerError, "save failed")
				return
			}
			if focusFound {
				focusPayload, decodeErr := rowPayloadObject(focus)
				if decodeErr != nil {
					writeError(w, http.StatusBadRequest, "invalid focus session payload")
					return
				}
				focusPayload["endedAt"] = now
				if strings.TrimSpace(req.Outcome) != "" {
					focusPayload["outcome"] = strings.TrimSpace(req.Outcome)
				}
				if err := savePayloadObject(r.Context(), tx, focus, focusPayload, now); err != nil {
					writeError(w, http.StatusInternalServerError, "save failed")
					return
				}
			}
		}
		if req.Outcome == "completed" {
			if err := completeFocusedTaskInTx(r.Context(), tx, auth, workspaceID, payload, now); err != nil {
				writeError(w, http.StatusInternalServerError, "save failed")
				return
			}
		}
	}
	if err := savePayloadObject(r.Context(), tx, row, payload, now); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	a.commitMutation(w, r, tx, auth, http.StatusOK, recorder)
}

func (a *app) handleDailyPlanAction(w http.ResponseWriter, r *http.Request, auth authContext, planID string, action string) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	req, ok := decodeDomainAction(w, r)
	if !ok {
		return
	}
	workspaceID := domainWorkspaceID(auth, req)
	ctx, recorder := withMutationRecorder(r.Context(), firstNonEmpty(req.MutationID, mutationIDFromRequest(r)))
	r = r.WithContext(ctx)
	tx, err := a.db.BeginTx(r.Context(), nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	defer mysqlRollback(tx)
	if !a.claimIdempotencyOrRespond(w, r, tx, auth) {
		return
	}
	row, found, err := businessExistingRowForUpdate(r.Context(), tx, workspaceID, "daily_plan", planID)
	if err != nil {
		writeError(w, http.StatusNotFound, "daily plan not found")
		return
	}
	if !found && action == "add-task" {
		now := time.Now().UTC().Format(time.RFC3339Nano)
		date := strings.TrimSpace(req.Date)
		if date == "" && len(planID) >= 10 {
			date = planID[len(planID)-10:]
		}
		payload := map[string]any{
			"id": planID, "workspaceId": workspaceID, "ownerAccountId": auth.AccountID, "date": date,
			"capacityPomodoros": 8, "committedTaskIds": []string{}, "completedPomodoros": 0,
			"suggestedTaskIds": []string{}, "reflection": "", "review": map[string]any{"mood": "normal", "wins": "", "blockers": "", "interruptionPattern": "", "tomorrowFocus": ""},
			"createdAt": now, "updatedAt": now,
		}
		raw, _ := json.Marshal(payload)
		row = businessRow{WorkspaceID: workspaceID, AccountID: auth.AccountID, Entity: "daily_plan", ID: planID, UpdatedAt: now, Payload: raw}
		if err := businessCreateRow(r.Context(), tx, row); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		found = true
	}
	if !found || row.AccountID != auth.AccountID {
		writeError(w, http.StatusNotFound, "daily plan not found")
		return
	}
	payload, _ := rowPayloadObject(row)
	ids := stringSliceField(row.Payload, "committedTaskIds")
	switch action {
	case "add-task":
		if !containsString(ids, req.TaskID) {
			ids = append(ids, req.TaskID)
		}
	case "remove-task":
		next := []string{}
		for _, id := range ids {
			if id != req.TaskID {
				next = append(next, id)
			}
		}
		ids = next
	case "move-task":
		for index, id := range ids {
			if id != req.TaskID {
				continue
			}
			target := index + req.Direction
			if target >= 0 && target < len(ids) {
				ids[index], ids[target] = ids[target], ids[index]
			}
			break
		}
	default:
		writeError(w, http.StatusBadRequest, "unsupported daily plan action")
		return
	}
	payload["committedTaskIds"] = ids
	now := time.Now().UTC().Format(time.RFC3339Nano)
	if strings.TrimSpace(req.TaskID) != "" {
		task, taskFound, _ := businessExistingRowForUpdate(r.Context(), tx, workspaceID, "task", req.TaskID)
		if !taskFound && action == "add-task" {
			writeError(w, http.StatusNotFound, "task not found")
			return
		}
		if taskFound {
			if allowed, accessErr := businessRowMutationAllowed(r.Context(), tx, auth, task, task, false); accessErr != nil || !allowed {
				writeError(w, http.StatusForbidden, "task write denied")
				return
			}
			taskPayload, _ := rowPayloadObject(task)
			if action == "add-task" && stringField(task.Payload, "status") == "pool" {
				taskPayload["status"] = "committed"
			}
			if action == "remove-task" && stringField(task.Payload, "status") == "committed" {
				taskPayload["status"] = "pool"
			}
			if err := savePayloadObject(r.Context(), tx, task, taskPayload, now); err != nil {
				writeError(w, http.StatusInternalServerError, "save failed")
				return
			}
		}
	}
	if err := savePayloadObject(r.Context(), tx, row, payload, now); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	a.commitMutation(w, r, tx, auth, http.StatusOK, recorder)
}
