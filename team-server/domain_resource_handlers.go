package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

type domainResourceSpec struct {
	path        string
	entity      string
	patchFields map[string]bool
}

var domainResourceSpecs = []domainResourceSpec{
	{path: "projects", entity: "project", patchFields: fields("name", "description", "taskStageMode", "defaultExpectedStartHours", "archivedAt", "sortOrder")},
	{path: "project-members", entity: "project_member", patchFields: fields("name", "email", "roles", "status", "accountId")},
	{path: "tasks", entity: "task", patchFields: fields("title", "notes", "tags", "projectId", "project", "priority", "severity", "stage", "estimateHours", "estimatePomodoros", "expectedStartAt", "expectedFinishAt", "dueAt", "reminderAt", "lastReminderSentAt", "repeatRule", "repeatIntervalDays", "primaryExecutorMemberId", "collaboratorMemberIds", "status", "progressPercent", "progressNote", "subtasks", "sortOrder", "reviewSubmittedAt", "reviewSubmittedByMemberId", "reviewAcceptedAt", "reviewAcceptedByMemberId", "reviewReturnedAt", "reviewReturnedByMemberId", "reviewReturnReason")},
	{path: "daily-plans", entity: "daily_plan", patchFields: fields("capacityPomodoros", "recommendedCapacityPomodoros", "suggestedCapacityPomodoros", "overloadAcknowledged", "committedTaskIds", "suggestedTaskIds", "completedPomodoros", "reflection", "review")},
	{path: "focus-sessions", entity: "focus_session", patchFields: fields("endedAt", "outcome", "interruptionCounts")},
	{path: "work-sessions", entity: "work_session", patchFields: fields("status", "pausedAt", "resumedAt", "endedAt", "outcome", "totalPausedSeconds")},
	{path: "execution-signals", entity: "execution_signal", patchFields: fields()},
	{path: "interruptions", entity: "interruption", patchFields: fields("action", "note", "resolvedAt")},
	{path: "reward-state", entity: "reward_state", patchFields: fields("streak", "dailyGoal", "badges", "focusGarden", "visualProgress")},
	{path: "task-templates", entity: "task_template", patchFields: fields("name", "description", "project", "tags", "priority", "severity", "stage", "estimatePomodoros", "repeatRule", "subtasks")},
	{path: "template-instances", entity: "template_instance", patchFields: fields()},
}

func fields(names ...string) map[string]bool {
	result := map[string]bool{}
	for _, name := range names {
		result[name] = true
	}
	return result
}

func (a *app) registerBusinessResourceRoutes(mux *http.ServeMux) {
	for _, item := range domainResourceSpecs {
		spec := item
		mux.HandleFunc("/"+spec.path, a.withAuth(func(w http.ResponseWriter, r *http.Request, auth authContext) {
			a.handleBusinessResource(w, r, auth, spec)
		}))
		mux.HandleFunc("/"+spec.path+"/", a.withAuth(func(w http.ResponseWriter, r *http.Request, auth authContext) {
			a.handleBusinessResource(w, r, auth, spec)
		}))
	}
}

func (a *app) handleAppBootstrap(w http.ResponseWriter, r *http.Request, auth authContext) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()
	account, found, err := mysqlAccountByID(ctx, a.db, auth.AccountID)
	if err != nil || !found {
		writeError(w, http.StatusUnauthorized, "account not found")
		return
	}
	workspace, found, err := mysqlWorkspaceVisibleToAccount(ctx, a.db, auth.AccountID, auth.WorkspaceID)
	if err != nil || !found {
		writeError(w, http.StatusForbidden, "workspace access denied")
		return
	}
	membership, found, err := mysqlMembershipSummaryByAccountAndWorkspace(ctx, a.db, auth.AccountID, auth.WorkspaceID)
	if err != nil || !found {
		writeError(w, http.StatusForbidden, "workspace access denied")
		return
	}
	workspaces, err := mysqlWorkspaceSummariesForAccount(ctx, a.db, auth.AccountID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load workspaces failed")
		return
	}
	memberships := []workspaceMembershipSummary{}
	for _, visible := range workspaces {
		items, loadErr := mysqlWorkspaceMembershipSummaries(ctx, a.db, visible.ID)
		if loadErr == nil {
			memberships = append(memberships, items...)
		}
	}
	rows, err := a.businessRowsForAccount(ctx, auth)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load business data failed")
		return
	}
	settings, err := loadAccountSettingsContext(r, a.db, auth.AccountID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load settings failed")
		return
	}
	account.PasswordHash = ""
	writeJSON(w, http.StatusOK, map[string]any{
		"account":               account,
		"workspace":             publicWorkspace(workspace),
		"membership":            membership,
		"workspaces":            workspaces,
		"workspace_memberships": memberships,
		"rows":                  rows,
		"settings":              settings,
		"loaded_at":             time.Now().UTC().Format(time.RFC3339Nano),
	})
}

