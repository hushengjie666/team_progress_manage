package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
)

func writeBusinessCore(ctx context.Context, tx *sql.Tx, row businessRow) error {
	spec, ok := relationalEntities[row.Entity]
	if !ok {
		return fmt.Errorf("unsupported core entity %q", row.Entity)
	}
	var object map[string]json.RawMessage
	if err := json.Unmarshal(row.Payload, &object); err != nil || object == nil {
		return fmt.Errorf("business payload must be an object")
	}
	table, _ := businessTableForEntity(row.Entity)
	assignments, args := []string{}, []any{}
	for _, path := range relationalPaths(spec.Fields) {
		value, err := relationalArgument(relationalRawPath(object, path), spec.Fields[path])
		if err != nil {
			return fmt.Errorf("%s.%s: %w", row.Entity, path, err)
		}
		assignments = append(assignments, relationalColumn(path)+" = ?")
		args = append(args, value)
	}
	for _, field := range spec.Objects {
		raw := object[field]
		present := len(raw) > 0 && string(raw) != "null"
		var child map[string]json.RawMessage
		if present && (json.Unmarshal(raw, &child) != nil || child == nil) {
			return fmt.Errorf("%s must be an object", field)
		}
		assignments = append(assignments, relationalColumn(field)+"_present = ?")
		args = append(args, present)
	}
	for _, relation := range spec.Relations {
		raw := object[relation.Field]
		present := len(raw) > 0 && string(raw) != "null"
		var items []json.RawMessage
		if present && json.Unmarshal(raw, &items) != nil {
			return fmt.Errorf("%s must be an array", relation.Field)
		}
		assignments = append(assignments, relationalColumn(relation.Field)+"_present = ?")
		args = append(args, present)
		if err := writeBusinessRelation(ctx, tx, row, relation, items); err != nil {
			return err
		}
	}
	args = append(args, row.WorkspaceID, row.ID)
	_, err := tx.ExecContext(ctx, "UPDATE "+table.table+" SET "+strings.Join(assignments, ",")+" WHERE workspace_id = ? AND id = ?", args...)
	return err
}

func writeBusinessRelation(ctx context.Context, tx *sql.Tx, row businessRow, spec relationalRelation, items []json.RawMessage) error {
	if _, err := tx.ExecContext(ctx, "DELETE FROM "+spec.Table+" WHERE workspace_id = ? AND parent_id = ?", row.WorkspaceID, row.ID); err != nil {
		return err
	}
	if len(items) == 0 {
		return nil
	}
	columns := []string{"workspace_id", "parent_id", "position", "snapshot"}
	paths := relationalPaths(spec.Fields)
	for _, path := range paths {
		columns = append(columns, relationalColumn(path))
	}
	query := "INSERT INTO " + spec.Table + " (" + strings.Join(columns, ",") + ") VALUES (" + teamPlaceholders(len(columns)) + ")"
	statement, err := tx.PrepareContext(ctx, query)
	if err != nil {
		return err
	}
	defer statement.Close()
	for position, item := range items {
		object := map[string]json.RawMessage{"value": item}
		if spec.Object {
			if err := json.Unmarshal(item, &object); err != nil || object == nil {
				return fmt.Errorf("%s item must be an object", spec.Field)
			}
		}
		args := []any{row.WorkspaceID, row.ID, position, []byte(item)}
		for _, path := range paths {
			value, err := relationalArgument(object[path], spec.Fields[path])
			if err != nil {
				return fmt.Errorf("%s[%d].%s: %w", spec.Field, position, path, err)
			}
			if !spec.Object && value == nil {
				return fmt.Errorf("%s item cannot be null", spec.Field)
			}
			args = append(args, value)
		}
		if _, err := statement.ExecContext(ctx, args...); err != nil {
			return err
		}
	}
	return nil
}
