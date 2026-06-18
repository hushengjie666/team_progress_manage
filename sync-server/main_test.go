package main

import (
	"bytes"
	"context"
	"encoding/json"
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

func TestSyncServerStoresTeamProgressEntities(t *testing.T) {
	api := testApp(t)
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
			Payload:   json.RawMessage(`{"id":"member_sync","projectId":"project_sync","accountId":"account_owner","name":"执行者","roles":["project_owner","executor"],"updatedAt":"2026-05-10T08:03:00Z"}`),
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

	pushed := pushRows(t, api, ownerAuth(), "device_a", changes)
	if len(pushed.Accepted) != len(changes) {
		t.Fatalf("accepted = %d, want %d, conflicts = %#v", len(pushed.Accepted), len(changes), pushed.Conflicts)
	}

	pulled := pullRows(t, api, ownerAuth(), 0)
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

func TestSyncServerPublishesWorkspaceEventsOnPush(t *testing.T) {
	api := testApp(t)
	events, unsubscribe := api.subscribeWorkspace("workspace_test")
	defer unsubscribe()

	pushed := pushRows(t, api, ownerAuth(), "device_a", []syncRow{
		{
			Entity:    "project",
			ID:        "project_sync",
			DeviceID:  "device_a",
			UpdatedAt: "2026-05-10T08:01:00Z",
			Payload:   json.RawMessage(`{"id":"project_sync","name":"同步项目","updatedAt":"2026-05-10T08:01:00Z"}`),
		},
	})
	if len(pushed.Accepted) != 1 {
		t.Fatalf("accepted = %d", len(pushed.Accepted))
	}

	select {
	case event := <-events:
		if event.WorkspaceID != "workspace_test" || event.CurrentRevision != pushed.CurrentRevision || event.DeviceID != "device_a" {
			t.Fatalf("unexpected sync event: %#v", event)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for sync event")
	}
}

func TestSyncServerEventsEndpointAcceptsQueryToken(t *testing.T) {
	api := testApp(t)
	token, err := api.signToken(tokenClaims{
		AccountID:   "account_owner",
		WorkspaceID: "workspace_test",
		Exp:         time.Now().Add(time.Hour).Unix(),
	})
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	req := httptest.NewRequest(http.MethodGet, "/sync/events?token="+token+"&device_id=device_b", nil).WithContext(ctx)
	recorder := httptest.NewRecorder()
	done := make(chan struct{})
	go func() {
		api.handleEvents(recorder, req)
		close(done)
	}()
	time.Sleep(10 * time.Millisecond)
	cancel()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for events handler to exit")
	}
	if recorder.Code != http.StatusOK {
		t.Fatalf("events status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	body := recorder.Body.String()
	if !strings.Contains(body, "event: hello") || !strings.Contains(body, `"current_revision"`) {
		t.Fatalf("events endpoint did not emit hello event: %s", body)
	}
}

func TestSyncServerEventsEndpointBroadcastsSameDeviceRevisions(t *testing.T) {
	api := testApp(t)
	token, err := api.signToken(tokenClaims{
		AccountID:   "account_owner",
		WorkspaceID: "workspace_test",
		Exp:         time.Now().Add(time.Hour).Unix(),
	})
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	req := httptest.NewRequest(http.MethodGet, "/sync/events?token="+token+"&device_id=device_a", nil).WithContext(ctx)
	recorder := httptest.NewRecorder()
	done := make(chan struct{})
	go func() {
		api.handleEvents(recorder, req)
		close(done)
	}()
	time.Sleep(10 * time.Millisecond)

	pushRows(t, api, ownerAuth(), "device_a", []syncRow{
		{
			Entity:    "project",
			ID:        "project_same_device_event",
			UpdatedAt: "2026-05-10T08:01:00Z",
			Payload:   json.RawMessage(`{"id":"project_same_device_event","name":"同设备事件","updatedAt":"2026-05-10T08:01:00Z"}`),
		},
	})

	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		if strings.Contains(recorder.Body.String(), "event: revision") {
			cancel()
			<-done
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	cancel()
	<-done
	t.Fatalf("events endpoint did not broadcast same-device revision: %s", recorder.Body.String())
}

func TestMajorSyncFeaturesPublishAndPullQuickly(t *testing.T) {
	api := testApp(t)
	events, unsubscribe := api.subscribeWorkspace("workspace_test")
	defer unsubscribe()

	startedAt := time.Now()
	pushed := pushRows(t, api, ownerAuth(), "device_a", []syncRow{
		{
			Entity:    "project",
			ID:        "project_realtime",
			DeviceID:  "device_a",
			UpdatedAt: "2026-06-18T09:00:00Z",
			Payload:   json.RawMessage(`{"id":"project_realtime","name":"实时同步项目","description":"同步专项测试","defaultExpectedStartHours":24,"createdAt":"2026-06-18T09:00:00Z","updatedAt":"2026-06-18T09:00:00Z"}`),
		},
		{
			Entity:    "project_member",
			ID:        "member_realtime_owner",
			DeviceID:  "device_a",
			UpdatedAt: "2026-06-18T09:02:00Z",
			Payload:   json.RawMessage(`{"id":"member_realtime_owner","projectId":"project_realtime","teamMemberId":"team_member_realtime","accountId":"account_owner","name":"测试成员","email":"owner@example.com","roles":["project_owner","executor"],"status":"active","createdAt":"2026-06-18T09:02:00Z","updatedAt":"2026-06-18T09:02:00Z"}`),
		},
		{
			Entity:    "team_member",
			ID:        "team_member_realtime",
			DeviceID:  "device_a",
			UpdatedAt: "2026-06-18T09:02:30Z",
			Payload:   json.RawMessage(`{"id":"team_member_realtime","accountId":"account_owner","name":"测试成员","email":"owner@example.com","status":"active","createdAt":"2026-06-18T09:02:30Z","updatedAt":"2026-06-18T09:02:30Z"}`),
		},
		{
			Entity:    "task",
			ID:        "task_realtime",
			DeviceID:  "device_a",
			UpdatedAt: "2026-06-18T09:03:00Z",
			Payload:   json.RawMessage(`{"id":"task_realtime","title":"实时同步任务","projectId":"project_realtime","project":"实时同步项目","creatorMemberId":"member_realtime_owner","primaryExecutorMemberId":"member_realtime_owner","priority":"medium","severity":"medium","stage":"development","estimatePomodoros":2,"actualPomodoros":0,"progressPercent":10,"progressNote":"刚开始","status":"committed","repeatRule":"none","subtasks":[],"collaboratorMemberIds":[],"estimateHistory":[],"sortOrder":1,"createdAt":"2026-06-18T09:03:00Z","updatedAt":"2026-06-18T09:03:00Z"}`),
		},
		{
			Entity:    "daily_plan",
			ID:        "plan_2026-06-18",
			DeviceID:  "device_a",
			UpdatedAt: "2026-06-18T09:04:00Z",
			Payload:   json.RawMessage(`{"id":"plan_2026-06-18","date":"2026-06-18","capacityPomodoros":8,"committedTaskIds":["task_realtime"],"completedPomodoros":0,"recommendedCapacityPomodoros":8,"suggestedCapacityPomodoros":8,"suggestedTaskIds":[],"overloadAcknowledged":false,"reflection":"","review":{"mood":"normal","wins":"","blockers":"","interruptionPattern":"","tomorrowFocus":""},"createdAt":"2026-06-18T09:04:00Z","updatedAt":"2026-06-18T09:04:00Z"}`),
		},
		{
			Entity:    "work_session",
			ID:        "work_session_realtime",
			DeviceID:  "device_a",
			UpdatedAt: "2026-06-18T09:05:00Z",
			Payload:   json.RawMessage(`{"id":"work_session_realtime","taskId":"task_realtime","executorMemberId":"member_realtime_owner","focusSessionId":"focus_realtime","status":"active","startedAt":"2026-06-18T09:05:00Z","totalPausedSeconds":0,"createdAt":"2026-06-18T09:05:00Z","updatedAt":"2026-06-18T09:05:00Z"}`),
		},
		{
			Entity:    "execution_signal",
			ID:        "signal_realtime",
			DeviceID:  "device_a",
			UpdatedAt: "2026-06-18T09:05:01Z",
			Payload:   json.RawMessage(`{"id":"signal_realtime","workSessionId":"work_session_realtime","taskId":"task_realtime","executorMemberId":"member_realtime_owner","type":"work_started","createdAt":"2026-06-18T09:05:01Z","payload":{"mode":"focus"}}`),
		},
	})
	if len(pushed.Accepted) != 7 || len(pushed.Conflicts) != 0 {
		t.Fatalf("accepted = %d conflicts = %#v", len(pushed.Accepted), pushed.Conflicts)
	}

	select {
	case event := <-events:
		if event.CurrentRevision != pushed.CurrentRevision || event.DeviceID != "device_a" {
			t.Fatalf("unexpected sync event: %#v", event)
		}
		if elapsed := time.Since(startedAt); elapsed > 200*time.Millisecond {
			t.Fatalf("sync event latency = %s, want <= 200ms", elapsed)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for realtime sync event")
	}

	pulled := pullRows(t, api, ownerAuth(), 0)
	byKey := map[string]syncRow{}
	for _, change := range pulled.Changes {
		byKey[key(change.Entity, change.ID)] = change
	}
	for _, expected := range []string{
		key("project", "project_realtime"),
		key("team_member", "team_member_realtime"),
		key("project_member", "member_realtime_owner"),
		key("task", "task_realtime"),
		key("daily_plan", "plan_2026-06-18"),
		key("work_session", "work_session_realtime"),
		key("execution_signal", "signal_realtime"),
	} {
		if _, ok := byKey[expected]; !ok {
			t.Fatalf("pull missing %s from %#v", expected, byKey)
		}
	}

	updated := pushRows(t, api, ownerAuth(), "device_b", []syncRow{
		{
			Entity:    "task",
			ID:        "task_realtime",
			DeviceID:  "device_b",
			UpdatedAt: "2026-06-18T09:10:00Z",
			Payload:   json.RawMessage(`{"id":"task_realtime","title":"实时同步任务","projectId":"project_realtime","project":"实时同步项目","creatorMemberId":"member_realtime_owner","primaryExecutorMemberId":"member_realtime_owner","priority":"medium","severity":"medium","stage":"development","estimatePomodoros":2,"actualPomodoros":0,"progressPercent":80,"progressNote":"即将提交","status":"pending_review","repeatRule":"none","subtasks":[],"collaboratorMemberIds":[],"estimateHistory":[],"sortOrder":1,"createdAt":"2026-06-18T09:03:00Z","updatedAt":"2026-06-18T09:10:00Z"}`),
		},
	})
	if len(updated.Accepted) != 1 || len(updated.Conflicts) != 0 {
		t.Fatalf("updated accepted = %d conflicts = %#v", len(updated.Accepted), updated.Conflicts)
	}
	deviceAPull := pullRows(t, api, ownerAuth(), pushed.CurrentRevision)
	if len(deviceAPull.Changes) != 1 || deviceAPull.Changes[0].ID != "task_realtime" {
		t.Fatalf("device A pull after update = %#v", deviceAPull.Changes)
	}
	if !strings.Contains(string(deviceAPull.Changes[0].Payload), `"progressPercent":80`) ||
		!strings.Contains(string(deviceAPull.Changes[0].Payload), `"status":"pending_review"`) {
		t.Fatalf("device A did not receive task progress/review update: %s", string(deviceAPull.Changes[0].Payload))
	}
}

func TestSyncServerConflictsAndDeletesTeamProgressEntities(t *testing.T) {
	api := testApp(t)
	initial := pushRows(t, api, ownerAuth(), "device_a", []syncRow{
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
			Payload:   json.RawMessage(`{"id":"member_sync","projectId":"project_sync","accountId":"account_owner","name":"执行者","roles":["project_owner","executor"],"updatedAt":"2026-05-10T08:03:00Z"}`),
		},
		{
			Entity:    "task",
			ID:        "task_sync",
			DeviceID:  "device_a",
			UpdatedAt: "2026-05-10T09:00:00Z",
			Payload:   json.RawMessage(`{"id":"task_sync","projectId":"project_sync","primaryExecutorMemberId":"member_sync","status":"in_progress","updatedAt":"2026-05-10T09:00:00Z"}`),
		},
		{
			Entity:    "work_session",
			ID:        "work_session_sync",
			DeviceID:  "device_a",
			UpdatedAt: "2026-05-10T10:05:00Z",
			Payload:   json.RawMessage(`{"id":"work_session_sync","taskId":"task_sync","focusSessionId":"focus_sync","status":"active","startedAt":"2026-05-10T10:00:00Z","updatedAt":"2026-05-10T10:05:00Z"}`),
		},
	})
	if len(initial.Accepted) != 4 {
		t.Fatalf("initial accepted = %d", len(initial.Accepted))
	}

	conflicted := pushRows(t, api, ownerAuth(), "device_b", []syncRow{
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
	deleted := pushRows(t, api, ownerAuth(), "device_b", []syncRow{
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
	pulled := pullRows(t, api, ownerAuth(), initial.CurrentRevision)
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

func TestBootstrapAndLoginCreateWorkspaceAccount(t *testing.T) {
	api := newApp(defaultConfig(), store{Version: 2, NextRevision: 1, Workspaces: map[string]workspaceData{}, Accounts: map[string]accountRecord{}, Users: map[string]userData{}})
	body := bytes.NewReader([]byte(`{"workspace_name":"交付团队","name":"负责人","email":"owner@example.com","password":"secret","device_id":"device_a"}`))
	recorder := httptest.NewRecorder()
	api.handleBootstrap(recorder, httptest.NewRequest(http.MethodPost, "/auth/bootstrap", body))
	if recorder.Code != http.StatusOK {
		t.Fatalf("bootstrap status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var bootstrap loginResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &bootstrap); err != nil {
		t.Fatal(err)
	}
	if bootstrap.Token == "" || bootstrap.Account.Email != "owner@example.com" || bootstrap.Workspace.Name != "交付团队" {
		t.Fatalf("unexpected bootstrap response: %#v", bootstrap)
	}
	stored := api.store.Accounts[bootstrap.Account.ID]
	if stored.PasswordHash == "secret" || stored.PasswordHash == "" || bootstrap.Account.PasswordHash != "" {
		t.Fatalf("password hash exposure/storage failed: response=%#v stored=%#v", bootstrap.Account, stored)
	}

	loginBody := bytes.NewReader([]byte(`{"email":"owner@example.com","password":"secret","device_id":"device_b"}`))
	loginRecorder := httptest.NewRecorder()
	api.handleLogin(loginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", loginBody))
	if loginRecorder.Code != http.StatusOK {
		t.Fatalf("login status = %d, body = %s", loginRecorder.Code, loginRecorder.Body.String())
	}
}

func TestProjectOwnerCreatesMemberAccount(t *testing.T) {
	api := testApp(t)
	seed := pushRows(t, api, ownerAuth(), "device_a", []syncRow{
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
			Payload:   json.RawMessage(`{"id":"member_sync","projectId":"project_sync","accountId":"account_owner","name":"负责人","roles":["project_owner","executor"],"updatedAt":"2026-05-10T08:03:00Z"}`),
		},
	})
	if len(seed.Accepted) != 2 {
		t.Fatalf("seed accepted = %d", len(seed.Accepted))
	}
	body := bytes.NewReader([]byte(`{"project_id":"project_sync","name":"执行者","email":"executor@example.com","password":"demo","roles":["executor"]}`))
	recorder := httptest.NewRecorder()
	api.handleMembers(recorder, httptest.NewRequest(http.MethodPost, "/members", body), ownerAuth())
	if recorder.Code != http.StatusOK {
		t.Fatalf("create member status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var response memberResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response.Account.Email != "executor@example.com" || response.Member.Entity != "project_member" {
		t.Fatalf("unexpected member response: %#v", response)
	}
	patchBody := bytes.NewReader([]byte(`{"password":"new-demo"}`))
	patchRecorder := httptest.NewRecorder()
	api.handleMemberByID(patchRecorder, httptest.NewRequest(http.MethodPatch, "/members/"+response.Member.ID, patchBody), ownerAuth())
	if patchRecorder.Code != http.StatusOK {
		t.Fatalf("patch member status = %d, body = %s", patchRecorder.Code, patchRecorder.Body.String())
	}
	loginBody := bytes.NewReader([]byte(`{"email":"executor@example.com","password":"new-demo","device_id":"device_executor"}`))
	loginRecorder := httptest.NewRecorder()
	api.handleLogin(loginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", loginBody))
	if loginRecorder.Code != http.StatusOK {
		t.Fatalf("login with patched password status = %d, body = %s", loginRecorder.Code, loginRecorder.Body.String())
	}
	pulled := pullRows(t, api, ownerAuth(), 0)
	if len(pulled.Changes) != 4 {
		t.Fatalf("expected four workspace rows, got %d", len(pulled.Changes))
	}
}

func TestProjectOwnerCreatesWorkspaceMemberAccount(t *testing.T) {
	api := testApp(t)
	seed := pushRows(t, api, ownerAuth(), "device_a", []syncRow{
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
			Payload:   json.RawMessage(`{"id":"member_sync","projectId":"project_sync","accountId":"account_owner","name":"负责人","roles":["project_owner","executor"],"updatedAt":"2026-05-10T08:03:00Z"}`),
		},
	})
	if len(seed.Accepted) != 2 {
		t.Fatalf("seed accepted = %d", len(seed.Accepted))
	}
	body := bytes.NewReader([]byte(`{"name":"成员库成员","email":"directory@example.com","password":"demo"}`))
	recorder := httptest.NewRecorder()
	api.handleMembers(recorder, httptest.NewRequest(http.MethodPost, "/members", body), ownerAuth())
	if recorder.Code != http.StatusOK {
		t.Fatalf("create workspace member status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var response memberResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response.Account.Email != "directory@example.com" || response.Member.Entity != "team_member" {
		t.Fatalf("unexpected workspace member response: %#v", response)
	}
	duplicateBody := bytes.NewReader([]byte(`{"name":"重复成员","email":"directory@example.com","password":"demo"}`))
	duplicateRecorder := httptest.NewRecorder()
	api.handleMembers(duplicateRecorder, httptest.NewRequest(http.MethodPost, "/members", duplicateBody), ownerAuth())
	if duplicateRecorder.Code != http.StatusConflict {
		t.Fatalf("duplicate workspace member status = %d, body = %s", duplicateRecorder.Code, duplicateRecorder.Body.String())
	}
	patchBody := bytes.NewReader([]byte(`{"password":"new-demo"}`))
	patchRecorder := httptest.NewRecorder()
	api.handleMemberByID(patchRecorder, httptest.NewRequest(http.MethodPatch, "/members/"+response.Member.ID, patchBody), ownerAuth())
	if patchRecorder.Code != http.StatusOK {
		t.Fatalf("patch workspace member status = %d, body = %s", patchRecorder.Code, patchRecorder.Body.String())
	}
	loginBody := bytes.NewReader([]byte(`{"email":"directory@example.com","password":"new-demo","device_id":"device_directory"}`))
	loginRecorder := httptest.NewRecorder()
	api.handleLogin(loginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", loginBody))
	if loginRecorder.Code != http.StatusOK {
		t.Fatalf("login with patched workspace member password status = %d, body = %s", loginRecorder.Code, loginRecorder.Body.String())
	}
}

func TestPatchLegacyAccountBackfillsMissingTeamMember(t *testing.T) {
	api := testApp(t)
	seed := pushRows(t, api, ownerAuth(), "device_a", []syncRow{
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
			Payload:   json.RawMessage(`{"id":"member_sync","projectId":"project_sync","accountId":"account_owner","name":"负责人","roles":["project_owner","executor"],"updatedAt":"2026-05-10T08:03:00Z"}`),
		},
	})
	if len(seed.Accepted) != 2 {
		t.Fatalf("seed accepted = %d", len(seed.Accepted))
	}
	hash, err := hashPassword("old-demo")
	if err != nil {
		t.Fatal(err)
	}
	api.store.Accounts["account_legacy"] = accountRecord{
		ID:           "account_legacy",
		WorkspaceID:  "workspace_test",
		Name:         "旧成员",
		Email:        "legacy@example.com",
		PasswordHash: hash,
		CreatedAt:    "2026-05-10T08:00:00Z",
		UpdatedAt:    "2026-05-10T08:00:00Z",
	}
	patchBody := bytes.NewReader([]byte(`{"password":"new-demo"}`))
	patchRecorder := httptest.NewRecorder()
	api.handleMemberByID(patchRecorder, httptest.NewRequest(http.MethodPatch, "/members/team_member_account_legacy", patchBody), ownerAuth())
	if patchRecorder.Code != http.StatusOK {
		t.Fatalf("patch legacy member status = %d, body = %s", patchRecorder.Code, patchRecorder.Body.String())
	}
	if _, exists := api.store.Workspaces["workspace_test"].Rows[key("team_member", "team_member_account_legacy")]; !exists {
		t.Fatalf("expected missing team_member row to be backfilled")
	}
	loginBody := bytes.NewReader([]byte(`{"email":"legacy@example.com","password":"new-demo","device_id":"device_legacy"}`))
	loginRecorder := httptest.NewRecorder()
	api.handleLogin(loginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", loginBody))
	if loginRecorder.Code != http.StatusOK {
		t.Fatalf("login with patched legacy password status = %d, body = %s", loginRecorder.Code, loginRecorder.Body.String())
	}
}

func TestPatchWorkspaceMemberBackfillsMissingAccount(t *testing.T) {
	api := testApp(t)
	seed := pushRows(t, api, ownerAuth(), "device_a", []syncRow{
		{
			Entity:    "project",
			ID:        "project_sync",
			DeviceID:  "device_a",
			UpdatedAt: "2026-05-10T08:01:00Z",
			Payload:   json.RawMessage(`{"id":"project_sync","name":"同步项目","defaultExpectedStartHours":6,"updatedAt":"2026-05-10T08:01:00Z"}`),
		},
		{
			Entity:    "project_member",
			ID:        "member_sync_owner",
			DeviceID:  "device_a",
			UpdatedAt: "2026-05-10T08:02:00Z",
			Payload:   json.RawMessage(`{"id":"member_sync_owner","projectId":"project_sync","accountId":"account_owner","name":"负责人","roles":["project_owner","executor"],"updatedAt":"2026-05-10T08:02:00Z"}`),
		},
		{
			Entity:    "team_member",
			ID:        "team_member_missing_account",
			DeviceID:  "device_a",
			UpdatedAt: "2026-05-10T08:03:00Z",
			Payload:   json.RawMessage(`{"id":"team_member_missing_account","accountId":"account_missing","name":"王硕","email":"wangshuo","status":"active","updatedAt":"2026-05-10T08:03:00Z"}`),
		},
	})
	if len(seed.Accepted) != 3 {
		t.Fatalf("seed accepted = %d", len(seed.Accepted))
	}

	patchBody := bytes.NewReader([]byte(`{"password":"123"}`))
	patchRecorder := httptest.NewRecorder()
	api.handleMemberByID(patchRecorder, httptest.NewRequest(http.MethodPatch, "/members/team_member_missing_account", patchBody), ownerAuth())
	if patchRecorder.Code != http.StatusOK {
		t.Fatalf("patch member missing account status = %d, body = %s", patchRecorder.Code, patchRecorder.Body.String())
	}
	account, exists := api.store.Accounts["account_missing"]
	if !exists {
		t.Fatalf("expected missing account to be backfilled")
	}
	if account.Email != "wangshuo" || !checkPassword("123", account.PasswordHash) {
		t.Fatalf("unexpected backfilled account: %#v", account)
	}

	loginBody := bytes.NewReader([]byte(`{"email":"wangshuo","password":"123","device_id":"device_wangshuo"}`))
	loginRecorder := httptest.NewRecorder()
	api.handleLogin(loginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", loginBody))
	if loginRecorder.Code != http.StatusOK {
		t.Fatalf("login with backfilled account status = %d, body = %s", loginRecorder.Code, loginRecorder.Body.String())
	}
}

func testApp(t *testing.T) *app {
	t.Helper()
	return newApp(defaultConfig(), store{
		Version:      2,
		NextRevision: 1,
		Workspaces: map[string]workspaceData{
			"workspace_test": {
				ID:        "workspace_test",
				Name:      "测试团队",
				Rows:      map[string]syncRow{},
				CreatedAt: "2026-05-10T08:00:00Z",
				UpdatedAt: "2026-05-10T08:00:00Z",
			},
		},
		Accounts: map[string]accountRecord{
			"account_owner": {
				ID:          "account_owner",
				WorkspaceID: "workspace_test",
				Name:        "项目负责人",
				Email:       "owner@example.com",
				CreatedAt:   "2026-05-10T08:00:00Z",
				UpdatedAt:   "2026-05-10T08:00:00Z",
			},
		},
		Users: map[string]userData{},
	})
}

func ownerAuth() authContext {
	return authContext{AccountID: "account_owner", WorkspaceID: "workspace_test"}
}

func pushRows(t *testing.T, api *app, auth authContext, deviceID string, changes []syncRow) pushResponse {
	t.Helper()
	body, err := json.Marshal(pushRequest{DeviceID: deviceID, Changes: changes})
	if err != nil {
		t.Fatal(err)
	}
	recorder := httptest.NewRecorder()
	api.handlePush(recorder, httptest.NewRequest(http.MethodPost, "/sync/push", bytes.NewReader(body)), auth)
	if recorder.Code != http.StatusOK {
		t.Fatalf("push status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var response pushResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	return response
}

func pullRows(t *testing.T, api *app, auth authContext, since int64) pullResponse {
	t.Helper()
	recorder := httptest.NewRecorder()
	api.handlePull(recorder, httptest.NewRequest(http.MethodGet, "/sync/pull?since="+strconv.FormatInt(since, 10), nil), auth)
	if recorder.Code != http.StatusOK {
		t.Fatalf("pull status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var response pullResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	return response
}
