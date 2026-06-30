package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type sqlRunner interface {
	ExecContext(context.Context, string, ...any) (sql.Result, error)
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
	QueryRowContext(context.Context, string, ...any) *sql.Row
}

type syncRowKey struct {
	entity string
	id     string
}

func rowMapKey(key syncRowKey) string {
	return key.entity + "/" + key.id
}

func scanAccount(row interface{ Scan(...any) error }) (accountRecord, error) {
	var account accountRecord
	var disabledAt sql.NullString
	err := row.Scan(&account.ID, &account.WorkspaceID, &account.Name, &account.Email, &account.PasswordHash, &disabledAt, &account.CreatedAt, &account.UpdatedAt)
	if disabledAt.Valid {
		account.DisabledAt = disabledAt.String
	}
	return account, err
}

func scanWorkspace(row interface{ Scan(...any) error }) (workspaceData, error) {
	var workspace workspaceData
	err := row.Scan(&workspace.ID, &workspace.Name, &workspace.CreatedAt, &workspace.UpdatedAt)
	workspace.Rows = map[string]syncRow{}
	return workspace, err
}

func scanSyncRows(rows *sql.Rows) ([]syncRow, error) {
	result := []syncRow{}
	for rows.Next() {
		var row syncRow
		var userID sql.NullString
		var accountID sql.NullString
		var deletedAt sql.NullString
		if err := rows.Scan(&row.WorkspaceID, &row.Entity, &row.ID, &userID, &accountID, &row.DeviceID, &row.UpdatedAt, &deletedAt, &row.Version, &row.Revision, &row.Payload); err != nil {
			return result, err
		}
		if userID.Valid {
			row.UserID = userID.String
		}
		if accountID.Valid {
			row.AccountID = accountID.String
		}
		if deletedAt.Valid {
			row.DeletedAt = deletedAt.String
		}
		result = append(result, row)
	}
	return result, rows.Err()
}

func mysqlCurrentRevision(ctx context.Context, q sqlRunner) (int64, error) {
	var nextRevision int64
	if err := q.QueryRowContext(ctx, `SELECT value_bigint FROM sync_meta WHERE key_name = 'next_revision'`).Scan(&nextRevision); err != nil {
		return 0, err
	}
	if nextRevision < 1 {
		return 0, nil
	}
	return nextRevision - 1, nil
}

func mysqlNextRevisionForUpdate(ctx context.Context, tx *sql.Tx) (int64, error) {
	var nextRevision int64
	if err := tx.QueryRowContext(ctx, `SELECT value_bigint FROM sync_meta WHERE key_name = 'next_revision' FOR UPDATE`).Scan(&nextRevision); err != nil {
		return 0, err
	}
	if nextRevision < 1 {
		nextRevision = 1
	}
	return nextRevision, nil
}

func mysqlSetNextRevision(ctx context.Context, tx *sql.Tx, nextRevision int64) error {
	_, err := tx.ExecContext(
		ctx,
		`INSERT INTO sync_meta (key_name, value_bigint) VALUES ('next_revision', ?) ON DUPLICATE KEY UPDATE value_bigint = VALUES(value_bigint)`,
		nextRevision,
	)
	return err
}

func mysqlFirstWorkspace(ctx context.Context, q sqlRunner) (workspaceData, bool, error) {
	workspace, err := scanWorkspace(q.QueryRowContext(ctx, `SELECT id, name, created_at, updated_at FROM workspaces ORDER BY created_at ASC LIMIT 1`))
	if errors.Is(err, sql.ErrNoRows) {
		return workspaceData{}, false, nil
	}
	return workspace, err == nil, err
}

func mysqlWorkspaceByID(ctx context.Context, q sqlRunner, workspaceID string) (workspaceData, bool, error) {
	workspace, err := scanWorkspace(q.QueryRowContext(ctx, `SELECT id, name, created_at, updated_at FROM workspaces WHERE id = ?`, workspaceID))
	if errors.Is(err, sql.ErrNoRows) {
		return workspaceData{}, false, nil
	}
	return workspace, err == nil, err
}

