package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

func TestParseCLIConfigPriority(t *testing.T) {
	dir := t.TempDir()
	configPath := filepath.Join(dir, "sync.json")
	if err := os.WriteFile(configPath, []byte(`{
		"addr": "127.0.0.1:9000",
		"data_path": "from-config.json",
		"username": "config-user",
		"password": "config-password",
		"secret": "config-secret"
	}`), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("TM_SYNC_ADDR", "127.0.0.1:9001")
	t.Setenv("TM_SYNC_USER", "env-user")
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
	if cfg.password != "config-password" || cfg.secret != "config-secret" {
		t.Fatalf("config values were not applied: %#v", cfg)
	}
}

func TestHealthHandler(t *testing.T) {
	api := &app{cfg: defaultConfig(), store: store{NextRevision: 1, Users: map[string]userData{}}}
	recorder := httptest.NewRecorder()
	api.handleHealth(recorder, httptest.NewRequest(http.MethodGet, "/health", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d", recorder.Code)
	}
	if !strings.Contains(recorder.Body.String(), `"status":"ok"`) {
		t.Fatalf("unexpected body: %s", recorder.Body.String())
	}
}

func TestSyncServerStoresTeamProgressEntities(t *testing.T) {
	api := &app{cfg: defaultConfig(), store: store{NextRevision: 1, Users: map[string]userData{}}}
	changes := []syncRow{
		{
			Entity:    "project",
			ID:        "project_sync",
			DeviceID:  "device_a",
			UpdatedAt: "2026-05-10T08:01:00Z",
			Payload:   json.RawMessage(`{"id":"project_sync","name":"同步项目","defaultExpectedStartHours":6,"updatedAt":"2026-05-10T08:01:00Z"}`),
		},
		{
			Entity:    "project_member",
			ID:        "member_sync",
			DeviceID:  "device_a",
			UpdatedAt: "2026-05-10T08:03:00Z",
			Payload:   json.RawMessage(`{"id":"member_sync","projectId":"project_sync","name":"执行者","roles":["project_owner","executor"],"updatedAt":"2026-05-10T08:03:00Z"}`),
		},
		{
			Entity:    "task",
			ID:        "task_sync",
			DeviceID:  "device_a",
			UpdatedAt: "2026-05-10T16:30:00Z",
			Payload:   json.RawMessage(`{"id":"task_sync","projectId":"project_sync","primaryExecutorMemberId":"member_sync","expectedStartAt":"2026-05-10T09:00:00Z","expectedFinishAt":"2026-05-10T18:00:00Z","progressPercent":65,"progressNote":"接口联调中","status":"pending_review","reviewSubmittedAt":"2026-05-10T16:30:00Z","reviewSubmittedByMemberId":"member_sync","updatedAt":"2026-05-10T16:30:00Z"}`),
		},
		{
			Entity:    "work_session",
			ID:        "work_session_sync",
			DeviceID:  "device_a",
			UpdatedAt: "2026-05-10T10:05:00Z",
			Payload:   json.RawMessage(`{"id":"work_session_sync","taskId":"task_sync","executorMemberId":"member_sync","focusSessionId":"focus_sync","status":"active","startedAt":"2026-05-10T10:00:00Z","updatedAt":"2026-05-10T10:05:00Z"}`),
		},
		{
			Entity:    "execution_signal",
			ID:        "signal_sync",
			DeviceID:  "device_a",
			UpdatedAt: "2026-05-10T10:00:00Z",
			Payload:   json.RawMessage(`{"id":"signal_sync","workSessionId":"work_session_sync","taskId":"task_sync","executorMemberId":"member_sync","type":"work_started","createdAt":"2026-05-10T10:00:00Z","payload":{"mode":"focus"}}`),
		},
	}

	pushed := pushRows(t, api, "demo", "device_a", changes)
	if len(pushed.Accepted) != len(changes) {
		t.Fatalf("accepted = %d, want %d, conflicts = %#v", len(pushed.Accepted), len(changes), pushed.Conflicts)
	}

	pulled := pullRows(t, api, "demo", 0)
	if len(pulled.Changes) != len(changes) {
		t.Fatalf("pulled changes = %d, want %d", len(pulled.Changes), len(changes))
	}
	body, err := json.Marshal(pulled.Changes)
	if err != nil {
		t.Fatal(err)
	}
	for _, expected := range []string{"project_sync", "member_sync", "work_session_sync", "signal_sync", "progressNote", "reviewSubmittedAt", "expectedStartAt", "expectedFinishAt"} {
		if !strings.Contains(string(body), expected) {
			t.Fatalf("pulled changes missing %q: %s", expected, string(body))
		}
	}
}

func TestSyncServerConflictsAndDeletesTeamProgressEntities(t *testing.T) {
	api := &app{cfg: defaultConfig(), store: store{NextRevision: 1, Users: map[string]userData{}}}
	initial := pushRows(t, api, "demo", "device_a", []syncRow{
		{
			Entity:    "project_member",
			ID:        "member_sync",
			DeviceID:  "device_a",
			UpdatedAt: "2026-05-10T08:03:00Z",
			Payload:   json.RawMessage(`{"id":"member_sync","projectId":"project_sync","name":"执行者","roles":["executor"],"updatedAt":"2026-05-10T08:03:00Z"}`),
		},
		{
			Entity:    "work_session",
			ID:        "work_session_sync",
			DeviceID:  "device_a",
			UpdatedAt: "2026-05-10T10:05:00Z",
			Payload:   json.RawMessage(`{"id":"work_session_sync","taskId":"task_sync","focusSessionId":"focus_sync","status":"active","startedAt":"2026-05-10T10:00:00Z","updatedAt":"2026-05-10T10:05:00Z"}`),
		},
	})
	if len(initial.Accepted) != 2 {
		t.Fatalf("initial accepted = %d", len(initial.Accepted))
	}

	conflicted := pushRows(t, api, "demo", "device_b", []syncRow{
		{
			Entity:    "project_member",
			ID:        "member_sync",
			DeviceID:  "device_b",
			UpdatedAt: "2026-05-10T08:02:00Z",
			Payload:   json.RawMessage(`{"id":"member_sync","name":"旧执行者","updatedAt":"2026-05-10T08:02:00Z"}`),
		},
	})
	if len(conflicted.Conflicts) != 1 || conflicted.Conflicts[0].Entity != "project_member" {
		t.Fatalf("expected project_member conflict, got %#v", conflicted.Conflicts)
	}

	deletedAt := "2026-05-10T11:00:00Z"
	deleted := pushRows(t, api, "demo", "device_b", []syncRow{
		{
			Entity:    "work_session",
			ID:        "work_session_sync",
			DeviceID:  "device_b",
			UpdatedAt: deletedAt,
			DeletedAt: deletedAt,
			Payload:   json.RawMessage(`{}`),
		},
	})
	if len(deleted.Accepted) != 1 || deleted.Accepted[0].DeletedAt != deletedAt {
		t.Fatalf("expected accepted work_session tombstone, got %#v", deleted.Accepted)
	}
	pulled := pullRows(t, api, "demo", initial.CurrentRevision)
	foundTombstone := false
	for _, change := range pulled.Changes {
		if change.Entity == "work_session" && change.ID == "work_session_sync" && change.DeletedAt == deletedAt {
			foundTombstone = true
		}
	}
	if !foundTombstone {
		t.Fatalf("pull did not include work_session tombstone: %#v", pulled.Changes)
	}
}

func pushRows(t *testing.T, api *app, userID string, deviceID string, changes []syncRow) pushResponse {
	t.Helper()
	body, err := json.Marshal(pushRequest{DeviceID: deviceID, Changes: changes})
	if err != nil {
		t.Fatal(err)
	}
	recorder := httptest.NewRecorder()
	api.handlePush(recorder, httptest.NewRequest(http.MethodPost, "/sync/push", bytes.NewReader(body)), userID)
	if recorder.Code != http.StatusOK {
		t.Fatalf("push status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var response pushResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	return response
}

func pullRows(t *testing.T, api *app, userID string, since int64) pullResponse {
	t.Helper()
	recorder := httptest.NewRecorder()
	api.handlePull(recorder, httptest.NewRequest(http.MethodGet, "/sync/pull?since="+strconv.FormatInt(since, 10), nil), userID)
	if recorder.Code != http.StatusOK {
		t.Fatalf("pull status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var response pullResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	return response
}
