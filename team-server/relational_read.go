package main

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
)

func relationPayloadSQL(spec relationalRelation) string {
	if !spec.Object {
		return "JSON_EXTRACT(JSON_ARRAY(" + relationalColumn("value") + "), '$[0]')"
	}
	pairs := []string{}
	for _, path := range relationalPaths(spec.Fields) {
		pairs = append(pairs, "'"+path+"'", relationalValueSQL(relationalColumn(path), spec.Fields[path]))
	}
	return "JSON_MERGE_PATCH(snapshot, JSON_OBJECT(" + strings.Join(pairs, ",") + "))"
}

func loadBusinessRelations(ctx context.Context, q sqlRunner, rows []businessRow, lock bool) error {
	for _, entity := range businessEntityTables {
		indices := []int{}
		for index := range rows {
			if rows[index].Entity == entity.entity {
				indices = append(indices, index)
			}
		}
		for _, relation := range relationalEntities[entity.entity].Relations {
			for start := 0; start < len(indices); start += 200 {
				end := start + 200
				if end > len(indices) {
					end = len(indices)
				}
				if err := loadBusinessRelationBatch(ctx, q, rows, indices[start:end], relation, lock); err != nil {
					return err
				}
			}
		}
	}
	return nil
}
func loadBusinessRelationBatch(ctx context.Context, q sqlRunner, rows []businessRow, indices []int, spec relationalRelation, lock bool) error {
	objects := map[string]map[string]json.RawMessage{}
	positions := map[string]int{}
	placeholders, args := []string{}, []any{}
	for _, index := range indices {
		row := rows[index]
		var object map[string]json.RawMessage
		if err := json.Unmarshal(row.Payload, &object); err != nil {
			return err
		}
		// The presence flag in core columns is authoritative even if a stale child exists.
		if _, present := object[spec.Field]; !present {
			continue
		}
		key := row.WorkspaceID + "\x00" + row.ID
		objects[key], positions[key] = object, index
		placeholders = append(placeholders, "(?,?)")
		args = append(args, row.WorkspaceID, row.ID)
	}
	if len(args) == 0 {
		return nil
	}
	query := "SELECT workspace_id,parent_id," + relationPayloadSQL(spec) + " FROM " + spec.Table + " WHERE (workspace_id,parent_id) IN (" + strings.Join(placeholders, ",") + ") ORDER BY workspace_id,parent_id,position"
	if lock {
		query += " FOR UPDATE"
	}
	cursor, err := q.QueryContext(ctx, query, args...)
	if err != nil {
		return err
	}
	defer cursor.Close()
	values := map[string][]json.RawMessage{}
	for cursor.Next() {
		var workspace, id string
		var raw json.RawMessage
		if err := cursor.Scan(&workspace, &id, &raw); err != nil {
			return err
		}
		key := workspace + "\x00" + id
		if _, found := objects[key]; !found {
			return fmt.Errorf("unexpected relation owner")
		}
		values[key] = append(values[key], raw)
	}
	if err := cursor.Err(); err != nil {
		return err
	}
	for key, object := range objects {
		items := values[key]
		if items == nil {
			items = []json.RawMessage{}
		}
		raw, err := json.Marshal(items)
		if err != nil {
			return err
		}
		object[spec.Field] = raw
		rows[positions[key]].Payload, err = json.Marshal(object)
		if err != nil {
			return err
		}
	}
	return nil
}
