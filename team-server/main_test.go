package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"
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
	for _, expected := range []string{
		`"service":"timemanage-team"`,
		`"release_version":"` + releaseVersion + `"`,
		`"api_protocol_version":` + strconv.FormatInt(apiProtocolVersion, 10),
		`"database_schema_version":` + strconv.FormatInt(databaseSchemaVersion, 10),
		`"minimum_client_release":"` + minimumClientRelease + `"`,
		`"mutation_delta_version":1`,
		`"realtime_transport":"websocket"`,
	} {
		if !strings.Contains(recorder.Body.String(), expected) {
			t.Fatalf("health response missing %s: %s", expected, recorder.Body.String())
		}
	}
}

func TestRealtimeTicketIsSingleUseAndExpires(t *testing.T) {
	api := testApp(t)
	auth := authContext{AccountID: "account_test", WorkspaceID: "workspace_test"}
	ticket, _ := api.realtime.issueTicket(auth)
	consumed, ok := api.realtime.consumeTicket(ticket)
	if !ok || consumed != auth {
		t.Fatalf("ticket auth = %#v ok=%v", consumed, ok)
	}
	if _, ok := api.realtime.consumeTicket(ticket); ok {
		t.Fatal("single-use realtime ticket was accepted twice")
	}
	api.realtime.mu.Lock()
	api.realtime.tickets["expired"] = realtimeTicket{auth: auth, expiresAt: time.Now().Add(-time.Second)}
	api.realtime.mu.Unlock()
	if _, ok := api.realtime.consumeTicket("expired"); ok {
		t.Fatal("expired realtime ticket was accepted")
	}
}

func TestLegacyTeamDataReturnsUpgradeRequired(t *testing.T) {
	api := testApp(t)
	mux := http.NewServeMux()
	api.registerRoutes(mux)
	recorder := httptest.NewRecorder()
	mux.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/team/data", nil))
	if recorder.Code != http.StatusUpgradeRequired {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	for _, expected := range []string{`"code":"client_upgrade_required"`, `"server_release":"` + releaseVersion + `"`, `"required_client_release":"` + minimumClientRelease + `"`} {
		if !strings.Contains(recorder.Body.String(), expected) {
			t.Fatalf("upgrade response missing %s: %s", expected, recorder.Body.String())
		}
	}
}

func TestClientRequestCompatibilityRequiresCurrentHeaders(t *testing.T) {
	legacy := httptest.NewRequest(http.MethodPost, "/tasks/task-1", nil)
	if clientRequestCompatible(legacy) {
		t.Fatal("missing compatibility headers were accepted")
	}
	current := httptest.NewRequest(http.MethodPost, "/tasks/task-1", nil)
	current.Header.Set("X-TimeManage-Client-Release", releaseVersion)
	current.Header.Set("X-TimeManage-API-Protocol", strconv.FormatInt(apiProtocolVersion, 10))
	if !clientRequestCompatible(current) {
		t.Fatal("current compatibility headers were rejected")
	}
	api := testApp(t)
	compatibilityHandler := api.withClientCompatibility(func(w http.ResponseWriter, _ *http.Request, _ authContext) {
		w.WriteHeader(http.StatusNoContent)
	})
	recorder := httptest.NewRecorder()
	compatibilityHandler.ServeHTTP(recorder, legacy)
	if recorder.Code != http.StatusUpgradeRequired {
		t.Fatalf("missing headers reached auth/business handler: %d", recorder.Code)
	}
	routeRecorder := httptest.NewRecorder()
	mux := http.NewServeMux()
	api.registerRoutes(mux)
	mux.ServeHTTP(routeRecorder, httptest.NewRequest(http.MethodPost, "/workspaces", nil))
	if routeRecorder.Code != http.StatusUpgradeRequired {
		t.Fatalf("missing headers reached workspace write handler: %d", routeRecorder.Code)
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

func TestCORSAllowsIdempotencyKeyPreflight(t *testing.T) {
	handler := withCORS(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("preflight should not call wrapped handler")
	}))
	request := httptest.NewRequest(http.MethodOptions, "/tasks/task_test/start", nil)
	request.Header.Set("Origin", "http://127.0.0.1:1420")
	request.Header.Set("Access-Control-Request-Method", http.MethodPost)
	request.Header.Set("Access-Control-Request-Headers", "authorization,content-type,idempotency-key,x-timemanage-client-release,x-timemanage-api-protocol")
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("status = %d", recorder.Code)
	}
	headers := strings.ToLower(recorder.Header().Get("Access-Control-Allow-Headers"))
	if !strings.Contains(headers, "idempotency-key") {
		t.Fatalf("Idempotency-Key missing from allowed headers: %q", headers)
	}
	if !strings.Contains(headers, "x-timemanage-client-release") || !strings.Contains(headers, "x-timemanage-api-protocol") {
		t.Fatalf("TimeManage compatibility headers missing from allowed headers: %q", headers)
	}
}
