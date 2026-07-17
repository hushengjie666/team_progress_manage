package main

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

func (a *app) handleTaskTemplateAction(w http.ResponseWriter, r *http.Request, auth authContext, templateID string, action string) {
	if r.Method != http.MethodPost || action != "instantiate" {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	req, ok := decodeDomainAction(w, r)
	if !ok {
		return
	}
	workspaceID := domainWorkspaceID(auth, req)
	tx, err := a.db.BeginTx(r.Context(), nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	defer mysqlRollback(tx)
	claimed, err := claimIdempotencyKey(r.Context(), tx, auth.AccountID, r.Header.Get("Idempotency-Key"), r.URL.Path)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if !claimed {
		_ = tx.Rollback()
		a.writeBootstrapRows(w, r, auth)
		return
	}
	template, found, err := businessExistingRowForUpdate(r.Context(), tx, workspaceID, "task_template", templateID)
	if err != nil || !found || template.AccountID != auth.AccountID {
		writeError(w, http.StatusNotFound, "task template not found")
		return
	}
	taskID, _ := req.Task["id"].(string)
	taskID = strings.TrimSpace(taskID)
	if taskID == "" {
		writeError(w, http.StatusBadRequest, "task id is required")
		return
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	req.Task["id"] = taskID
	req.Task["workspaceId"] = workspaceID
	req.Task["createdAt"] = now
	req.Task["updatedAt"] = now
	taskRaw, err := json.Marshal(req.Task)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid task payload")
		return
	}
	taskRow := businessRow{WorkspaceID: workspaceID, AccountID: auth.AccountID, Entity: "task", ID: taskID, UpdatedAt: now, Payload: taskRaw}
	if failure := applyBusinessCreate(r.Context(), tx, auth, businessOperation{Operation: "create", Row: &taskRow}); failure.status != 0 {
		writeError(w, failure.status, failure.message)
		return
	}
	instanceID := templateID + "_" + taskID
	instancePayload := map[string]any{"templateId": templateID, "taskId": taskID, "createdAt": now, "workspaceId": workspaceID}
	instanceRaw, _ := json.Marshal(instancePayload)
	instanceRow := businessRow{WorkspaceID: workspaceID, AccountID: auth.AccountID, Entity: "template_instance", ID: instanceID, UpdatedAt: now, Payload: instanceRaw}
	if failure := applyBusinessCreate(r.Context(), tx, auth, businessOperation{Operation: "create", Row: &instanceRow}); failure.status != 0 {
		writeError(w, failure.status, failure.message)
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	a.writeBootstrapRows(w, r, auth)
}
