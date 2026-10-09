package main

import (
	"bytes"
	"embed"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"unicode"
)

//go:embed relational-schema.json
var relationalSchemaFS embed.FS

type relationalEntity struct {
	Fields    map[string]string    `json:"fields"`
	Objects   []string             `json:"objects"`
	Relations []relationalRelation `json:"relations"`
}
type relationalRelation struct {
	Field  string            `json:"field"`
	Table  string            `json:"table"`
	Fields map[string]string `json:"fields"`
	Object bool              `json:"object"`
}

var relationalEntities = loadRelationalSchema()

func loadRelationalSchema() map[string]relationalEntity {
	raw, err := relationalSchemaFS.ReadFile("relational-schema.json")
	if err != nil {
		panic(err)
	}
	var result map[string]relationalEntity
	if err := json.Unmarshal(raw, &result); err != nil {
		panic(err)
	}
	return result
}
func relationalColumn(path string) string {
	var result strings.Builder
	result.WriteString("core_")
	for _, ch := range path {
		if ch == '.' {
			result.WriteByte('_')
		} else if unicode.IsUpper(ch) {
			result.WriteByte('_')
			result.WriteRune(unicode.ToLower(ch))
		} else {
			result.WriteRune(ch)
		}
	}
	return result.String()
}
func relationalPaths(fields map[string]string) []string {
	paths := make([]string, 0, len(fields))
	for path := range fields {
		paths = append(paths, path)
	}
	sort.Strings(paths)
	return paths
}
func relationalValueSQL(column, kind string) string {
	if kind == "boolean" {
		return "IF(" + column + " IS NULL, NULL, JSON_EXTRACT(IF(" + column + ", 'true', 'false'), '$'))"
	}
	return column
}

// Core columns are authoritative; the API snapshot retains extension fields.
func businessCorePayloadSQL(entity, prefix string) string {
	spec := relationalEntities[entity]
	pairs := []string{}
	for _, path := range relationalPaths(spec.Fields) {
		if strings.Contains(path, ".") {
			continue
		}
		pairs = append(pairs, "'"+path+"'", relationalValueSQL(prefix+relationalColumn(path), spec.Fields[path]))
	}
	for _, object := range spec.Objects {
		children := []string{}
		for _, path := range relationalPaths(spec.Fields) {
			if strings.HasPrefix(path, object+".") {
				children = append(children, "'"+strings.TrimPrefix(path, object+".")+"'", relationalValueSQL(prefix+relationalColumn(path), spec.Fields[path]))
			}
		}
		pairs = append(pairs, "'"+object+"'", "IF("+prefix+relationalColumn(object)+"_present, JSON_OBJECT("+strings.Join(children, ",")+"), NULL)")
	}
	for _, relation := range spec.Relations {
		pairs = append(pairs, "'"+relation.Field+"'", "IF("+prefix+relationalColumn(relation.Field)+"_present, JSON_ARRAY(), NULL)")
	}
	return "JSON_MERGE_PATCH(" + prefix + "payload, JSON_OBJECT(" + strings.Join(pairs, ",") + "))"
}

func relationalArgument(raw json.RawMessage, kind string) (any, error) {
	raw = bytes.TrimSpace(raw)
	if len(raw) == 0 || string(raw) == "null" {
		return nil, nil
	}
	switch kind {
	case "text":
		var value string
		if err := json.Unmarshal(raw, &value); err != nil {
			return nil, err
		}
		return value, nil
	case "number":
		var value json.Number
		if err := json.Unmarshal(raw, &value); err != nil {
			return nil, err
		}
		// Reject strings accepted by json.Number.UnmarshalJSON.
		if raw[0] == '"' {
			return nil, fmt.Errorf("number required")
		}
		if _, err := value.Float64(); err != nil {
			return nil, err
		}
		return value.String(), nil
	case "boolean":
		var value bool
		if err := json.Unmarshal(raw, &value); err != nil {
			return nil, err
		}
		return value, nil
	}
	return nil, fmt.Errorf("unsupported relational field kind %q", kind)
}
func relationalRawPath(object map[string]json.RawMessage, path string) json.RawMessage {
	parts := strings.SplitN(path, ".", 2)
	raw := object[parts[0]]
	if len(parts) == 1 {
		return raw
	}
	var child map[string]json.RawMessage
	if json.Unmarshal(raw, &child) != nil {
		return nil
	}
	return child[parts[1]]
}
