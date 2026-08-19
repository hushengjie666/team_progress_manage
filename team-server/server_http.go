package main

import (
	"context"
	"database/sql"
	"net/http"
	"time"

	"github.com/go-sql-driver/mysql"
)

func (a *app) requireMySQL(w http.ResponseWriter) bool {
	if a.db != nil {
		return true
	}
	writeError(w, http.StatusServiceUnavailable, "mysql store unavailable")
	return false
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Add("Vary", "Origin")
		} else {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key, X-Requested-With, X-TimeManage-Client-Release, X-TimeManage-API-Protocol, X-TimeManage-Mutation-ID")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Private-Network", "true")
		w.Header().Set("Access-Control-Max-Age", "86400")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (a *app) handleHealth(w http.ResponseWriter, r *http.Request) {
	payload := map[string]any{
		"status":                  "ok",
		"service":                 "timemanage-team",
		"release_version":         releaseVersion,
		"api_protocol_version":    apiProtocolVersion,
		"database_schema_version": latestSchemaVersion,
		"minimum_client_release":  minimumClientRelease,
		"mutation_delta_version":  1,
		"realtime_transport":      "websocket",
		"time":                    time.Now().UTC().Format(time.RFC3339),
	}
	if a.db != nil {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		version, err := currentSchemaVersion(ctx, a.db)
		cancel()
		if err != nil {
			payload["database_schema_version"] = nil
			payload["database_status"] = "unknown"
		} else {
			payload["database_schema_version"] = version
			payload["database_status"] = "ready"
		}
	}
	if storage := a.healthStorageSummary(r.Context()); storage != nil {
		payload["storage"] = storage
	}
	writeJSON(w, http.StatusOK, payload)
}

func (a *app) healthStorageSummary(parent context.Context) map[string]any {
	if a.db == nil {
		return nil
	}
	ctx, cancel := context.WithTimeout(parent, 2*time.Second)
	defer cancel()
	summary := map[string]any{
		"driver": "mysql",
	}
	if cfg, err := mysql.ParseDSN(a.cfg.mysqlDSN); err == nil && cfg.DBName != "" {
		summary["database"] = cfg.DBName
	}
	var total int
	for _, spec := range businessEntityTables {
		var count int
		if err := a.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM "+spec.table).Scan(&count); err != nil {
			if err == sql.ErrNoRows {
				continue
			}
			summary["status"] = "error"
			return summary
		}
		total += count
		if spec.entity == "project" {
			summary["business_projects"] = count
		}
		if spec.entity == "task" {
			summary["business_tasks"] = count
		}
	}
	summary["business_rows"] = total
	return summary
}