func mysqlAccountCount(ctx context.Context, q sqlRunner) (int, error) {
	var count int
	err := q.QueryRowContext(ctx, `SELECT COUNT(*) FROM accounts`).Scan(&count)
	return count, err
}

func mysqlAccountByEmail(ctx context.Context, q sqlRunner, email string) (accountRecord, bool, error) {
	account, err := scanAccount(q.QueryRowContext(ctx, `SELECT id, workspace_id, name, email, password_hash, disabled_at, created_at, updated_at FROM accounts WHERE email = ?`, normalizeEmail(email)))
	if errors.Is(err, sql.ErrNoRows) {
		return accountRecord{}, false, nil
	}
	return account, err == nil, err
}

func mysqlAccountByID(ctx context.Context, q sqlRunner, accountID string) (accountRecord, bool, error) {
	account, err := scanAccount(q.QueryRowContext(ctx, `SELECT id, workspace_id, name, email, password_hash, disabled_at, created_at, updated_at FROM accounts WHERE id = ?`, accountID))
	if errors.Is(err, sql.ErrNoRows) {
		return accountRecord{}, false, nil
	}
	return account, err == nil, err
}

func mysqlAccountByEmailInWorkspace(ctx context.Context, q sqlRunner, workspaceID string, email string) (accountRecord, bool, error) {
	account, err := scanAccount(q.QueryRowContext(ctx, `SELECT id, workspace_id, name, email, password_hash, disabled_at, created_at, updated_at FROM accounts WHERE workspace_id = ? AND email = ?`, workspaceID, normalizeEmail(email)))
	if errors.Is(err, sql.ErrNoRows) {
		return accountRecord{}, false, nil
	}
	return account, err == nil, err
}

func mysqlUpsertWorkspace(ctx context.Context, tx *sql.Tx, workspace workspaceData) error {
	_, err := tx.ExecContext(
		ctx,
		`INSERT INTO workspaces (id, name, created_at, updated_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), updated_at = VALUES(updated_at)`,
		workspace.ID,
		workspace.Name,
		workspace.CreatedAt,
		workspace.UpdatedAt,
	)
	return err
}

func mysqlTouchWorkspace(ctx context.Context, tx *sql.Tx, workspaceID string, updatedAt string) error {
	_, err := tx.ExecContext(ctx, `UPDATE workspaces SET updated_at = ? WHERE id = ?`, updatedAt, workspaceID)
	return err
}

func mysqlUpsertAccount(ctx context.Context, tx *sql.Tx, account accountRecord) error {
	_, err := tx.ExecContext(
		ctx,
		`INSERT INTO accounts (id, workspace_id, name, email, password_hash, disabled_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email), password_hash = VALUES(password_hash), disabled_at = VALUES(disabled_at), updated_at = VALUES(updated_at)`,
		account.ID,
		account.WorkspaceID,
		account.Name,
		account.Email,
		account.PasswordHash,
		nullString(account.DisabledAt),
		account.CreatedAt,
		account.UpdatedAt,
	)
	return err
}

func mysqlUpsertSyncRow(ctx context.Context, tx *sql.Tx, row syncRow) error {
	payload := row.Payload
	if len(payload) == 0 {
		payload = []byte(`{}`)
	}
	_, err := tx.ExecContext(
		ctx,
		`INSERT INTO sync_rows (workspace_id, entity, entity_id, user_id, account_id, device_id, updated_at, deleted_at, version, revision, payload)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), account_id = VALUES(account_id), device_id = VALUES(device_id), updated_at = VALUES(updated_at), deleted_at = VALUES(deleted_at), version = VALUES(version), revision = VALUES(revision), payload = VALUES(payload)`,
		row.WorkspaceID,
		row.Entity,
		row.ID,
		nullString(row.UserID),
		nullString(row.AccountID),
		row.DeviceID,
		row.UpdatedAt,
		nullString(row.DeletedAt),
		row.Version,
		row.Revision,
		payload,
	)
	return err
}

