package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

func (a *app) handleProjectAction(w http.ResponseWriter, r *http.Request, auth authContext, projectID string, action string) {
	if r.Method != http.MethodPost || action != "move" {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	req, ok := decodeDomainAction(w, r)
	if !ok {
		return
	}
	sourceWorkspaceID := domainWorkspaceID(auth, req)
	targetWorkspaceID := strings.TrimSpace(req.TargetWorkspaceID)
	if targetWorkspaceID == "" || targetWorkspaceID == sourceWorkspaceID {
		writeError(w, http.StatusBadRequest, "different target workspace is required")
		return
	}
	if _, found, err := mysqlWorkspaceVisibleToAccount(r.Context(), a.db, auth.AccountID, targetWorkspaceID); err != nil || !found {
		writeError(w, http.StatusForbidden, "target workspace access denied")
		return
	}
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
	project, found, err := businessExistingRowForUpdate(r.Context(), tx, sourceWorkspaceID, "project", projectID)
	if err != nil || !found {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}
	if allowed, accessErr := businessRowMutationAllowed(r.Context(), tx, auth, project, project, false); accessErr != nil || !allowed {
		writeError(w, http.StatusForbidden, "project write denied")
		return
	}
	taskSpec, _ := businessTableForEntity("task")
	taskRows, err := businessLoadRowsByColumn(r.Context(), tx, taskSpec, sourceWorkspaceID, "project_id", []string{projectID})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load project tasks failed")
		return
	}
	taskIDs := make([]string, 0, len(taskRows))
	for _, task := range taskRows {
		taskIDs = append(taskIDs, task.ID)
	}
	payload, err := rowPayloadObject(project)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid project payload")
		return
	}
	for key, value := range req.Patch {
		if fields("name", "description", "taskStageMode", "defaultExpectedStartHours", "archivedAt", "sortOrder")[key] {
			payload[key] = value
		}
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	payload["workspaceId"] = targetWorkspaceID
	payload["updatedAt"] = now
	raw, _ := json.Marshal(payload)
	if err := moveProjectDailyPlans(r, tx, auth, sourceWorkspaceID, targetWorkspaceID, taskIDs, now); err != nil {
		writeError(w, http.StatusInternalServerError, "move project plans failed")
		return
	}
	if _, err := tx.ExecContext(r.Context(), `UPDATE business_projects SET workspace_id = ?, payload = ?, updated_at = ? WHERE workspace_id = ? AND id = ?`, targetWorkspaceID, raw, now, sourceWorkspaceID, projectID); err != nil {
		writeError(w, http.StatusConflict, "project move conflicts with target workspace")
		return
	}
	for _, table := range []string{"business_focus_sessions", "business_work_sessions", "business_execution_signals", "business_interruptions"} {
		query := `UPDATE ` + table + ` SET workspace_id = ?, payload = JSON_SET(payload, '$.workspaceId', ?), updated_at = ? WHERE workspace_id = ? AND JSON_UNQUOTE(JSON_EXTRACT(payload, '$.taskId')) IN (SELECT id FROM business_tasks WHERE workspace_id = ? AND JSON_UNQUOTE(JSON_EXTRACT(payload, '$.projectId')) = ?)`
		if _, err := tx.ExecContext(r.Context(), query, targetWorkspaceID, targetWorkspaceID, now, sourceWorkspaceID, sourceWorkspaceID, projectID); err != nil {
			writeError(w, http.StatusInternalServerError, "move project history failed")
			return
		}
	}
	for _, table := range []string{"business_project_members", "business_tasks"} {
		query := `UPDATE ` + table + ` SET workspace_id = ?, payload = JSON_SET(payload, '$.workspaceId', ?), updated_at = ? WHERE workspace_id = ? AND JSON_UNQUOTE(JSON_EXTRACT(payload, '$.projectId')) = ?`
		if _, err := tx.ExecContext(r.Context(), query, targetWorkspaceID, targetWorkspaceID, now, sourceWorkspaceID, projectID); err != nil {
			writeError(w, http.StatusConflict, "project move conflicts with target workspace")
			return
		}
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	a.writeBootstrapRows(w, r, auth)
}

func moveProjectDailyPlans(r *http.Request, tx *sql.Tx, auth authContext, sourceWorkspaceID string, targetWorkspaceID string, taskIDs []string, now string) error {
	plans, err := businessLoadDailyPlanRowsForProjects(r.Context(), tx, sourceWorkspaceID, taskIDs, auth.AccountID)
	if err != nil {
		return err
	}
	moved := map[string]bool{}
	for _, taskID := range taskIDs {
		moved[taskID] = true
	}
	for _, source := range plans {
		payload, err := rowPayloadObject(source)
		if err != nil {
			return err
		}
		remaining := []string{}
		targetIDs := []string{}
		for _, taskID := range stringSliceField(source.Payload, "committedTaskIds") {
			if moved[taskID] {
				targetIDs = append(targetIDs, taskID)
			} else {
				remaining = append(remaining, taskID)
			}
		}
		if len(targetIDs) == 0 {
			continue
		}
		payload["committedTaskIds"] = remaining
		if err := savePayloadObject(r.Context(), tx, source, payload, now); err != nil {
			return err
		}
		date := stringField(source.Payload, "date")
		targetPlanID := "plan_" + source.AccountID + "_" + targetWorkspaceID + "_" + date
		target, found, err := businessExistingRowForUpdate(r.Context(), tx, targetWorkspaceID, "daily_plan", targetPlanID)
		if err != nil {
			return err
		}
		if found {
			targetPayload, err := rowPayloadObject(target)
			if err != nil {
				return err
			}
			targetPayload["committedTaskIds"] = teamUniqueStrings(append(stringSliceField(target.Payload, "committedTaskIds"), targetIDs...))
			if err := savePayloadObject(r.Context(), tx, target, targetPayload, now); err != nil {
				return err
			}
			continue
		}
		payload["id"] = targetPlanID
		payload["workspaceId"] = targetWorkspaceID
		payload["committedTaskIds"] = targetIDs
		payload["updatedAt"] = now
		targetRaw, _ := json.Marshal(payload)
		if err := businessCreateRow(r.Context(), tx, businessRow{WorkspaceID: targetWorkspaceID, AccountID: source.AccountID, Entity: "daily_plan", ID: targetPlanID, UpdatedAt: now, Payload: targetRaw}); err != nil {
			return err
		}
	}
	return nil
}