func (a *app) handleBusinessImport(w http.ResponseWriter, r *http.Request, auth authContext) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		Rows []businessRow `json:"rows"`
	}
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if len(req.Rows) == 0 || len(req.Rows) > 2000 {
		writeError(w, http.StatusBadRequest, "import rows are required")
		return
	}
	tx, err := a.db.BeginTx(r.Context(), nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "import failed")
		return
	}
	defer mysqlRollback(tx)
	for _, row := range req.Rows {
		row.WorkspaceID = businessWorkspaceIDForRow(auth, row)
		row.AccountID = auth.AccountID
		if _, ok := businessTableForEntity(row.Entity); !ok || !json.Valid(row.Payload) {
			writeError(w, http.StatusBadRequest, "invalid import row")
			return
		}
		current, _, err := businessExistingRow(r.Context(), tx, row.WorkspaceID, row.Entity, row.ID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "import failed")
			return
		}
		allowed, err := businessRowMutationAllowed(r.Context(), tx, auth, current, row, false)
		if err != nil || !allowed {
			writeError(w, http.StatusForbidden, "import row denied")
			return
		}
		if err := businessUpsertRow(r.Context(), tx, row); err != nil {
			writeError(w, http.StatusInternalServerError, "import failed")
			return
		}
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "import failed")
		return
	}
	a.writeBootstrapRows(w, r, auth)
}

func (a *app) handleBusinessResource(w http.ResponseWriter, r *http.Request, auth authContext, spec domainResourceSpec) {
	id := strings.TrimPrefix(r.URL.Path, "/"+spec.path)
	id = strings.Trim(strings.TrimSpace(id), "/")
	parts := strings.Split(id, "/")
	if len(parts) >= 2 {
		if spec.entity == "project" {
			a.handleProjectAction(w, r, auth, parts[0], parts[1])
			return
		}
		if spec.entity == "task" {
			a.handleTaskAction(w, r, auth, parts[0], parts[1])
			return
		}
		if spec.entity == "work_session" {
			a.handleWorkSessionAction(w, r, auth, parts[0], parts[1])
			return
		}
		if spec.entity == "daily_plan" {
			a.handleDailyPlanAction(w, r, auth, parts[0], parts[1])
			return
		}
		if spec.entity == "task_template" {
			a.handleTaskTemplateAction(w, r, auth, parts[0], parts[1])
			return
		}
	}
	if r.Method == http.MethodPost && id == "" {
		a.createBusinessResource(w, r, auth, spec)
		return
	}
	if id == "" {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if r.Method == http.MethodPatch {
		a.patchBusinessResource(w, r, auth, spec, id)
		return
	}
	if r.Method == http.MethodDelete {
		a.deleteBusinessResource(w, r, auth, spec, id)
		return
	}
	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
}

func decodeObject(w http.ResponseWriter, r *http.Request) (map[string]any, bool) {
	value := map[string]any{}
	if err := decodeJSON(w, r, &value); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return nil, false
	}
	return value, true
}

func workspaceIDFromRequest(auth authContext, r *http.Request, payload map[string]any) string {
	if value := strings.TrimSpace(r.URL.Query().Get("workspace_id")); value != "" {
		return value
	}
	if value, ok := payload["workspaceId"].(string); ok && strings.TrimSpace(value) != "" {
		return strings.TrimSpace(value)
	}
	return auth.WorkspaceID
}