func mysqlLoadRowsByKeys(ctx context.Context, q sqlRunner, workspaceID string, keys []syncRowKey) (map[string]syncRow, error) {
	result := map[string]syncRow{}
	seen := map[string]bool{}
	unique := make([]syncRowKey, 0, len(keys))
	for _, key := range keys {
		if key.entity == "" || key.id == "" {
			continue
		}
		mapKey := rowMapKey(key)
		if seen[mapKey] {
			continue
		}
		seen[mapKey] = true
		unique = append(unique, key)
	}
	if len(unique) == 0 {
		return result, nil
	}

	parts := make([]string, 0, len(unique))
	args := []any{workspaceID}
	for _, key := range unique {
		parts = append(parts, `(entity = ? AND entity_id = ?)`)
		args = append(args, key.entity, key.id)
	}
	query := `SELECT workspace_id, entity, entity_id, user_id, account_id, device_id, updated_at, deleted_at, version, revision, payload FROM sync_rows WHERE workspace_id = ? AND (` + strings.Join(parts, " OR ") + `)`
	rows, err := q.QueryContext(ctx, query, args...)
	if err != nil {
		return result, err
	}
	defer rows.Close()
	items, err := scanSyncRows(rows)
	if err != nil {
		return result, err
	}
	for _, row := range items {
		result[key(row.Entity, row.ID)] = row
	}
	return result, nil
}

func mysqlPullRows(ctx context.Context, q sqlRunner, workspaceID string, since int64) ([]syncRow, error) {
	rows, err := q.QueryContext(ctx, `SELECT workspace_id, entity, entity_id, user_id, account_id, device_id, updated_at, deleted_at, version, revision, payload FROM sync_rows WHERE workspace_id = ? AND revision > ? ORDER BY revision ASC`, workspaceID, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanSyncRows(rows)
}

func mysqlRowCount(ctx context.Context, q sqlRunner, workspaceID string) (int, error) {
	var count int
	err := q.QueryRowContext(ctx, `SELECT COUNT(*) FROM sync_rows WHERE workspace_id = ?`, workspaceID).Scan(&count)
	return count, err
}

func mysqlMemberRow(ctx context.Context, q sqlRunner, workspaceID string, memberID string) (syncRow, bool, error) {
	rows, err := mysqlLoadRowsByKeys(ctx, q, workspaceID, []syncRowKey{
		{entity: "project_member", id: memberID},
		{entity: "team_member", id: memberID},
	})
	if err != nil {
		return syncRow{}, false, err
	}
	if row, ok := rows[key("project_member", memberID)]; ok {
		return row, true, nil
	}
	if row, ok := rows[key("team_member", memberID)]; ok {
		return row, true, nil
	}
	return syncRow{}, false, nil
}

func mysqlRollback(tx *sql.Tx) {
	_ = tx.Rollback()
}

func (a *app) handleAuthStatusMySQL(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	count, err := mysqlAccountCount(ctx, a.db)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load auth status failed")
		return
	}
	workspace, _, err := mysqlFirstWorkspace(ctx, a.db)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load workspace failed")
		return
	}
	writeJSON(w, http.StatusOK, authStatusResponse{
		Bootstrapped:  count > 0,
		WorkspaceID:   workspace.ID,
		WorkspaceName: workspace.Name,
	})
}

