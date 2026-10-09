package main

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

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
	// Task lifecycle actions lock the task before its daily plan.
	// Use the same order here so queue changes cannot deadlock with timer starts.
	var task businessRow
	taskFound := false
	if strings.TrimSpace(req.TaskID) != "" {
		task, taskFound, err = businessExistingRowForUpdate(r.Context(), tx, workspaceID, "task", req.TaskID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "load task failed")
			return
		}
		if !taskFound && action == "add-task" {
			writeError(w, http.StatusNotFound, "task not found")
			return
		}
		if taskFound {
			if allowed, accessErr := businessRowMutationAllowed(r.Context(), tx, auth, task, task, false); accessErr != nil || !allowed {
				writeError(w, http.StatusForbidden, "task write denied")
				return
			}
		}
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
	if taskFound {
		taskPayload, err := rowPayloadObject(task)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid task payload")
			return
		}
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
	if err := savePayloadObject(r.Context(), tx, row, payload, now); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	a.commitMutation(w, r, tx, auth, http.StatusOK, recorder)
}