func (a *app) createBusinessResource(w http.ResponseWriter, r *http.Request, auth authContext, spec domainResourceSpec) {
	payload, ok := decodeObject(w, r)
	if !ok {
		return
	}
	id, _ := payload["id"].(string)
	id = strings.TrimSpace(id)
	if id == "" {
		writeError(w, http.StatusBadRequest, "id is required")
		return
	}
	workspaceID := workspaceIDFromRequest(auth, r, payload)
	now := time.Now().UTC().Format(time.RFC3339Nano)
	payload["id"] = id
	payload["workspaceId"] = workspaceID
	payload["createdAt"] = now
	payload["updatedAt"] = now
	raw, _ := json.Marshal(payload)
	row := businessRow{WorkspaceID: workspaceID, AccountID: auth.AccountID, Entity: spec.entity, ID: id, UpdatedAt: now, Payload: raw}
	tx, err := a.db.BeginTx(r.Context(), nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	defer mysqlRollback(tx)
	failure := applyBusinessOperation(r.Context(), tx, auth, businessOperation{Operation: "create", Row: &row})
	if failure.status != 0 {
		writeError(w, failure.status, failure.message)
		return
	}
	if spec.entity == "project" {
		account, found, err := mysqlAccountByID(r.Context(), tx, auth.AccountID)
		if err != nil || !found {
			writeError(w, http.StatusUnauthorized, "account not found")
			return
		}
		memberID := "member_" + id + "_" + auth.AccountID
		member := makeProjectMemberRow(account, workspaceID, id, memberID, account.Name, []string{"project_owner", "executor"}, "active", now)
		if err := businessCreateRow(r.Context(), tx, member); err != nil {
			writeError(w, http.StatusInternalServerError, "create project owner failed")
			return
		}
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"row": row})
}

func filteredPatch(payload map[string]any, allowed map[string]bool, now string) (json.RawMessage, bool) {
	result := map[string]any{"updatedAt": now}
	for key, value := range payload {
		if allowed[key] {
			result[key] = value
		}
	}
	if len(result) == 1 {
		return nil, false
	}
	raw, _ := json.Marshal(result)
	return raw, true
}

func (a *app) patchBusinessResource(w http.ResponseWriter, r *http.Request, auth authContext, spec domainResourceSpec, id string) {
	payload, ok := decodeObject(w, r)
	if !ok {
		return
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	patch, ok := filteredPatch(payload, spec.patchFields, now)
	if !ok {
		writeError(w, http.StatusBadRequest, "no mutable fields supplied")
		return
	}
	workspaceID := workspaceIDFromRequest(auth, r, payload)
	tx, err := a.db.BeginTx(r.Context(), nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	defer mysqlRollback(tx)
	failure := applyBusinessOperation(r.Context(), tx, auth, businessOperation{Operation: "patch", WorkspaceID: workspaceID, Entity: spec.entity, ID: id, UpdatedAt: now, Patch: patch})
	if failure.status != 0 {
		writeError(w, failure.status, failure.message)
		return
	}
	row, found, err := businessExistingRowForUpdate(r.Context(), tx, workspaceID, spec.entity, id)
	if err != nil || !found {
		writeError(w, http.StatusInternalServerError, "reload failed")
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"row": row})
}

func (a *app) deleteBusinessResource(w http.ResponseWriter, r *http.Request, auth authContext, spec domainResourceSpec, id string) {
	workspaceID := strings.TrimSpace(r.URL.Query().Get("workspace_id"))
	if workspaceID == "" {
		workspaceID = auth.WorkspaceID
	}
	tx, err := a.db.BeginTx(r.Context(), nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	defer mysqlRollback(tx)
	failure := applyBusinessOperation(r.Context(), tx, auth, businessOperation{Operation: "delete", WorkspaceID: workspaceID, Entity: spec.entity, ID: id})
	if failure.status != 0 {
		writeError(w, failure.status, failure.message)
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
