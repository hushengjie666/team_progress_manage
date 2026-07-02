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
	var ownerAccountID sql.NullString
	err := row.Scan(&workspace.ID, &workspace.Name, &workspace.Type, &ownerAccountID, &workspace.CreatedAt, &workspace.UpdatedAt)
	if workspace.Type == "" {
		workspace.Type = "shared"
	}
	if ownerAccountID.Valid {
		workspace.OwnerAccountID = ownerAccountID.String
	}
	workspace.Rows = map[string]syncRow{}
	return workspace, err
}

func scanWorkspaceMembership(row interface{ Scan(...any) error }) (workspaceMembershipRecord, error) {
	var membership workspaceMembershipRecord
	err := row.Scan(&membership.ID, &membership.WorkspaceID, &membership.AccountID, &membership.Role, &membership.Status, &membership.CreatedAt, &membership.UpdatedAt)
	return membership, err
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
	workspace, err := scanWorkspace(q.QueryRowContext(ctx, `SELECT id, name, type, owner_account_id, created_at, updated_at FROM workspaces ORDER BY created_at ASC LIMIT 1`))
	if errors.Is(err, sql.ErrNoRows) {
		return workspaceData{}, false, nil
	}
	return workspace, err == nil, err
}

func mysqlWorkspaceByID(ctx context.Context, q sqlRunner, workspaceID string) (workspaceData, bool, error) {
	workspace, err := scanWorkspace(q.QueryRowContext(ctx, `SELECT id, name, type, owner_account_id, created_at, updated_at FROM workspaces WHERE id = ?`, workspaceID))
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

func mysqlMembershipByAccountAndWorkspace(ctx context.Context, q sqlRunner, accountID string, workspaceID string) (workspaceMembershipRecord, bool, error) {
	membership, err := scanWorkspaceMembership(q.QueryRowContext(
		ctx,
		`SELECT id, workspace_id, account_id, role, status, created_at, updated_at FROM workspace_memberships WHERE account_id = ? AND workspace_id = ?`,
		accountID,
		workspaceID,
	))
	if errors.Is(err, sql.ErrNoRows) {
		return workspaceMembershipRecord{}, false, nil
	}
	return membership, err == nil, err
}

func mysqlActiveMembershipByAccountAndWorkspace(ctx context.Context, q sqlRunner, accountID string, workspaceID string) (workspaceMembershipRecord, bool, error) {
	membership, ok, err := mysqlMembershipByAccountAndWorkspace(ctx, q, accountID, workspaceID)
	if err != nil || !ok || membership.Status != "active" {
		return workspaceMembershipRecord{}, false, err
	}
	return membership, true, nil
}

func mysqlWorkspaceVisibleToAccount(ctx context.Context, q sqlRunner, accountID string, workspaceID string) (workspaceData, bool, error) {
	workspace, found, err := mysqlWorkspaceByID(ctx, q, workspaceID)
	if err != nil || !found {
		return workspaceData{}, false, err
	}
	if fallback(workspace.Type, "shared") == "private" && workspace.OwnerAccountID != accountID {
		return workspaceData{}, false, nil
	}
	if _, found, err := mysqlActiveMembershipByAccountAndWorkspace(ctx, q, accountID, workspaceID); err != nil || !found {
		return workspaceData{}, false, err
	}
	return workspace, true, nil
}

func mysqlMembershipSummaryByAccountAndWorkspace(ctx context.Context, q sqlRunner, accountID string, workspaceID string) (workspaceMembershipSummary, bool, error) {
	var result workspaceMembershipSummary
	err := q.QueryRowContext(
		ctx,
		`SELECT m.id, m.workspace_id, m.account_id, a.name, a.email, m.role, m.status, m.created_at, m.updated_at
		 FROM workspace_memberships m
		 JOIN accounts a ON a.id = m.account_id
		 WHERE m.account_id = ? AND m.workspace_id = ? AND m.status = 'active'`,
		accountID,
		workspaceID,
	).Scan(&result.ID, &result.WorkspaceID, &result.AccountID, &result.Name, &result.Email, &result.Role, &result.Status, &result.CreatedAt, &result.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return workspaceMembershipSummary{}, false, nil
	}
	return result, err == nil, err
}

func mysqlWorkspaceSummariesForAccount(ctx context.Context, q sqlRunner, accountID string) ([]workspaceSummary, error) {
	rows, err := q.QueryContext(
		ctx,
		`SELECT id, name, type, owner_account_id, created_at, updated_at
		 FROM (
		   SELECT w.id, w.name, w.type, w.owner_account_id, w.created_at, w.updated_at
		   FROM workspace_memberships m
		   JOIN workspaces w ON w.id = m.workspace_id
		   WHERE m.account_id = ? AND m.status = 'active'
		     AND (COALESCE(NULLIF(w.type, ''), 'shared') <> 'private' OR w.owner_account_id = ?)
		   UNION
		   SELECT DISTINCT w.id, w.name, w.type, w.owner_account_id, w.created_at, w.updated_at
		   FROM team_project_members pm
		   JOIN workspaces w ON w.id = pm.workspace_id
		   WHERE pm.account_ref = ? AND pm.deleted_at IS NULL AND COALESCE(NULLIF(pm.status, ''), 'active') = 'active'
		     AND COALESCE(NULLIF(w.type, ''), 'shared') <> 'private'
		 ) visible_workspaces
		 ORDER BY CASE WHEN COALESCE(NULLIF(type, ''), 'shared') = 'private' THEN 0 ELSE 1 END, created_at ASC`,
		accountID,
		accountID,
		accountID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []workspaceSummary{}
	for rows.Next() {
		workspace, err := scanWorkspace(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, publicWorkspace(workspace))
	}
	return result, rows.Err()
}

func mysqlWorkspaceMembershipSummaries(ctx context.Context, q sqlRunner, workspaceID string) ([]workspaceMembershipSummary, error) {
	rows, err := q.QueryContext(
		ctx,
		`SELECT m.id, m.workspace_id, m.account_id, a.name, a.email, m.role, m.status, m.created_at, m.updated_at
		 FROM workspace_memberships m
		 JOIN accounts a ON a.id = m.account_id
		 WHERE m.workspace_id = ?
		 ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, a.name ASC`,
		workspaceID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []workspaceMembershipSummary{}
	for rows.Next() {
		var item workspaceMembershipSummary
		if err := rows.Scan(&item.ID, &item.WorkspaceID, &item.AccountID, &item.Name, &item.Email, &item.Role, &item.Status, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	return result, rows.Err()
}

func mysqlWorkspaceMembershipSummaryByID(ctx context.Context, q sqlRunner, workspaceID string, membershipID string) (workspaceMembershipSummary, bool, error) {
	var item workspaceMembershipSummary
	err := q.QueryRowContext(
		ctx,
		`SELECT m.id, m.workspace_id, m.account_id, a.name, a.email, m.role, m.status, m.created_at, m.updated_at
		 FROM workspace_memberships m
		 JOIN accounts a ON a.id = m.account_id
		 WHERE m.workspace_id = ? AND m.id = ?`,
		workspaceID,
		membershipID,
	).Scan(&item.ID, &item.WorkspaceID, &item.AccountID, &item.Name, &item.Email, &item.Role, &item.Status, &item.CreatedAt, &item.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return workspaceMembershipSummary{}, false, nil
	}
	return item, err == nil, err
}

func scanWorkspaceInvitationSummary(row interface{ Scan(...any) error }) (workspaceInvitationSummary, error) {
	var invitation workspaceInvitationSummary
	var acceptedAt sql.NullString
	err := row.Scan(
		&invitation.ID,
		&invitation.WorkspaceID,
		&invitation.WorkspaceName,
		&invitation.WorkspaceType,
		&invitation.InviterAccountID,
		&invitation.InviterName,
		&invitation.InviterEmail,
		&invitation.InviteeAccountID,
		&invitation.InviteeEmail,
		&invitation.Status,
		&invitation.CreatedAt,
		&invitation.UpdatedAt,
		&acceptedAt,
	)
	if acceptedAt.Valid {
		invitation.AcceptedAt = acceptedAt.String
	}
	return invitation, err
}

func mysqlWorkspaceInvitationSummariesForAccount(ctx context.Context, q sqlRunner, accountID string) ([]workspaceInvitationSummary, error) {
	rows, err := q.QueryContext(
		ctx,
		`SELECT i.id, i.workspace_id, w.name, w.type, i.inviter_account_id, inviter.name, inviter.email,
		        i.invitee_account_id, i.invitee_email, i.status, i.created_at, i.updated_at, i.accepted_at
		 FROM workspace_invitations i
		 JOIN workspaces w ON w.id = i.workspace_id
		 JOIN accounts inviter ON inviter.id = i.inviter_account_id
		 WHERE i.invitee_account_id = ? AND i.status = 'pending'
		 ORDER BY i.created_at ASC`,
		accountID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []workspaceInvitationSummary{}
	for rows.Next() {
		invitation, err := scanWorkspaceInvitationSummary(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, invitation)
	}
	return result, rows.Err()
}

func mysqlWorkspaceInvitationSummaryByID(ctx context.Context, q sqlRunner, invitationID string) (workspaceInvitationSummary, bool, error) {
	invitation, err := scanWorkspaceInvitationSummary(q.QueryRowContext(
		ctx,
		`SELECT i.id, i.workspace_id, w.name, w.type, i.inviter_account_id, inviter.name, inviter.email,
		        i.invitee_account_id, i.invitee_email, i.status, i.created_at, i.updated_at, i.accepted_at
		 FROM workspace_invitations i
		 JOIN workspaces w ON w.id = i.workspace_id
		 JOIN accounts inviter ON inviter.id = i.inviter_account_id
		 WHERE i.id = ?`,
		invitationID,
	))
	if errors.Is(err, sql.ErrNoRows) {
		return workspaceInvitationSummary{}, false, nil
	}
	return invitation, err == nil, err
}

func mysqlPendingWorkspaceInvitation(ctx context.Context, q sqlRunner, workspaceID string, inviteeAccountID string) (workspaceInvitationSummary, bool, error) {
	invitation, err := scanWorkspaceInvitationSummary(q.QueryRowContext(
		ctx,
		`SELECT i.id, i.workspace_id, w.name, w.type, i.inviter_account_id, inviter.name, inviter.email,
		        i.invitee_account_id, i.invitee_email, i.status, i.created_at, i.updated_at, i.accepted_at
		 FROM workspace_invitations i
		 JOIN workspaces w ON w.id = i.workspace_id
		 JOIN accounts inviter ON inviter.id = i.inviter_account_id
		 WHERE i.workspace_id = ? AND i.invitee_account_id = ? AND i.status = 'pending'`,
		workspaceID,
		inviteeAccountID,
	))
	if errors.Is(err, sql.ErrNoRows) {
		return workspaceInvitationSummary{}, false, nil
	}
	return invitation, err == nil, err
}

func mysqlUpsertWorkspaceInvitation(ctx context.Context, tx *sql.Tx, invitation workspaceInvitationSummary) error {
	_, err := tx.ExecContext(
		ctx,
		`INSERT INTO workspace_invitations (id, workspace_id, inviter_account_id, invitee_account_id, invitee_email, status, created_at, updated_at, accepted_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON DUPLICATE KEY UPDATE
		  inviter_account_id = VALUES(inviter_account_id),
		  invitee_email = VALUES(invitee_email),
		  status = VALUES(status),
		  updated_at = VALUES(updated_at),
		  accepted_at = VALUES(accepted_at)`,
		invitation.ID,
		invitation.WorkspaceID,
		invitation.InviterAccountID,
		invitation.InviteeAccountID,
		invitation.InviteeEmail,
		fallback(invitation.Status, "pending"),
		invitation.CreatedAt,
		invitation.UpdatedAt,
		nullString(invitation.AcceptedAt),
	)
	return err
}

func mysqlProjectRowByID(ctx context.Context, q sqlRunner, workspaceID string, projectID string) (syncRow, bool, error) {
	workspaceID = strings.TrimSpace(workspaceID)
	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		return syncRow{}, false, nil
	}
	rows, err := q.QueryContext(
		ctx,
		`SELECT workspace_id, 'project' AS entity, id, user_id, account_id, device_id, updated_at, deleted_at, version, revision, payload
		 FROM team_projects
		 WHERE id = ? AND (? = '' OR workspace_id = ?) AND deleted_at IS NULL
		 ORDER BY updated_at DESC
		 LIMIT 1`,
		projectID,
		workspaceID,
		workspaceID,
	)
	if err != nil {
		return syncRow{}, false, err
	}
	defer rows.Close()
	items, err := scanSyncRows(rows)
	if err != nil {
		return syncRow{}, false, err
	}
	if len(items) == 0 {
		return syncRow{}, false, nil
	}
	return items[0], true, nil
}

func scanProjectInvitationSummary(row interface{ Scan(...any) error }) (projectInvitationSummary, error) {
	var invitation projectInvitationSummary
	var rolesRaw []byte
	var acceptedAt sql.NullString
	var projectPayload string
	err := row.Scan(
		&invitation.ID,
		&invitation.WorkspaceID,
		&invitation.WorkspaceName,
		&invitation.ProjectID,
		&projectPayload,
		&invitation.InviterAccountID,
		&invitation.InviterName,
		&invitation.InviterEmail,
		&invitation.InviteeAccountID,
		&invitation.InviteeEmail,
		&rolesRaw,
		&invitation.Status,
		&invitation.CreatedAt,
		&invitation.UpdatedAt,
		&acceptedAt,
	)
	if len(rolesRaw) > 0 {
		var roles []string
		if err := json.Unmarshal(rolesRaw, &roles); err == nil {
			invitation.Roles = normalizeRoles(roles)
		}
	}
	if len(invitation.Roles) == 0 {
		invitation.Roles = []string{"executor"}
	}
	if projectPayload != "" {
		invitation.ProjectName = fallback(stringField(json.RawMessage(projectPayload), "name"), invitation.ProjectID)
	} else {
		invitation.ProjectName = invitation.ProjectID
	}
	if acceptedAt.Valid {
		invitation.AcceptedAt = acceptedAt.String
	}
	return invitation, err
}

func mysqlProjectInvitationSummariesForAccount(ctx context.Context, q sqlRunner, accountID string) ([]projectInvitationSummary, error) {
	rows, err := q.QueryContext(
		ctx,
		`SELECT i.id, i.workspace_id, w.name, i.project_id, COALESCE(CAST(p.payload AS CHAR), ''),
		        i.inviter_account_id, inviter.name, inviter.email, i.invitee_account_id, i.invitee_email,
		        i.roles_json, i.status, i.created_at, i.updated_at, i.accepted_at
		 FROM project_invitations i
		 JOIN workspaces w ON w.id = i.workspace_id
		 JOIN accounts inviter ON inviter.id = i.inviter_account_id
		 LEFT JOIN team_projects p ON p.workspace_id = i.workspace_id AND p.id = i.project_id AND p.deleted_at IS NULL
		 WHERE i.invitee_account_id = ? AND i.status = 'pending'
		 ORDER BY i.created_at ASC`,
		accountID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []projectInvitationSummary{}
	for rows.Next() {
		invitation, err := scanProjectInvitationSummary(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, invitation)
	}
	return result, rows.Err()
}

func mysqlProjectInvitationSummaryByID(ctx context.Context, q sqlRunner, invitationID string) (projectInvitationSummary, bool, error) {
	invitation, err := scanProjectInvitationSummary(q.QueryRowContext(
		ctx,
		`SELECT i.id, i.workspace_id, w.name, i.project_id, COALESCE(CAST(p.payload AS CHAR), ''),
		        i.inviter_account_id, inviter.name, inviter.email, i.invitee_account_id, i.invitee_email,
		        i.roles_json, i.status, i.created_at, i.updated_at, i.accepted_at
		 FROM project_invitations i
		 JOIN workspaces w ON w.id = i.workspace_id
		 JOIN accounts inviter ON inviter.id = i.inviter_account_id
		 LEFT JOIN team_projects p ON p.workspace_id = i.workspace_id AND p.id = i.project_id AND p.deleted_at IS NULL
		 WHERE i.id = ?`,
		invitationID,
	))
	if errors.Is(err, sql.ErrNoRows) {
		return projectInvitationSummary{}, false, nil
	}
	return invitation, err == nil, err
}

func mysqlPendingProjectInvitation(ctx context.Context, q sqlRunner, workspaceID string, projectID string, inviteeAccountID string) (projectInvitationSummary, bool, error) {
	invitation, err := scanProjectInvitationSummary(q.QueryRowContext(
		ctx,
		`SELECT i.id, i.workspace_id, w.name, i.project_id, COALESCE(CAST(p.payload AS CHAR), ''),
		        i.inviter_account_id, inviter.name, inviter.email, i.invitee_account_id, i.invitee_email,
		        i.roles_json, i.status, i.created_at, i.updated_at, i.accepted_at
		 FROM project_invitations i
		 JOIN workspaces w ON w.id = i.workspace_id
		 JOIN accounts inviter ON inviter.id = i.inviter_account_id
		 LEFT JOIN team_projects p ON p.workspace_id = i.workspace_id AND p.id = i.project_id AND p.deleted_at IS NULL
		 WHERE i.workspace_id = ? AND i.project_id = ? AND i.invitee_account_id = ? AND i.status = 'pending'`,
		workspaceID,
		projectID,
		inviteeAccountID,
	))
	if errors.Is(err, sql.ErrNoRows) {
		return projectInvitationSummary{}, false, nil
	}
	return invitation, err == nil, err
}

func mysqlUpsertProjectInvitation(ctx context.Context, tx *sql.Tx, invitation projectInvitationSummary) error {
	rolesRaw, err := json.Marshal(normalizeRoles(invitation.Roles))
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(
		ctx,
		`INSERT INTO project_invitations (id, workspace_id, project_id, inviter_account_id, invitee_account_id, invitee_email, roles_json, status, created_at, updated_at, accepted_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON DUPLICATE KEY UPDATE
		  inviter_account_id = VALUES(inviter_account_id),
		  invitee_email = VALUES(invitee_email),
		  roles_json = VALUES(roles_json),
		  status = VALUES(status),
		  updated_at = VALUES(updated_at),
		  accepted_at = VALUES(accepted_at)`,
		invitation.ID,
		invitation.WorkspaceID,
		invitation.ProjectID,
		invitation.InviterAccountID,
		invitation.InviteeAccountID,
		invitation.InviteeEmail,
		rolesRaw,
		fallback(invitation.Status, "pending"),
		invitation.CreatedAt,
		invitation.UpdatedAt,
		nullString(invitation.AcceptedAt),
	)
	return err
}

func mysqlUpsertWorkspaceMembership(ctx context.Context, tx *sql.Tx, membership workspaceMembershipRecord) error {
	_, err := tx.ExecContext(
		ctx,
		`INSERT INTO workspace_memberships (id, workspace_id, account_id, role, status, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE role = VALUES(role), status = VALUES(status), updated_at = VALUES(updated_at)`,
		membership.ID,
		membership.WorkspaceID,
		membership.AccountID,
		fallback(membership.Role, "member"),
		fallback(membership.Status, "active"),
		membership.CreatedAt,
		membership.UpdatedAt,
	)
	return err
}

func mysqlEnsureWorkspaceMembership(ctx context.Context, tx *sql.Tx, workspaceID string, accountID string, role string, status string, now string) error {
	return mysqlUpsertWorkspaceMembership(ctx, tx, workspaceMembershipRecord{
		ID:          "membership_" + workspaceID + "_" + accountID,
		WorkspaceID: workspaceID,
		AccountID:   accountID,
		Role:        fallback(role, "member"),
		Status:      fallback(status, "active"),
		CreatedAt:   now,
		UpdatedAt:   now,
	})
}

func mysqlRestrictWorkspaceToOwner(ctx context.Context, tx *sql.Tx, workspaceID string, ownerAccountID string, now string) error {
	if _, err := tx.ExecContext(
		ctx,
		`UPDATE workspace_memberships
		 SET status = 'disabled', updated_at = ?
		 WHERE workspace_id = ? AND account_id <> ? AND status <> 'disabled'`,
		now,
		workspaceID,
		ownerAccountID,
	); err != nil {
		return err
	}
	_, err := tx.ExecContext(
		ctx,
		`UPDATE workspace_invitations
		 SET status = 'cancelled', updated_at = ?
		 WHERE workspace_id = ? AND status = 'pending'`,
		now,
		workspaceID,
	)
	return err
}

func mysqlSetWorkspaceOwner(ctx context.Context, tx *sql.Tx, workspaceID string, ownerAccountID string, now string) error {
	if err := mysqlEnsureWorkspaceMembership(ctx, tx, workspaceID, ownerAccountID, "owner", "active", now); err != nil {
		return err
	}
	_, err := tx.ExecContext(
		ctx,
		`UPDATE workspace_memberships
		 SET role = 'member', updated_at = ?
		 WHERE workspace_id = ? AND account_id <> ? AND role = 'owner'`,
		now,
		workspaceID,
		ownerAccountID,
	)
	return err
}

func privateWorkspaceID(accountID string) string {
	return "workspace_private_" + accountID
}

func mysqlEnsurePrivateWorkspaceForAccount(ctx context.Context, tx *sql.Tx, account accountRecord, now string) (workspaceData, error) {
	workspace := workspaceData{
		ID:             privateWorkspaceID(account.ID),
		Name:           fallback(account.Name, account.Email) + "的私人工作区",
		Type:           "private",
		OwnerAccountID: account.ID,
		Rows:           map[string]syncRow{},
		CreatedAt:      fallback(account.CreatedAt, now),
		UpdatedAt:      now,
	}
	if err := mysqlUpsertWorkspace(ctx, tx, workspace); err != nil {
		return workspaceData{}, err
	}
	if err := mysqlEnsureWorkspaceMembership(ctx, tx, workspace.ID, account.ID, "owner", "active", now); err != nil {
		return workspaceData{}, err
	}
	return workspace, nil
}

func mysqlDefaultWorkspaceForAccount(ctx context.Context, q sqlRunner, account accountRecord) (workspaceData, bool, error) {
	if account.WorkspaceID != "" {
		if workspace, ok, err := mysqlWorkspaceVisibleToAccount(ctx, q, account.ID, account.WorkspaceID); err != nil {
			return workspaceData{}, false, err
		} else if ok {
			return workspace, true, nil
		}
	}
	privateID := privateWorkspaceID(account.ID)
	if workspace, ok, err := mysqlWorkspaceVisibleToAccount(ctx, q, account.ID, privateID); err != nil {
		return workspaceData{}, false, err
	} else if ok {
		return workspace, true, nil
	}
	rows, err := q.QueryContext(
		ctx,
		`SELECT w.id, w.name, w.type, w.owner_account_id, w.created_at, w.updated_at
		 FROM workspace_memberships m
		 JOIN workspaces w ON w.id = m.workspace_id
		 WHERE m.account_id = ? AND m.status = 'active'
		   AND (COALESCE(NULLIF(w.type, ''), 'shared') <> 'private' OR w.owner_account_id = ?)
		 ORDER BY w.created_at ASC LIMIT 1`,
		account.ID,
		account.ID,
	)
	if err != nil {
		return workspaceData{}, false, err
	}
	defer rows.Close()
	if rows.Next() {
		workspace, err := scanWorkspace(rows)
		return workspace, err == nil, err
	}
	if err := rows.Err(); err != nil {
		return workspaceData{}, false, err
	}
	return workspaceData{}, false, nil
}

func mysqlUpsertWorkspace(ctx context.Context, tx *sql.Tx, workspace workspaceData) error {
	_, err := tx.ExecContext(
		ctx,
		`INSERT INTO workspaces (id, name, type, owner_account_id, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE name = VALUES(name), type = VALUES(type), owner_account_id = VALUES(owner_account_id), updated_at = VALUES(updated_at)`,
		workspace.ID,
		workspace.Name,
		fallback(workspace.Type, "shared"),
		nullString(workspace.OwnerAccountID),
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
	})
	if err != nil {
		return syncRow{}, false, err
	}
	if row, ok := rows[key("project_member", memberID)]; ok {
		return row, true, nil
	}
	return syncRow{}, false, nil
}

func mysqlRollback(tx *sql.Tx) {
	_ = tx.Rollback()
}

const defaultAdminAccountID = "account_admin"
const defaultAdminUsername = "admin"
const defaultAdminName = "超级管理员"
const defaultAdminPassword = "hu626699"

func isDefaultAdminAuth(auth authContext) bool {
	return auth.AccountID == defaultAdminAccountID
}

type platformAccountRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Status   string `json:"status"`
}

type platformAccountsResponse struct {
	Accounts []accountRecord `json:"accounts"`
}

type platformAccountResponse struct {
	Account accountRecord `json:"account"`
}

func publicAccountRecord(account accountRecord) accountRecord {
	account.PasswordHash = ""
	return account
}

func publicAccountRecords(accounts []accountRecord) []accountRecord {
	result := make([]accountRecord, 0, len(accounts))
	for _, account := range accounts {
		result = append(result, publicAccountRecord(account))
	}
	return result
}

func normalizePlatformAccountStatus(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "", "active":
		return "active"
	case "disabled":
		return "disabled"
	default:
		return ""
	}
}

func mysqlPlatformAccounts(ctx context.Context, q sqlRunner) ([]accountRecord, error) {
	rows, err := q.QueryContext(
		ctx,
		`SELECT id, workspace_id, name, email, password_hash, disabled_at, created_at, updated_at
		 FROM accounts
		 ORDER BY CASE WHEN id = ? THEN 0 ELSE 1 END, created_at ASC, name ASC`,
		defaultAdminAccountID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []accountRecord{}
	for rows.Next() {
		account, err := scanAccount(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, account)
	}
	return result, rows.Err()
}

func (a *app) handleAdminAccounts(w http.ResponseWriter, r *http.Request, auth authContext) {
	if a.db == nil {
		writeError(w, http.StatusNotImplemented, "admin account management requires mysql backend")
		return
	}
	if !isDefaultAdminAuth(auth) {
		writeError(w, http.StatusForbidden, "only super admin can manage platform accounts")
		return
	}
	switch r.Method {
	case http.MethodGet:
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		accounts, err := mysqlPlatformAccounts(ctx, a.db)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "load accounts failed")
			return
		}
		writeJSON(w, http.StatusOK, platformAccountsResponse{Accounts: publicAccountRecords(accounts)})
	case http.MethodPost:
		var req platformAccountRequest
		if err := decodeJSON(w, r, &req); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		email := normalizeEmail(req.Email)
		if email == "" {
			writeError(w, http.StatusBadRequest, "email is required")
			return
		}
		status := normalizePlatformAccountStatus(req.Status)
		if status == "" {
			writeError(w, http.StatusBadRequest, "invalid account status")
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
		account, found, err := mysqlAccountByEmail(ctx, tx, email)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		if !found && strings.TrimSpace(req.Password) == "" {
			writeError(w, http.StatusBadRequest, "password is required for a new account")
			return
		}
		now := time.Now().UTC().Format(time.RFC3339)
		if !found {
			hash, err := hashPassword(req.Password)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "password hashing failed")
				return
			}
			accountID := newID("account")
			account = accountRecord{
				ID:           accountID,
				WorkspaceID:  privateWorkspaceID(accountID),
				Name:         fallback(strings.TrimSpace(req.Name), email),
				Email:        email,
				PasswordHash: hash,
				CreatedAt:    now,
				UpdatedAt:    now,
			}
		} else {
			account.WorkspaceID = privateWorkspaceID(account.ID)
			account.Name = fallback(strings.TrimSpace(req.Name), account.Name)
			account.Email = email
			account.UpdatedAt = now
			if strings.TrimSpace(req.Password) != "" {
				hash, err := hashPassword(req.Password)
				if err != nil {
					writeError(w, http.StatusInternalServerError, "password hashing failed")
					return
				}
				account.PasswordHash = hash
			}
		}
		if status == "disabled" {
			if account.ID == defaultAdminAccountID {
				writeError(w, http.StatusBadRequest, "default admin account cannot be disabled")
				return
			}
			account.DisabledAt = now
		} else {
			account.DisabledAt = ""
		}
		if err := mysqlUpsertAccount(ctx, tx, account); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		if _, err := mysqlEnsurePrivateWorkspaceForAccount(ctx, tx, account, now); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		if err := tx.Commit(); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		writeJSON(w, http.StatusOK, platformAccountResponse{Account: publicAccountRecord(account)})
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (a *app) handleAdminAccountByID(w http.ResponseWriter, r *http.Request, auth authContext) {
	if a.db == nil {
		writeError(w, http.StatusNotImplemented, "admin account management requires mysql backend")
		return
	}
	if !isDefaultAdminAuth(auth) {
		writeError(w, http.StatusForbidden, "only super admin can manage platform accounts")
		return
	}
	if r.Method != http.MethodPatch {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	accountID := strings.Trim(strings.TrimPrefix(r.URL.Path, "/admin/accounts/"), "/")
	if accountID == "" {
		writeError(w, http.StatusBadRequest, "account id is required")
		return
	}
	var req platformAccountRequest
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
	account, found, err := mysqlAccountByID(ctx, tx, accountID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if !found {
		writeError(w, http.StatusNotFound, "account not found")
		return
	}
	now := time.Now().UTC().Format(time.RFC3339)
	if strings.TrimSpace(req.Name) != "" {
		account.Name = strings.TrimSpace(req.Name)
	}
	if strings.TrimSpace(req.Email) != "" {
		email := normalizeEmail(req.Email)
		if email == "" {
			writeError(w, http.StatusBadRequest, "email is required")
			return
		}
		if conflict, ok, err := mysqlAccountByEmail(ctx, tx, email); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		} else if ok && conflict.ID != account.ID {
			writeError(w, http.StatusConflict, "email belongs to another account")
			return
		}
		account.Email = email
	}
	if strings.TrimSpace(req.Password) != "" {
		hash, err := hashPassword(req.Password)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "password hashing failed")
			return
		}
		account.PasswordHash = hash
	}
	if strings.TrimSpace(req.Status) != "" {
		status := normalizePlatformAccountStatus(req.Status)
		if status == "" {
			writeError(w, http.StatusBadRequest, "invalid account status")
			return
		}
		if status == "disabled" {
			if account.ID == defaultAdminAccountID {
				writeError(w, http.StatusBadRequest, "default admin account cannot be disabled")
				return
			}
			account.DisabledAt = now
		} else {
			account.DisabledAt = ""
		}
	}
	account.WorkspaceID = privateWorkspaceID(account.ID)
	account.UpdatedAt = now
	if err := mysqlUpsertAccount(ctx, tx, account); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if _, err := mysqlEnsurePrivateWorkspaceForAccount(ctx, tx, account, now); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	writeJSON(w, http.StatusOK, platformAccountResponse{Account: publicAccountRecord(account)})
}

func ensureDefaultAdminAccount(ctx context.Context, db *sql.DB) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer mysqlRollback(tx)
	if _, err := mysqlNextRevisionForUpdate(ctx, tx); err != nil {
		return err
	}
	count, err := mysqlAccountCount(ctx, tx)
	if err != nil {
		return err
	}
	if count > 0 {
		return tx.Commit()
	}
	hash, err := hashPassword(defaultAdminPassword)
	if err != nil {
		return err
	}
	now := time.Now().UTC().Format(time.RFC3339)
	accountID := defaultAdminAccountID
	workspace := workspaceData{
		ID:             privateWorkspaceID(accountID),
		Name:           defaultAdminName + "的私人工作区",
		Type:           "private",
		OwnerAccountID: accountID,
		Rows:           map[string]syncRow{},
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	account := accountRecord{
		ID:           accountID,
		WorkspaceID:  workspace.ID,
		Name:         defaultAdminName,
		Email:        defaultAdminUsername,
		PasswordHash: hash,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if err := mysqlUpsertWorkspace(ctx, tx, workspace); err != nil {
		return err
	}
	if err := mysqlUpsertAccount(ctx, tx, account); err != nil {
		return err
	}
	if err := mysqlEnsureWorkspaceMembership(ctx, tx, workspace.ID, account.ID, "owner", "active", now); err != nil {
		return err
	}
	return tx.Commit()
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
	accountID := newID("account")
	accountName := fallback(strings.TrimSpace(req.Name), "用户")
	workspace := workspaceData{
		ID:             privateWorkspaceID(accountID),
		Name:           firstNonEmpty(strings.TrimSpace(req.WorkspaceName), accountName+"的私人工作区"),
		Type:           "private",
		OwnerAccountID: accountID,
		Rows:           map[string]syncRow{},
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	account := accountRecord{ID: accountID, WorkspaceID: workspace.ID, Name: accountName, Email: email, PasswordHash: hash, CreatedAt: now, UpdatedAt: now}
	if err := mysqlUpsertWorkspace(ctx, tx, workspace); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if err := mysqlUpsertAccount(ctx, tx, account); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if err := mysqlEnsureWorkspaceMembership(ctx, tx, workspace.ID, account.ID, "owner", "active", now); err != nil {
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
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
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
	tx, err := a.db.BeginTx(ctx, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "login failed")
		return
	}
	defer mysqlRollback(tx)
	now := time.Now().UTC().Format(time.RFC3339)
	if _, err := mysqlEnsurePrivateWorkspaceForAccount(ctx, tx, account, now); err != nil {
		writeError(w, http.StatusInternalServerError, "login failed")
		return
	}
	workspace, found, err := mysqlDefaultWorkspaceForAccount(ctx, tx, account)
	if err != nil || !found {
		writeError(w, http.StatusUnauthorized, "workspace not found")
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "login failed")
		return
	}
	a.writeLoginResponse(w, req.DeviceID, account, workspace)
}

func (a *app) handleSwitchWorkspaceMySQL(w http.ResponseWriter, r *http.Request, auth authContext) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req workspaceSwitchRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	workspaceID := strings.TrimSpace(req.WorkspaceID)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	account, found, err := mysqlAccountByID(ctx, a.db, auth.AccountID)
	if err != nil || !found || account.DisabledAt != "" {
		writeError(w, http.StatusUnauthorized, "account not found")
		return
	}
	workspace, found, err := mysqlWorkspaceVisibleToAccount(ctx, a.db, auth.AccountID, workspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load workspace failed")
		return
	}
	if !found {
		writeError(w, http.StatusForbidden, "workspace access denied")
		return
	}
	account.WorkspaceID = workspace.ID
	account.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	if _, err := a.db.ExecContext(ctx, `UPDATE accounts SET workspace_id = ?, updated_at = ? WHERE id = ?`, account.WorkspaceID, account.UpdatedAt, account.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	a.writeLoginResponse(w, "", account, workspace)
}

func (a *app) handleWorkspacesMySQL(w http.ResponseWriter, r *http.Request, auth authContext) {
	switch r.Method {
	case http.MethodGet:
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		if _, found, err := mysqlWorkspaceVisibleToAccount(ctx, a.db, auth.AccountID, auth.WorkspaceID); err != nil {
			writeError(w, http.StatusInternalServerError, "load workspace failed")
			return
		} else if !found {
			writeError(w, http.StatusForbidden, "workspace access denied")
			return
		}
		workspaces, err := mysqlWorkspaceSummariesForAccount(ctx, a.db, auth.AccountID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "load workspaces failed")
			return
		}
		memberships := []workspaceMembershipSummary{}
		seenMemberships := map[string]bool{}
		appendMembership := func(item workspaceMembershipSummary) {
			key := item.WorkspaceID + ":" + item.AccountID
			if seenMemberships[key] {
				return
			}
			seenMemberships[key] = true
			memberships = append(memberships, item)
		}
		for _, workspace := range workspaces {
			canManage, err := teamAccountCanManageWorkspace(ctx, a.db, auth, workspace.ID)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "load workspace members failed")
				return
			}
			if !canManage {
				item, found, err := mysqlMembershipSummaryByAccountAndWorkspace(ctx, a.db, auth.AccountID, workspace.ID)
				if err != nil {
					writeError(w, http.StatusInternalServerError, "load workspace members failed")
					return
				}
				if found {
					appendMembership(item)
				}
				continue
			}
			items, err := mysqlWorkspaceMembershipSummaries(ctx, a.db, workspace.ID)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "load workspace members failed")
				return
			}
			if workspace.Type == "private" {
				for _, item := range items {
					if item.AccountID == workspace.OwnerAccountID {
						appendMembership(item)
					}
				}
				continue
			}
			for _, item := range items {
				appendMembership(item)
			}
		}
		writeJSON(w, http.StatusOK, map[string]any{"workspaces": workspaces, "memberships": memberships})
	case http.MethodPost:
		var req workspaceCreateRequest
		if err := decodeJSON(w, r, &req); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		name := strings.TrimSpace(req.Name)
		if name == "" {
			writeError(w, http.StatusBadRequest, "workspace name is required")
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()
		account, found, err := mysqlAccountByID(ctx, a.db, auth.AccountID)
		if err != nil || !found || account.DisabledAt != "" {
			writeError(w, http.StatusUnauthorized, "account not found")
			return
		}
		tx, err := a.db.BeginTx(ctx, nil)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		defer mysqlRollback(tx)
		now := time.Now().UTC().Format(time.RFC3339)
		workspace := workspaceData{
			ID:             newID("workspace"),
			Name:           name,
			Type:           "shared",
			OwnerAccountID: account.ID,
			Rows:           map[string]syncRow{},
			CreatedAt:      now,
			UpdatedAt:      now,
		}
		if err := mysqlUpsertWorkspace(ctx, tx, workspace); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		if err := mysqlEnsureWorkspaceMembership(ctx, tx, workspace.ID, account.ID, "owner", "active", now); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		account.WorkspaceID = workspace.ID
		account.UpdatedAt = now
		if err := mysqlUpsertAccount(ctx, tx, account); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		if err := tx.Commit(); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		a.writeLoginResponse(w, "", account, workspace)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (a *app) handleWorkspaceByIDMySQL(w http.ResponseWriter, r *http.Request, auth authContext) {
	path := strings.Trim(strings.TrimPrefix(r.URL.Path, "/workspaces/"), "/")
	parts := strings.Split(path, "/")
	if len(parts) == 3 && parts[1] == "members" {
		a.handleWorkspaceMembershipByIDMySQL(w, r, auth, parts[0], parts[2])
		return
	}
	if len(parts) != 1 || parts[0] == "" {
		writeError(w, http.StatusBadRequest, "workspace id is required")
		return
	}
	if r.Method != http.MethodPatch {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	workspaceID := parts[0]
	var req workspaceUpdateRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		writeError(w, http.StatusBadRequest, "workspace name is required")
		return
	}
	workspaceType := strings.TrimSpace(req.Type)
	if workspaceType != "" && workspaceType != "private" && workspaceType != "shared" {
		writeError(w, http.StatusBadRequest, "workspace type must be private or shared")
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
	workspace, found, err := mysqlWorkspaceVisibleToAccount(ctx, tx, auth.AccountID, workspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if !found {
		writeError(w, http.StatusForbidden, "workspace access denied")
		return
	}
	if workspaceType == "" {
		workspaceType = fallback(workspace.Type, "shared")
	}
	if fallback(workspace.Type, "shared") == "private" && workspaceType != "private" {
		writeError(w, http.StatusBadRequest, "private workspace type cannot be changed")
		return
	}
	membership, found, err := mysqlActiveMembershipByAccountAndWorkspace(ctx, tx, auth.AccountID, workspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load workspace membership failed")
		return
	}
	if !found || (membership.Role != "owner" && membership.Role != "admin") {
		writeError(w, http.StatusForbidden, "workspace access denied")
		return
	}
	currentOwnerAccountID := workspace.OwnerAccountID
	if currentOwnerAccountID == "" {
		currentOwnerAccountID = auth.AccountID
	}
	ownerAccountID := strings.TrimSpace(req.OwnerAccountID)
	if ownerAccountID == "" {
		ownerAccountID = currentOwnerAccountID
	}
	if fallback(workspace.Type, "shared") == "private" && ownerAccountID != currentOwnerAccountID {
		writeError(w, http.StatusBadRequest, "private workspace owner cannot be changed")
		return
	}
	if workspaceType == "private" && ownerAccountID != auth.AccountID {
		writeError(w, http.StatusForbidden, "only workspace owner can make a workspace private")
		return
	}
	if ownerAccountID != currentOwnerAccountID {
		if membership.Role != "owner" {
			writeError(w, http.StatusForbidden, "only workspace owner can change workspace owner")
			return
		}
		if workspaceType == "private" {
			writeError(w, http.StatusBadRequest, "private workspace owner cannot be changed")
			return
		}
		if _, found, err := mysqlActiveMembershipByAccountAndWorkspace(ctx, tx, ownerAccountID, workspaceID); err != nil {
			writeError(w, http.StatusInternalServerError, "load workspace membership failed")
			return
		} else if !found {
			writeError(w, http.StatusBadRequest, "workspace owner must be an active workspace member")
			return
		}
	}
	now := time.Now().UTC().Format(time.RFC3339)
	workspace.Name = name
	workspace.Type = workspaceType
	workspace.OwnerAccountID = ownerAccountID
	workspace.UpdatedAt = now
	if err := mysqlUpsertWorkspace(ctx, tx, workspace); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if workspaceType == "private" {
		if err := mysqlSetWorkspaceOwner(ctx, tx, workspace.ID, workspace.OwnerAccountID, now); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		if err := mysqlRestrictWorkspaceToOwner(ctx, tx, workspace.ID, workspace.OwnerAccountID, now); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
	} else {
		if err := mysqlSetWorkspaceOwner(ctx, tx, workspace.ID, workspace.OwnerAccountID, now); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"workspace": publicWorkspace(workspace)})
}

func (a *app) handleWorkspaceMembershipByIDMySQL(w http.ResponseWriter, r *http.Request, auth authContext, workspaceID string, membershipID string) {
	if r.Method != http.MethodPatch {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if workspaceID == "" || membershipID == "" {
		writeError(w, http.StatusBadRequest, "workspace member id is required")
		return
	}
	var req workspaceMembershipUpdateRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	status := strings.TrimSpace(req.Status)
	if status != "active" && status != "disabled" {
		writeError(w, http.StatusBadRequest, "workspace member status must be active or disabled")
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

	workspace, foundWorkspace, err := mysqlWorkspaceVisibleToAccount(ctx, tx, auth.AccountID, workspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load workspace failed")
		return
	}
	if !foundWorkspace {
		writeError(w, http.StatusForbidden, "workspace access denied")
		return
	}
	currentMembership, foundCurrentMembership, err := mysqlActiveMembershipByAccountAndWorkspace(ctx, tx, auth.AccountID, workspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load workspace membership failed")
		return
	}
	if !foundCurrentMembership || (currentMembership.Role != "owner" && currentMembership.Role != "admin") {
		writeError(w, http.StatusForbidden, "workspace access denied")
		return
	}
	targetMembership, foundTargetMembership, err := mysqlWorkspaceMembershipSummaryByID(ctx, tx, workspaceID, membershipID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load workspace membership failed")
		return
	}
	if !foundTargetMembership {
		writeError(w, http.StatusNotFound, "workspace member not found")
		return
	}
	if status == "disabled" {
		if targetMembership.AccountID == auth.AccountID {
			writeError(w, http.StatusBadRequest, "cannot remove current account from workspace")
			return
		}
		if targetMembership.Role == "owner" || targetMembership.AccountID == workspace.OwnerAccountID {
			writeError(w, http.StatusBadRequest, "workspace owner cannot be removed")
			return
		}
	}
	now := time.Now().UTC().Format(time.RFC3339)
	if _, err := tx.ExecContext(
		ctx,
		`UPDATE workspace_memberships SET status = ?, updated_at = ? WHERE workspace_id = ? AND id = ?`,
		status,
		now,
		workspaceID,
		membershipID,
	); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if err := mysqlTouchWorkspace(ctx, tx, workspaceID, now); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	updatedMembership, foundUpdatedMembership, err := mysqlWorkspaceMembershipSummaryByID(ctx, a.db, workspaceID, membershipID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load workspace membership failed")
		return
	}
	if !foundUpdatedMembership {
		writeError(w, http.StatusNotFound, "workspace member not found")
		return
	}
	writeJSON(w, http.StatusOK, workspaceMembershipResponse{Membership: updatedMembership})
}

func (a *app) handleWorkspaceInvitations(w http.ResponseWriter, r *http.Request, auth authContext) {
	if a.db == nil {
		writeError(w, http.StatusNotImplemented, "workspace invitations require mysql backend")
		return
	}
	switch r.Method {
	case http.MethodGet:
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		invitations, err := mysqlWorkspaceInvitationSummariesForAccount(ctx, a.db, auth.AccountID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "load workspace invitations failed")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"invitations": invitations})
	case http.MethodPost:
		var req workspaceInvitationRequest
		if err := decodeJSON(w, r, &req); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		workspaceID := strings.TrimSpace(req.WorkspaceID)
		email := normalizeEmail(req.Email)
		if workspaceID == "" || email == "" {
			writeError(w, http.StatusBadRequest, "workspace_id and email are required")
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
		workspace, foundWorkspace, err := mysqlWorkspaceByID(ctx, tx, workspaceID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		if !foundWorkspace {
			writeError(w, http.StatusNotFound, "workspace not found")
			return
		}
		if fallback(workspace.Type, "shared") == "private" {
			writeError(w, http.StatusForbidden, "private workspace does not support invitations")
			return
		}
		canManage, err := teamAccountCanManageWorkspace(ctx, tx, auth, workspaceID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		if !canManage {
			writeError(w, http.StatusForbidden, "workspace access denied")
			return
		}
		account, foundAccount, err := mysqlAccountByEmail(ctx, tx, email)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		if !foundAccount {
			writeError(w, http.StatusNotFound, "account not found; create the platform account first")
			return
		}
		if account.DisabledAt != "" {
			writeError(w, http.StatusBadRequest, "account is disabled")
			return
		}
		if account.ID == auth.AccountID {
			writeError(w, http.StatusBadRequest, "cannot invite yourself")
			return
		}
		if _, alreadyMember, err := mysqlActiveMembershipByAccountAndWorkspace(ctx, tx, account.ID, workspaceID); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		} else if alreadyMember {
			writeError(w, http.StatusConflict, "account already belongs to this workspace")
			return
		}
		now := time.Now().UTC().Format(time.RFC3339)
		invitationID := newID("workspace_invitation")
		createdAt := now
		if existing, ok, err := mysqlPendingWorkspaceInvitation(ctx, tx, workspaceID, account.ID); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		} else if ok {
			invitationID = existing.ID
			createdAt = existing.CreatedAt
		}
		invitation := workspaceInvitationSummary{
			ID:               invitationID,
			WorkspaceID:      workspaceID,
			InviterAccountID: auth.AccountID,
			InviteeAccountID: account.ID,
			InviteeEmail:     account.Email,
			Status:           "pending",
			CreatedAt:        createdAt,
			UpdatedAt:        now,
		}
		if err := mysqlUpsertWorkspaceInvitation(ctx, tx, invitation); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		if err := tx.Commit(); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		saved, _, err := mysqlWorkspaceInvitationSummaryByID(ctx, a.db, invitationID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "load workspace invitation failed")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"invitation": saved})
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (a *app) handleWorkspaceInvitationByID(w http.ResponseWriter, r *http.Request, auth authContext) {
	if a.db == nil {
		writeError(w, http.StatusNotImplemented, "workspace invitations require mysql backend")
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	actionPath := strings.Trim(strings.TrimPrefix(r.URL.Path, "/workspace-invitations/"), "/")
	invitationID := strings.TrimSuffix(actionPath, "/accept")
	if invitationID == actionPath || strings.TrimSpace(invitationID) == "" {
		writeError(w, http.StatusBadRequest, "unsupported invitation action")
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
	invitation, found, err := mysqlWorkspaceInvitationSummaryByID(ctx, tx, invitationID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if !found {
		writeError(w, http.StatusNotFound, "workspace invitation not found")
		return
	}
	if invitation.InviteeAccountID != auth.AccountID {
		writeError(w, http.StatusForbidden, "workspace invitation access denied")
		return
	}
	if invitation.Status != "pending" {
		writeError(w, http.StatusConflict, "workspace invitation is not pending")
		return
	}
	account, foundAccount, err := mysqlAccountByID(ctx, tx, auth.AccountID)
	if err != nil || !foundAccount || account.DisabledAt != "" {
		writeError(w, http.StatusUnauthorized, "account not found")
		return
	}
	workspace, foundWorkspace, err := mysqlWorkspaceByID(ctx, tx, invitation.WorkspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if !foundWorkspace || fallback(workspace.Type, "shared") == "private" {
		writeError(w, http.StatusNotFound, "workspace not found")
		return
	}
	now := time.Now().UTC().Format(time.RFC3339)
	if err := mysqlEnsureWorkspaceMembership(ctx, tx, invitation.WorkspaceID, auth.AccountID, "member", "active", now); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if _, err := tx.ExecContext(
		ctx,
		`UPDATE workspace_invitations SET status = 'accepted', accepted_at = ?, updated_at = ? WHERE id = ?`,
		now,
		now,
		invitation.ID,
	); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if err := mysqlTouchWorkspace(ctx, tx, invitation.WorkspaceID, now); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	accepted, _, err := mysqlWorkspaceInvitationSummaryByID(ctx, a.db, invitationID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load workspace invitation failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"invitation": accepted})
}

func (a *app) handleProjectInvitations(w http.ResponseWriter, r *http.Request, auth authContext) {
	if a.db == nil {
		writeError(w, http.StatusNotImplemented, "project invitations require mysql backend")
		return
	}
	switch r.Method {
	case http.MethodGet:
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		invitations, err := mysqlProjectInvitationSummariesForAccount(ctx, a.db, auth.AccountID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "load project invitations failed")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"invitations": invitations})
	case http.MethodPost:
		var req projectInvitationRequest
		if err := decodeJSON(w, r, &req); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		projectID := strings.TrimSpace(req.ProjectID)
		workspaceID := strings.TrimSpace(req.WorkspaceID)
		email := normalizeEmail(req.Email)
		if projectID == "" || email == "" {
			writeError(w, http.StatusBadRequest, "project_id and email are required")
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
		projectRow, foundProject, err := mysqlProjectRowByID(ctx, tx, workspaceID, projectID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		if !foundProject {
			writeError(w, http.StatusNotFound, "project not found")
			return
		}
		targetWorkspaceID := projectRow.WorkspaceID
		workspace, foundWorkspace, err := mysqlWorkspaceByID(ctx, tx, targetWorkspaceID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		if !foundWorkspace {
			writeError(w, http.StatusNotFound, "workspace not found")
			return
		}
		if fallback(workspace.Type, "shared") == "private" {
			writeError(w, http.StatusForbidden, "private workspace does not support project invitations")
			return
		}
		canManageWorkspace, err := teamAccountCanManageWorkspace(ctx, tx, auth, targetWorkspaceID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		if !canManageWorkspace {
			canManageProject, err := teamAccountCanManageProjectMembers(ctx, tx, targetWorkspaceID, auth.AccountID, projectID)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "save failed")
				return
			}
			if !canManageProject {
				writeError(w, http.StatusForbidden, "project access denied")
				return
			}
		}
		account, foundAccount, err := mysqlAccountByEmail(ctx, tx, email)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		if !foundAccount {
			writeError(w, http.StatusNotFound, "account not found; create the platform account first")
			return
		}
		if account.DisabledAt != "" {
			writeError(w, http.StatusBadRequest, "account is disabled")
			return
		}
		if account.ID == auth.AccountID {
			writeError(w, http.StatusBadRequest, "cannot invite yourself")
			return
		}
		if alreadyMember, err := teamAccountCanAccessProject(ctx, tx, targetWorkspaceID, account.ID, projectID); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		} else if alreadyMember {
			writeError(w, http.StatusConflict, "account already belongs to this project")
			return
		}
		now := time.Now().UTC().Format(time.RFC3339)
		invitationID := newID("project_invitation")
		createdAt := now
		if existing, ok, err := mysqlPendingProjectInvitation(ctx, tx, targetWorkspaceID, projectID, account.ID); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		} else if ok {
			invitationID = existing.ID
			createdAt = existing.CreatedAt
		}
		invitation := projectInvitationSummary{
			ID:               invitationID,
			WorkspaceID:      targetWorkspaceID,
			ProjectID:        projectID,
			InviterAccountID: auth.AccountID,
			InviteeAccountID: account.ID,
			InviteeEmail:     account.Email,
			Roles:            normalizeRoles(req.Roles),
			Status:           "pending",
			CreatedAt:        createdAt,
			UpdatedAt:        now,
		}
		if err := mysqlUpsertProjectInvitation(ctx, tx, invitation); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		if err := tx.Commit(); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		saved, _, err := mysqlProjectInvitationSummaryByID(ctx, a.db, invitationID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "load project invitation failed")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"invitation": saved})
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (a *app) handleProjectInvitationByID(w http.ResponseWriter, r *http.Request, auth authContext) {
	if a.db == nil {
		writeError(w, http.StatusNotImplemented, "project invitations require mysql backend")
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	actionPath := strings.Trim(strings.TrimPrefix(r.URL.Path, "/project-invitations/"), "/")
	invitationID := strings.TrimSuffix(actionPath, "/accept")
	if invitationID == actionPath || strings.TrimSpace(invitationID) == "" {
		writeError(w, http.StatusBadRequest, "unsupported invitation action")
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
	invitation, found, err := mysqlProjectInvitationSummaryByID(ctx, tx, invitationID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if !found {
		writeError(w, http.StatusNotFound, "project invitation not found")
		return
	}
	if invitation.InviteeAccountID != auth.AccountID {
		writeError(w, http.StatusForbidden, "project invitation access denied")
		return
	}
	if invitation.Status != "pending" {
		writeError(w, http.StatusConflict, "project invitation is not pending")
		return
	}
	account, foundAccount, err := mysqlAccountByID(ctx, tx, auth.AccountID)
	if err != nil || !foundAccount || account.DisabledAt != "" {
		writeError(w, http.StatusUnauthorized, "account not found")
		return
	}
	if _, err := mysqlEnsurePrivateWorkspaceForAccount(ctx, tx, account, time.Now().UTC().Format(time.RFC3339)); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	projectRow, foundProject, err := mysqlProjectRowByID(ctx, tx, invitation.WorkspaceID, invitation.ProjectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if !foundProject {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}
	workspace, foundWorkspace, err := mysqlWorkspaceByID(ctx, tx, projectRow.WorkspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if !foundWorkspace || fallback(workspace.Type, "shared") == "private" {
		writeError(w, http.StatusNotFound, "workspace not found")
		return
	}
	now := time.Now().UTC().Format(time.RFC3339)
	nextRevision, err := mysqlNextRevisionForUpdate(ctx, tx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	lastRevision := int64(0)
	alreadyMember, err := teamAccountCanAccessProject(ctx, tx, invitation.WorkspaceID, auth.AccountID, invitation.ProjectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if !alreadyMember {
		memberID := "member_" + invitation.ProjectID + "_" + account.ID
		rows, err := mysqlLoadRowsByKeys(ctx, tx, invitation.WorkspaceID, []syncRowKey{
			{entity: "project_member", id: memberID},
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		if existingProjectMemberRow, exists := rows[key("project_member", memberID)]; exists && existingProjectMemberRow.DeletedAt == "" {
			var existingProjectMemberPayload map[string]any
			if err := json.Unmarshal(existingProjectMemberRow.Payload, &existingProjectMemberPayload); err != nil {
				writeError(w, http.StatusInternalServerError, "save failed")
				return
			}
			status, _ := existingProjectMemberPayload["status"].(string)
			if !strings.EqualFold(strings.TrimSpace(status), "disabled") {
				alreadyMember = true
			}
		}
		if !alreadyMember {
			projectMemberRow := makeProjectMemberRow(auth, account, invitation.WorkspaceID, invitation.ProjectID, memberID, account.Name, invitation.Roles, "active", now, nextRevision)
			nextRevision++
			lastRevision = projectMemberRow.Revision
			if err := mysqlUpsertSyncRow(ctx, tx, projectMemberRow); err != nil {
				writeError(w, http.StatusInternalServerError, "save failed")
				return
			}
			if err := teamUpsertRow(ctx, tx, projectMemberRow); err != nil {
				writeError(w, http.StatusInternalServerError, "save failed")
				return
			}
			if err := mysqlTouchWorkspace(ctx, tx, invitation.WorkspaceID, now); err != nil {
				writeError(w, http.StatusInternalServerError, "save failed")
				return
			}
		}
	}
	if _, err := tx.ExecContext(
		ctx,
		`UPDATE project_invitations SET status = 'accepted', accepted_at = ?, updated_at = ? WHERE id = ?`,
		now,
		now,
		invitation.ID,
	); err != nil {
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
	if lastRevision > 0 {
		a.notifyWorkspaceChanged(invitation.WorkspaceID, lastRevision, "server")
	}
	accepted, _, err := mysqlProjectInvitationSummaryByID(ctx, a.db, invitationID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load project invitation failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"invitation": accepted})
}

func (a *app) handleMeMySQL(w http.ResponseWriter, r *http.Request, auth authContext) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	account, found, err := mysqlAccountByID(ctx, a.db, auth.AccountID)
	if err != nil || !found {
		writeError(w, http.StatusUnauthorized, "account not found")
		return
	}
	workspace, found, err := mysqlWorkspaceVisibleToAccount(ctx, a.db, account.ID, auth.WorkspaceID)
	if err != nil || !found {
		writeError(w, http.StatusUnauthorized, "workspace access denied")
		return
	}
	publicAccount := account
	publicAccount.PasswordHash = ""
	membership, found, err := mysqlMembershipSummaryByAccountAndWorkspace(ctx, a.db, account.ID, workspace.ID)
	if err != nil || !found {
		writeError(w, http.StatusUnauthorized, "workspace access denied")
		return
	}
	workspaces, err := mysqlWorkspaceSummariesForAccount(ctx, a.db, account.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load workspaces failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"account":    publicAccount,
		"workspace":  publicWorkspace(workspace),
		"membership": membership,
		"workspaces": workspaces,
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
		workspace = workspaceData{ID: auth.WorkspaceID, Name: "默认团队", Type: "shared", Rows: map[string]syncRow{}, CreatedAt: now, UpdatedAt: now}
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
			if err := teamUpsertRow(ctx, tx, row); err != nil {
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
	targetWorkspaceID := strings.TrimSpace(req.WorkspaceID)
	if targetWorkspaceID == "" {
		targetWorkspaceID = auth.WorkspaceID
	}
	projectID := strings.TrimSpace(req.ProjectID)
	email := normalizeEmail(req.Email)
	if email == "" {
		writeError(w, http.StatusBadRequest, "email is required")
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
	targetWorkspace, foundWorkspace, err := mysqlWorkspaceByID(ctx, tx, targetWorkspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if !foundWorkspace {
		writeError(w, http.StatusNotFound, "workspace not found")
		return
	}
	if fallback(targetWorkspace.Type, "shared") == "private" {
		writeError(w, http.StatusForbidden, "private workspace does not support members")
		return
	}
	canManageWorkspace, err := teamAccountCanManageWorkspace(ctx, tx, auth, targetWorkspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if projectID == "" {
		if !canManageWorkspace {
			writeError(w, http.StatusForbidden, "workspace access denied")
			return
		}
	} else if !canManageWorkspace {
		canManageProject, err := teamAccountCanManageProjectMembers(ctx, tx, targetWorkspaceID, auth.AccountID, projectID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		if !canManageProject {
			writeError(w, http.StatusForbidden, "workspace access denied")
			return
		}
	}
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
	if !found && strings.TrimSpace(req.Password) == "" {
		writeError(w, http.StatusBadRequest, "password is required for a new account")
		return
	}
	now := time.Now().UTC().Format(time.RFC3339)
	if !found {
		hash, err := hashPassword(req.Password)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "password hashing failed")
			return
		}
		accountID := newID("account")
		accountWorkspaceID := targetWorkspaceID
		if projectID != "" {
			accountWorkspaceID = privateWorkspaceID(accountID)
		}
		account = accountRecord{ID: accountID, WorkspaceID: accountWorkspaceID, Name: fallback(strings.TrimSpace(req.Name), email), Email: email, PasswordHash: hash, CreatedAt: now, UpdatedAt: now}
		if err := mysqlUpsertAccount(ctx, tx, account); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		if _, err := mysqlEnsurePrivateWorkspaceForAccount(ctx, tx, account, now); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
	} else {
		account.Name = fallback(strings.TrimSpace(req.Name), account.Name)
		account.Email = email
		account.DisabledAt = ""
		account.UpdatedAt = now
		if strings.TrimSpace(req.Password) != "" && projectID == "" {
			hash, err := hashPassword(req.Password)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "password hashing failed")
				return
			}
			account.PasswordHash = hash
		}
		if err := mysqlUpsertAccount(ctx, tx, account); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		if _, err := mysqlEnsurePrivateWorkspaceForAccount(ctx, tx, account, now); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
	}
	status := fallback(strings.TrimSpace(req.Status), "active")
	if projectID == "" {
		if err := mysqlEnsureWorkspaceMembership(ctx, tx, targetWorkspaceID, account.ID, "member", status, now); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
	}

	memberID := "member_" + projectID + "_" + account.ID
	keys := []syncRowKey{}
	if projectID != "" {
		keys = append(keys, syncRowKey{entity: "project_member", id: memberID})
	}
	rows, err := mysqlLoadRowsByKeys(ctx, tx, targetWorkspaceID, keys)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if projectID == "" {
		if err := mysqlTouchWorkspace(ctx, tx, targetWorkspaceID, now); err != nil {
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
		writeJSON(w, http.StatusOK, memberResponse{Account: account})
		return
	}
	existingProjectMemberRow, projectMemberExists := rows[key("project_member", memberID)]
	projectMemberCanRecreate := true
	if projectMemberExists {
		projectMemberCanRecreate = existingProjectMemberRow.DeletedAt != ""
		if !projectMemberCanRecreate {
			var existingProjectMemberPayload map[string]any
			if err := json.Unmarshal(existingProjectMemberRow.Payload, &existingProjectMemberPayload); err == nil {
				if status, ok := existingProjectMemberPayload["status"].(string); ok {
					projectMemberCanRecreate = strings.EqualFold(strings.TrimSpace(status), "disabled")
				}
			}
		}
	}
	if projectMemberExists && !projectMemberCanRecreate {
		writeError(w, http.StatusConflict, "account already belongs to this project")
		return
	}
	row := makeProjectMemberRow(auth, account, targetWorkspaceID, projectID, memberID, req.Name, req.Roles, req.Status, now, nextRevision)
	nextRevision++
	if err := mysqlUpsertSyncRow(ctx, tx, row); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if err := teamUpsertRow(ctx, tx, row); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if err := mysqlTouchWorkspace(ctx, tx, targetWorkspaceID, now); err != nil {
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
	a.notifyWorkspaceChanged(targetWorkspaceID, row.Revision, "server")
	writeJSON(w, http.StatusOK, memberResponse{Account: account, Member: row})
}

func makeProjectMemberRow(auth authContext, account accountRecord, workspaceID string, projectID string, memberID string, name string, roles []string, status string, now string, revision int64) syncRow {
	payload, _ := json.Marshal(map[string]any{
		"id":          memberID,
		"workspaceId": workspaceID,
		"projectId":   projectID,
		"accountId":   account.ID,
		"name":        fallback(strings.TrimSpace(name), account.Name),
		"email":       account.Email,
		"roles":       normalizeRoles(roles),
		"status":      fallback(strings.TrimSpace(status), "active"),
		"createdAt":   now,
		"updatedAt":   now,
	})
	return syncRow{UserID: auth.AccountID, AccountID: auth.AccountID, WorkspaceID: workspaceID, Entity: "project_member", ID: memberID, DeviceID: "server", UpdatedAt: now, Version: 1, Revision: revision, Payload: payload}
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
	targetWorkspaceID := strings.TrimSpace(req.WorkspaceID)
	if targetWorkspaceID == "" {
		targetWorkspaceID = auth.WorkspaceID
	}
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	tx, err := a.db.BeginTx(ctx, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	defer mysqlRollback(tx)
	targetWorkspace, foundWorkspace, err := mysqlWorkspaceByID(ctx, tx, targetWorkspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if !foundWorkspace {
		writeError(w, http.StatusNotFound, "workspace not found")
		return
	}
	if fallback(targetWorkspace.Type, "shared") == "private" {
		writeError(w, http.StatusForbidden, "private workspace does not support members")
		return
	}
	canManageWorkspace, err := teamAccountCanManageWorkspace(ctx, tx, auth, targetWorkspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if !canManageWorkspace {
		writeError(w, http.StatusForbidden, "workspace access denied")
		return
	}
	nextRevision, err := mysqlNextRevisionForUpdate(ctx, tx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	existing, found, err := mysqlMemberRow(ctx, tx, targetWorkspaceID, memberID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
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
		payload["email"] = normalizeEmail(req.Email)
	}
	if len(req.Roles) > 0 {
		payload["roles"] = normalizeRoles(req.Roles)
	}
	if strings.TrimSpace(req.Status) != "" {
		payload["status"] = strings.TrimSpace(req.Status)
	}
	if strings.TrimSpace(req.Password) != "" {
		accountID, _ := payload["accountId"].(string)
		if accountID == "" {
			writeError(w, http.StatusBadRequest, "member account is required to update password")
			return
		}
		account, ok, err := mysqlAccountByID(ctx, tx, accountID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
		if !ok {
			writeError(w, http.StatusNotFound, "member account not found")
			return
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
		if _, err := mysqlEnsurePrivateWorkspaceForAccount(ctx, tx, account, now); err != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return
		}
	}
	payload["workspaceId"] = targetWorkspaceID
	payload["updatedAt"] = now
	bytes, _ := json.Marshal(payload)
	existing.UserID = auth.AccountID
	existing.AccountID = auth.AccountID
	existing.WorkspaceID = targetWorkspaceID
	existing.DeviceID = "server"
	existing.UpdatedAt = now
	existing.Revision = nextRevision
	existing.Payload = bytes
	nextRevision++
	if err := mysqlUpsertSyncRow(ctx, tx, existing); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if err := teamUpsertRow(ctx, tx, existing); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if err := mysqlTouchWorkspace(ctx, tx, targetWorkspaceID, now); err != nil {
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
	a.notifyWorkspaceChanged(targetWorkspaceID, existing.Revision, "server")
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