func (a *app) handleBootstrapMySQL(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req bootstrapRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if strings.TrimSpace(req.DeviceID) == "" {
		writeError(w, http.StatusBadRequest, "device_id is required")
		return
	}
	email := normalizeEmail(req.Email)
	if email == "" || strings.TrimSpace(req.Password) == "" {
		writeError(w, http.StatusBadRequest, "email and password are required")
		return
	}
	hash, err := hashPassword(req.Password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "password hashing failed")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	tx, err := a.db.BeginTx(ctx, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	defer mysqlRollback(tx)
	if _, err := mysqlNextRevisionForUpdate(ctx, tx); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	count, err := mysqlAccountCount(ctx, tx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if count > 0 {
		writeError(w, http.StatusConflict, "workspace already bootstrapped")
		return
	}

	now := time.Now().UTC().Format(time.RFC3339)
	workspace := workspaceData{ID: newID("workspace"), Name: fallback(strings.TrimSpace(req.WorkspaceName), "默认团队"), Rows: map[string]syncRow{}, CreatedAt: now, UpdatedAt: now}
	account := accountRecord{ID: newID("account"), WorkspaceID: workspace.ID, Name: fallback(strings.TrimSpace(req.Name), "项目负责人"), Email: email, PasswordHash: hash, CreatedAt: now, UpdatedAt: now}
	if err := mysqlUpsertWorkspace(ctx, tx, workspace); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if err := mysqlUpsertAccount(ctx, tx, account); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	a.writeLoginResponse(w, req.DeviceID, account, workspace)
}

func (a *app) handleLoginMySQL(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req loginRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if strings.TrimSpace(req.DeviceID) == "" {
		writeError(w, http.StatusBadRequest, "device_id is required")
		return
	}
	email := normalizeEmail(firstNonEmpty(req.Email, req.Username))
	if email == "" {
		writeError(w, http.StatusBadRequest, "email is required")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	account, found, err := mysqlAccountByEmail(ctx, a.db, email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "login failed")
		return
	}
	if !found || account.DisabledAt != "" || !checkPassword(req.Password, account.PasswordHash) {
		writeError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}
	workspace, found, err := mysqlWorkspaceByID(ctx, a.db, account.WorkspaceID)
	if err != nil || !found {
		writeError(w, http.StatusUnauthorized, "workspace not found")
		return
	}
	a.writeLoginResponse(w, req.DeviceID, account, workspace)
}

func (a *app) handleMeMySQL(w http.ResponseWriter, r *http.Request, auth authContext) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	account, found, err := mysqlAccountByID(ctx, a.db, auth.AccountID)
	if err != nil || !found {
		writeError(w, http.StatusUnauthorized, "account not found")
		return
	}
	workspace, found, err := mysqlWorkspaceByID(ctx, a.db, auth.WorkspaceID)
	if err != nil || !found {
		writeError(w, http.StatusUnauthorized, "workspace not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"account":   account,
		"workspace": publicWorkspace(workspace),
	})
}

func (a *app) handleChangePasswordMySQL(w http.ResponseWriter, r *http.Request, auth authContext) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req changePasswordRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if strings.TrimSpace(req.NewPassword) == "" {
		writeError(w, http.StatusBadRequest, "new_password is required")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	account, found, err := mysqlAccountByID(ctx, a.db, auth.AccountID)
	if err != nil || !found || !checkPassword(req.OldPassword, account.PasswordHash) {
		writeError(w, http.StatusUnauthorized, "invalid password")
		return
	}
	hash, err := hashPassword(req.NewPassword)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "password hashing failed")
		return
	}
	account.PasswordHash = hash
	account.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	tx, err := a.db.BeginTx(ctx, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	defer mysqlRollback(tx)
	if err := mysqlUpsertAccount(ctx, tx, account); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (a *app) handleStatusMySQL(w http.ResponseWriter, r *http.Request, auth authContext) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	count, err := mysqlRowCount(ctx, a.db, auth.WorkspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load status failed")
		return
	}
	revision, err := mysqlCurrentRevision(ctx, a.db)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load status failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"user_id":          auth.AccountID,
		"account_id":       auth.AccountID,
		"workspace_id":     auth.WorkspaceID,
		"rows":             count,
		"current_revision": revision,
	})
}

func (a *app) handleRevisionMySQL(w http.ResponseWriter, r *http.Request, auth authContext) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	revision, err := mysqlCurrentRevision(ctx, a.db)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load revision failed")
		return
	}
	writeJSON(w, http.StatusOK, revisionResponse{CurrentRevision: revision})
}

func (a *app) handlePullMySQL(w http.ResponseWriter, r *http.Request, auth authContext) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	since := int64(0)
	if raw := strings.TrimSpace(r.URL.Query().Get("since")); raw != "" {
		value, err := strconv.ParseInt(raw, 10, 64)
		if err != nil {
			writeError(w, http.StatusBadRequest, "since must be a number")
			return
		}
		since = value
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	rows, err := mysqlPullRows(ctx, a.db, auth.WorkspaceID, since)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "pull failed")
		return
	}
	revision, err := mysqlCurrentRevision(ctx, a.db)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "pull failed")
		return
	}
	writeJSON(w, http.StatusOK, pullResponse{Changes: rows, CurrentRevision: revision})
}

