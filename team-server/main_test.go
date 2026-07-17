package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestParseCLIConfigPriority(t *testing.T) {
	dir := t.TempDir()
	configPath := filepath.Join(dir, "backend.json")
	if err := os.WriteFile(configPath, []byte(`{
		"addr": "127.0.0.1:9000",
		"mysql_dsn": "config:pass@tcp(127.0.0.1:3306)/timemanage_team",
		"username": "config-user",
		"password": "config-password",
		"secret": "config-secret"
	}`), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("TM_BACKEND_ADDR", "127.0.0.1:9001")
	t.Setenv("TM_BACKEND_USER", "env-user")
	command, cfg, returnedPath, err := parseCLI([]string{"serve", "--config", configPath, "--addr", "127.0.0.1:9002"})
	if err != nil {
		t.Fatal(err)
	}
	if command != "serve" {
		t.Fatalf("command = %q", command)
	}
	if returnedPath != configPath {
		t.Fatalf("config path = %q", returnedPath)
	}
	if cfg.addr != "127.0.0.1:9002" {
		t.Fatalf("addr priority failed: %q", cfg.addr)
	}
	if cfg.username != "env-user" {
		t.Fatalf("env priority failed: %q", cfg.username)
	}
	if cfg.mysqlDSN != "config:pass@tcp(127.0.0.1:3306)/timemanage_team" {
		t.Fatalf("mysql dsn config failed: %q", cfg.mysqlDSN)
	}
	if cfg.password != "config-password" || cfg.secret != "config-secret" {
		t.Fatalf("config values were not applied: %#v", cfg)
	}
}

func TestParseDatabaseCLI(t *testing.T) {
	t.Setenv("TM_BACKEND_MYSQL_DSN", "user:pass@tcp(127.0.0.1:3306)/timemanage")
	invocation, err := parseInvocation([]string{"db", "rollback", "--to", "v0.1.2", "--confirm", "--backup-dir", "db-backups"})
	if err != nil {
		t.Fatal(err)
	}
	if invocation.command != "db-rollback" || invocation.target != "v0.1.2" || !invocation.confirm {
		t.Fatalf("unexpected invocation: %#v", invocation)
	}
	if invocation.config.backupDir != "db-backups" {
		t.Fatalf("backup dir = %q", invocation.config.backupDir)
	}
}
func TestHealthHandler(t *testing.T) {
	api := testApp(t)
	recorder := httptest.NewRecorder()
	api.handleHealth(recorder, httptest.NewRequest(http.MethodGet, "/health", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d", recorder.Code)
	}
	if !strings.Contains(recorder.Body.String(), `"status":"ok"`) {
		t.Fatalf("unexpected body: %s", recorder.Body.String())
	}
}

func TestHealthHandlerIncludesMySQLStorageSummary(t *testing.T) {
	dsn, cleanup := mysqlTestDSN(t)
	defer cleanup()
	db, err := openMySQLStore(dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	cfg := defaultConfig()
	cfg.mysqlDSN = dsn
	api := newApp(cfg, db)
	recorder := httptest.NewRecorder()

	api.handleHealth(recorder, httptest.NewRequest(http.MethodGet, "/health", nil))

	body := recorder.Body.String()
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", recorder.Code, body)
	}
	for _, expected := range []string{`"storage"`, `"driver":"mysql"`, `"database":"`, `"business_rows":`} {
		if !strings.Contains(body, expected) {
			t.Fatalf("health response missing %s: %s", expected, body)
		}
	}
}

func TestCORSAllowsPutPreflight(t *testing.T) {
	handler := withCORS(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("preflight should not call wrapped handler")
	}))
	request := httptest.NewRequest(http.MethodOptions, "/app/bootstrap", nil)
	request.Header.Set("Origin", "http://127.0.0.1:1420")
	request.Header.Set("Access-Control-Request-Method", http.MethodPut)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("status = %d", recorder.Code)
	}
	methods := recorder.Header().Get("Access-Control-Allow-Methods")
	if !strings.Contains(methods, http.MethodPut) {
		t.Fatalf("PUT missing from allowed methods: %q", methods)
	}
}
