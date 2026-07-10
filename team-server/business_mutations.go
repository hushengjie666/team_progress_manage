package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
)

type businessMutationFailure struct {
	status  int
	message string
}

func applyBusinessOperation(ctx context.Context, tx *sql.Tx, auth authContext, operation businessOperation) businessMutationFailure {
	kind := strings.TrimSpace(operation.Operation)
	if kind == "create" {
		return applyBusinessCreate(ctx, tx, auth, operation)
	}
	if kind != "patch" && kind != "delete" {
		return businessMutationFailure{status: http.StatusBadRequest, message: "unsupported business operation"}
	}
	workspaceID := strings.TrimSpace(operation.WorkspaceID)
	entity := strings.TrimSpace(operation.Entity)
	id := strings.TrimSpace(operation.ID)
	if workspaceID == "" || entity == "" || id == "" || operation.ExpectedRevision <= 0 {
		return businessMutationFailure{status: http.StatusBadRequest, message: "business operation key and expected revision are required"}
	}
	current, found, err := businessExistingRowForUpdate(ctx, tx, workspaceID, entity, id)
	if err != nil {
		return businessMutationFailure{status: http.StatusInternalServerError, message: "save failed"}
	}
	if !found || current.Revision != operation.ExpectedRevision {
		return businessMutationFailure{status: http.StatusConflict, message: "revision_conflict"}
	}
	if kind == "delete" {
		allowed, err := businessRowMutationAllowed(ctx, tx, auth, current, current, true)
		if err != nil {
			return businessMutationFailure{status: http.StatusInternalServerError, message: "save failed"}
		}
		if !allowed {
			return businessMutationFailure{status: http.StatusForbidden, message: "business row write denied"}
		}
		deleted, err := businessDeleteRowAtRevision(ctx, tx, current, operation.ExpectedRevision)
		if err != nil {
			return businessMutationFailure{status: http.StatusInternalServerError, message: "save failed"}
		}
		if !deleted {
			return businessMutationFailure{status: http.StatusConflict, message: "revision_conflict"}
		}
		return businessMutationFailure{}
	}
	if !json.Valid(operation.Patch) {
		return businessMutationFailure{status: http.StatusBadRequest, message: "business patch must be valid json"}
	}
	payload, err := applyBusinessMergePatch(current.Payload, operation.Patch)
	if err != nil {
		return businessMutationFailure{status: http.StatusBadRequest, message: "business patch must be a json object"}
	}
	next := current
	next.Payload = businessPayloadWithWorkspaceID(entity, payload, workspaceID)
	next.UpdatedAt = strings.TrimSpace(operation.UpdatedAt)
	if next.UpdatedAt == "" {
		next.UpdatedAt = time.Now().UTC().Format(time.RFC3339Nano)
	}
	allowed, err := businessRowMutationAllowed(ctx, tx, auth, current, next, false)
	if err != nil {
		return businessMutationFailure{status: http.StatusInternalServerError, message: "save failed"}
	}
	if !allowed {
		return businessMutationFailure{status: http.StatusForbidden, message: "business row write denied"}
	}
	updated, err := businessUpdateRowAtRevision(ctx, tx, next, operation.ExpectedRevision)
	if err != nil {
		return businessMutationFailure{status: http.StatusInternalServerError, message: "save failed"}
	}
	if !updated {
		return businessMutationFailure{status: http.StatusConflict, message: "revision_conflict"}
	}
	return businessMutationFailure{}
}

func applyBusinessCreate(ctx context.Context, tx *sql.Tx, auth authContext, operation businessOperation) businessMutationFailure {
	if operation.Row == nil {
		return businessMutationFailure{status: http.StatusBadRequest, message: "business create row is required"}
	}
	row := *operation.Row
	row.WorkspaceID = businessWorkspaceIDForRow(auth, row)
	row.Entity = strings.TrimSpace(row.Entity)
	row.ID = strings.TrimSpace(row.ID)
	if row.WorkspaceID == "" || row.Entity == "" || row.ID == "" {
		return businessMutationFailure{status: http.StatusBadRequest, message: "business row key is required"}
	}
	if _, ok := businessTableForEntity(row.Entity); !ok || !json.Valid(row.Payload) {
		return businessMutationFailure{status: http.StatusBadRequest, message: "invalid business row"}
	}
	if _, found, err := businessExistingRowForUpdate(ctx, tx, row.WorkspaceID, row.Entity, row.ID); err != nil {
		return businessMutationFailure{status: http.StatusInternalServerError, message: "save failed"}
	} else if found {
		return businessMutationFailure{status: http.StatusConflict, message: "revision_conflict"}
	}
	row.AccountID = auth.AccountID
	row.Revision = 1
	row.UpdatedAt = strings.TrimSpace(row.UpdatedAt)
	if row.UpdatedAt == "" {
		row.UpdatedAt = time.Now().UTC().Format(time.RFC3339Nano)
	}
	row.Payload = businessPayloadWithWorkspaceID(row.Entity, row.Payload, row.WorkspaceID)
	allowed, err := businessRowMutationAllowed(ctx, tx, auth, businessRow{}, row, false)
	if err != nil {
		return businessMutationFailure{status: http.StatusInternalServerError, message: "save failed"}
	}
	if !allowed {
		return businessMutationFailure{status: http.StatusForbidden, message: "business row write denied"}
	}
	if err := businessCreateRow(ctx, tx, row); err != nil {
		return businessCreateFailure(err)
	}
	return businessMutationFailure{}
}

func businessCreateFailure(err error) businessMutationFailure {
	var mysqlError *mysql.MySQLError
	if errors.As(err, &mysqlError) && mysqlError.Number == 1062 {
		return businessMutationFailure{status: http.StatusConflict, message: "revision_conflict"}
	}
	return businessMutationFailure{status: http.StatusInternalServerError, message: "save failed"}
}

func businessExistingRowForUpdate(ctx context.Context, tx *sql.Tx, workspaceID string, entity string, id string) (businessRow, bool, error) {
	spec, ok := businessTableForEntity(entity)
	if !ok {
		return businessRow{}, false, nil
	}
	var row businessRow
	var accountID sql.NullString
	err := tx.QueryRowContext(ctx, `SELECT workspace_id, id, account_id, updated_at, row_version, payload FROM `+spec.table+` WHERE workspace_id = ? AND id = ? FOR UPDATE`, workspaceID, id).
		Scan(&row.WorkspaceID, &row.ID, &accountID, &row.UpdatedAt, &row.Revision, &row.Payload)
	if errors.Is(err, sql.ErrNoRows) {
		return businessRow{}, false, nil
	}
	if err != nil {
		return businessRow{}, false, err
	}
	row.Entity = entity
	if accountID.Valid {
		row.AccountID = accountID.String
	}
	return row, true, nil
}

func applyBusinessMergePatch(document json.RawMessage, patch json.RawMessage) (json.RawMessage, error) {
	var current map[string]any
	var changes map[string]any
	if json.Unmarshal(document, &current) != nil || json.Unmarshal(patch, &changes) != nil {
		return nil, errors.New("json object required")
	}
	mergeBusinessObject(current, changes)
	return json.Marshal(current)
}

func mergeBusinessObject(current map[string]any, changes map[string]any) {
	for key, value := range changes {
		if value == nil {
			delete(current, key)
			continue
		}
		changeObject, changeIsObject := value.(map[string]any)
		currentObject, currentIsObject := current[key].(map[string]any)
		if changeIsObject && currentIsObject {
			mergeBusinessObject(currentObject, changeObject)
			continue
		}
		current[key] = value
	}
}