func (a *app) handlePushMySQL(w http.ResponseWriter, r *http.Request, auth authContext) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req pushRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if strings.TrimSpace(req.DeviceID) == "" {
		writeError(w, http.StatusBadRequest, "device_id is required")
		return
	}
	if len(req.Changes) > 2000 {
		writeError(w, http.StatusBadRequest, "too many changes")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	tx, err := a.db.BeginTx(ctx, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	defer mysqlRollback(tx)
	nextRevision, err := mysqlNextRevisionForUpdate(ctx, tx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	workspace, found, err := mysqlWorkspaceByID(ctx, tx, auth.WorkspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if !found {
		now := time.Now().UTC().Format(time.RFC3339)
		workspace = workspaceData{ID: auth.WorkspaceID, Name: "默认团队", Rows: map[string]syncRow{}, CreatedAt: now, UpdatedAt: now}
		if err := mysqlUpsertWorkspace(ctx, tx, workspace); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
	}

	keys := make([]syncRowKey, 0, len(req.Changes)*2)
	for _, change := range req.Changes {
		entity := strings.TrimSpace(change.Entity)
		id := strings.TrimSpace(change.ID)
		keys = append(keys, syncRowKey{entity: entity, id: id})
		if entity == "work_session" || entity == "execution_signal" {
			taskID := stringField(change.Payload, "taskId")
			if taskID != "" {
				keys = append(keys, syncRowKey{entity: "task", id: taskID})
			}
		}
	}
	workspace.Rows, err = mysqlLoadRowsByKeys(ctx, tx, auth.WorkspaceID, keys)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}

	accepted := make([]syncRow, 0, len(req.Changes))
	conflicts := make([]syncRow, 0)
	changedRows := make([]syncRow, 0)
	for _, change := range req.Changes {
		change.UserID = auth.AccountID
		change.AccountID = auth.AccountID
		change.WorkspaceID = auth.WorkspaceID
		change.DeviceID = req.DeviceID
		change.Entity = strings.TrimSpace(change.Entity)
		change.ID = strings.TrimSpace(change.ID)
		if change.Entity == "" || change.ID == "" {
			conflicts = append(conflicts, change)
			continue
		}
		if _, err := time.Parse(time.RFC3339, change.UpdatedAt); err != nil {
			if _, err := time.Parse(time.RFC3339Nano, change.UpdatedAt); err != nil {
				conflicts = append(conflicts, change)
				continue
			}
		}
		if len(change.Payload) == 0 {
			change.Payload = json.RawMessage(`{}`)
		}
		if change.Version == 0 {
			change.Version = 1
		}
		if err := a.authorizeChangeLocked(auth, workspace, change); err != nil {
			conflicts = append(conflicts, change)
			continue
		}

		rowKey := key(change.Entity, change.ID)
		existing, found := workspace.Rows[rowKey]
		if found && change.UpdatedAt < existing.UpdatedAt {
			conflicts = append(conflicts, existing)
			continue
		}
		if found && change.UpdatedAt == existing.UpdatedAt && string(change.Payload) == string(existing.Payload) && change.DeletedAt == existing.DeletedAt {
			accepted = append(accepted, existing)
			continue
		}

		change.Revision = nextRevision
		nextRevision++
		workspace.Rows[rowKey] = change
		accepted = append(accepted, change)
		changedRows = append(changedRows, change)
	}

	if len(changedRows) > 0 {
		now := time.Now().UTC().Format(time.RFC3339)
		for _, row := range changedRows {
			if err := mysqlUpsertSyncRow(ctx, tx, row); err != nil {
				writeError(w, http.StatusInternalServerError, "save failed")
				return
			}
		}
		if err := mysqlTouchWorkspace(ctx, tx, auth.WorkspaceID, now); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		if err := mysqlSetNextRevision(ctx, tx, nextRevision); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
	}
	currentRevision := nextRevision - 1
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if len(changedRows) > 0 {
		a.notifyWorkspaceChanged(auth.WorkspaceID, currentRevision, req.DeviceID)
	}
	writeJSON(w, http.StatusOK, pushResponse{Accepted: accepted, Conflicts: conflicts, CurrentRevision: currentRevision})
}

func (a *app) handleMembersMySQL(w http.ResponseWriter, r *http.Request, auth authContext) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req memberRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	projectID := strings.TrimSpace(req.ProjectID)
	email := normalizeEmail(req.Email)
	if email == "" || strings.TrimSpace(req.Password) == "" {
		writeError(w, http.StatusBadRequest, "email and password are required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	tx, err := a.db.BeginTx(ctx, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	defer mysqlRollback(tx)
	nextRevision, err := mysqlNextRevisionForUpdate(ctx, tx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	account, found, err := mysqlAccountByEmail(ctx, tx, email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if found && account.WorkspaceID != auth.WorkspaceID {
		writeError(w, http.StatusConflict, "email belongs to another workspace")
		return
	}
	if found && projectID == "" {
		writeError(w, http.StatusConflict, "email already exists")
		return
	}
	now := time.Now().UTC().Format(time.RFC3339)
	if !found {
		hash, err := hashPassword(req.Password)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "password hashing failed")
			return
		}
		account = accountRecord{ID: newID("account"), WorkspaceID: auth.WorkspaceID, Name: fallback(strings.TrimSpace(req.Name), email), Email: email, PasswordHash: hash, CreatedAt: now, UpdatedAt: now}
		if err := mysqlUpsertAccount(ctx, tx, account); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
	}

	teamMemberID := "team_member_" + account.ID
	memberID := "member_" + projectID + "_" + account.ID
	keys := []syncRowKey{{entity: "team_member", id: teamMemberID}}
	if projectID != "" {
		keys = append(keys, syncRowKey{entity: "project_member", id: memberID})
	}
	rows, err := mysqlLoadRowsByKeys(ctx, tx, auth.WorkspaceID, keys)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if projectID == "" {
		if _, exists := rows[key("team_member", teamMemberID)]; exists {
			writeError(w, http.StatusConflict, "member account already exists")
			return
		}
		row := makeTeamMemberRow(auth, account, teamMemberID, req.Name, req.Status, now, nextRevision)
		nextRevision++
		if err := mysqlUpsertSyncRow(ctx, tx, row); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		if err := mysqlTouchWorkspace(ctx, tx, auth.WorkspaceID, now); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		if err := mysqlSetNextRevision(ctx, tx, nextRevision); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		if err := tx.Commit(); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		a.notifyWorkspaceChanged(auth.WorkspaceID, row.Revision, "server")
		writeJSON(w, http.StatusOK, memberResponse{Account: account, Member: row})
		return
	}
	if _, exists := rows[key("project_member", memberID)]; exists {
		writeError(w, http.StatusConflict, "account already belongs to this project")
		return
	}
	if _, exists := rows[key("team_member", teamMemberID)]; !exists {
		teamRow := makeTeamMemberRow(auth, account, teamMemberID, req.Name, req.Status, now, nextRevision)
		nextRevision++
		if err := mysqlUpsertSyncRow(ctx, tx, teamRow); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
	}
	row := makeProjectMemberRow(auth, account, projectID, memberID, teamMemberID, req.Name, req.Roles, req.Status, now, nextRevision)
	nextRevision++
	if err := mysqlUpsertSyncRow(ctx, tx, row); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if err := mysqlTouchWorkspace(ctx, tx, auth.WorkspaceID, now); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if err := mysqlSetNextRevision(ctx, tx, nextRevision); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	a.notifyWorkspaceChanged(auth.WorkspaceID, row.Revision, "server")
	writeJSON(w, http.StatusOK, memberResponse{Account: account, Member: row})
}

func makeTeamMemberRow(auth authContext, account accountRecord, teamMemberID string, name string, status string, now string, revision int64) syncRow {
	payload, _ := json.Marshal(map[string]any{
		"id":        teamMemberID,
		"accountId": account.ID,
		"name":      fallback(strings.TrimSpace(name), account.Name),
		"email":     account.Email,
		"status":    fallback(strings.TrimSpace(status), "active"),
		"createdAt": now,
		"updatedAt": now,
	})
	return syncRow{UserID: auth.AccountID, AccountID: auth.AccountID, WorkspaceID: auth.WorkspaceID, Entity: "team_member", ID: teamMemberID, DeviceID: "server", UpdatedAt: now, Version: 1, Revision: revision, Payload: payload}
}

func makeProjectMemberRow(auth authContext, account accountRecord, projectID string, memberID string, teamMemberID string, name string, roles []string, status string, now string, revision int64) syncRow {
	payload, _ := json.Marshal(map[string]any{
		"id":           memberID,
		"projectId":    projectID,
		"teamMemberId": teamMemberID,
		"accountId":    account.ID,
		"name":         fallback(strings.TrimSpace(name), account.Name),
		"email":        account.Email,
		"roles":        normalizeRoles(roles),
		"status":       fallback(strings.TrimSpace(status), "active"),
		"createdAt":    now,
		"updatedAt":    now,
	})
	return syncRow{UserID: auth.AccountID, AccountID: auth.AccountID, WorkspaceID: auth.WorkspaceID, Entity: "project_member", ID: memberID, DeviceID: "server", UpdatedAt: now, Version: 1, Revision: revision, Payload: payload}
}

func (a *app) handleMemberByIDMySQL(w http.ResponseWriter, r *http.Request, auth authContext) {
	if r.Method != http.MethodPatch {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	memberID := strings.Trim(strings.TrimPrefix(r.URL.Path, "/members/"), "/")
	if memberID == "" {
		writeError(w, http.StatusBadRequest, "member id is required")
		return
	}
	var req memberRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	tx, err := a.db.BeginTx(ctx, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	defer mysqlRollback(tx)
	nextRevision, err := mysqlNextRevisionForUpdate(ctx, tx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	existing, found, err := mysqlMemberRow(ctx, tx, auth.WorkspaceID, memberID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if !found && strings.HasPrefix(memberID, "team_member_") {
		accountID := strings.TrimPrefix(memberID, "team_member_")
		account, ok, err := mysqlAccountByID(ctx, tx, accountID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		if ok && account.WorkspaceID == auth.WorkspaceID {
			timestamp := time.Now().UTC().Format(time.RFC3339)
			status := "active"
			if account.DisabledAt != "" {
				status = "disabled"
			}
			payload, _ := json.Marshal(map[string]any{
				"id":        memberID,
				"accountId": account.ID,
				"name":      account.Name,
				"email":     account.Email,
				"status":    status,
				"createdAt": fallback(account.CreatedAt, timestamp),
				"updatedAt": fallback(account.UpdatedAt, timestamp),
			})
			existing = syncRow{UserID: auth.AccountID, AccountID: auth.AccountID, WorkspaceID: auth.WorkspaceID, Entity: "team_member", ID: memberID, DeviceID: "server", UpdatedAt: timestamp, Version: 1, Payload: payload}
			found = true
		}
	}
	if !found {
		writeError(w, http.StatusNotFound, "member not found")
		return
	}
	var payload map[string]any
	if err := json.Unmarshal(existing.Payload, &payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid member payload")
		return
	}
	now := time.Now().UTC().Format(time.RFC3339)
	if strings.TrimSpace(req.Name) != "" {
		payload["name"] = strings.TrimSpace(req.Name)
	}
	if strings.TrimSpace(req.Email) != "" {
		email := normalizeEmail(req.Email)
		if existing.Entity == "team_member" {
			accountID, _ := payload["accountId"].(string)
			if accountID != "" {
				account, ok, err := mysqlAccountByEmailInWorkspace(ctx, tx, auth.WorkspaceID, email)
				if err != nil {
					writeError(w, http.StatusInternalServerError, "save failed")
					return
				}
				if ok && account.ID != accountID {
					writeError(w, http.StatusConflict, "email belongs to another account")
					return
				}
			}
		}
		payload["email"] = email
	}
	if len(req.Roles) > 0 {
		payload["roles"] = normalizeRoles(req.Roles)
	}
	if strings.TrimSpace(req.Status) != "" {
		payload["status"] = strings.TrimSpace(req.Status)
	}
	if strings.TrimSpace(req.Password) != "" {
		accountID, _ := payload["accountId"].(string)
		email, _ := payload["email"].(string)
		if accountID == "" && existing.Entity == "team_member" {
			accountID = newID("account")
			payload["accountId"] = accountID
		}
		if accountID == "" {
			writeError(w, http.StatusBadRequest, "member account is required to update password")
			return
		}
		account, ok, err := mysqlAccountByID(ctx, tx, accountID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		if !ok || account.WorkspaceID != auth.WorkspaceID {
			if existing.Entity != "team_member" || normalizeEmail(email) == "" {
				writeError(w, http.StatusNotFound, "member account not found")
				return
			}
			if conflict, ok, err := mysqlAccountByEmailInWorkspace(ctx, tx, auth.WorkspaceID, email); err != nil {
				writeError(w, http.StatusInternalServerError, "save failed")
				return
			} else if ok && conflict.ID != accountID {
				writeError(w, http.StatusConflict, "email belongs to another account")
				return
			}
			name, _ := payload["name"].(string)
			account = accountRecord{ID: accountID, WorkspaceID: auth.WorkspaceID, Name: fallback(strings.TrimSpace(name), normalizeEmail(email)), Email: normalizeEmail(email), CreatedAt: now, UpdatedAt: now}
		}
		hash, err := hashPassword(req.Password)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "password hashing failed")
			return
		}
		account.PasswordHash = hash
		if name, ok := payload["name"].(string); ok && strings.TrimSpace(name) != "" {
			account.Name = strings.TrimSpace(name)
		}
		if email, ok := payload["email"].(string); ok && strings.TrimSpace(email) != "" {
			account.Email = normalizeEmail(email)
		}
		account.UpdatedAt = now
		if err := mysqlUpsertAccount(ctx, tx, account); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
	}
	if existing.Entity == "team_member" {
		accountID, _ := payload["accountId"].(string)
		if accountID != "" {
			account, ok, err := mysqlAccountByID(ctx, tx, accountID)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "save failed")
				return
			}
			if ok && account.WorkspaceID == auth.WorkspaceID {
				if name, ok := payload["name"].(string); ok && strings.TrimSpace(name) != "" {
					account.Name = strings.TrimSpace(name)
				}
				if email, ok := payload["email"].(string); ok && strings.TrimSpace(email) != "" {
					account.Email = normalizeEmail(email)
				}
				account.UpdatedAt = now
				if err := mysqlUpsertAccount(ctx, tx, account); err != nil {
					writeError(w, http.StatusInternalServerError, "save failed")
					return
				}
			}
		}
	}
	payload["updatedAt"] = now
	bytes, _ := json.Marshal(payload)
	existing.UserID = auth.AccountID
	existing.AccountID = auth.AccountID
	existing.WorkspaceID = auth.WorkspaceID
	existing.DeviceID = "server"
	existing.UpdatedAt = now
	existing.Revision = nextRevision
	existing.Payload = bytes
	nextRevision++
	if err := mysqlUpsertSyncRow(ctx, tx, existing); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if err := mysqlTouchWorkspace(ctx, tx, auth.WorkspaceID, now); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if err := mysqlSetNextRevision(ctx, tx, nextRevision); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	a.notifyWorkspaceChanged(auth.WorkspaceID, existing.Revision, "server")
	writeJSON(w, http.StatusOK, memberResponse{Member: existing})
}

func (a *app) eventCurrentRevision(ctx context.Context) int64 {
	if a.db == nil {
		a.mu.Lock()
		defer a.mu.Unlock()
		return a.store.NextRevision - 1
	}
	revision, err := mysqlCurrentRevision(ctx, a.db)
	if err != nil {
		return 0
	}
	return revision
}
