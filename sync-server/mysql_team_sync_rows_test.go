package main

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestSyncServerStoresTeamProgressEntities(t *testing.T) {
	api := mysqlSeededApp(t)
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
	if pushed.CurrentRevision != int64(len(changes)) {
		t.Fatalf("current revision = %d, want %d", pushed.CurrentRevision, len(changes))
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

func TestMajorSyncFeaturesPublishAndPullQuickly(t *testing.T) {
	api := mysqlSeededApp(t)

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
			Payload:   json.RawMessage(`{"id":"member_realtime_owner","projectId":"project_realtime","accountId":"account_owner","name":"测试成员","email":"owner@example.com","roles":["project_owner","executor"],"status":"active","createdAt":"2026-06-18T09:02:00Z","updatedAt":"2026-06-18T09:02:00Z"}`),
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
	if pushed.CurrentRevision != 6 {
		t.Fatalf("current revision = %d", pushed.CurrentRevision)
	}

	pulled := pullRows(t, api, ownerAuth(), 0)
	byKey := map[string]syncRow{}
	for _, change := range pulled.Changes {
		byKey[key(change.Entity, change.ID)] = change
	}
	for _, expected := range []string{
		key("project", "project_realtime"),
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
	if updated.CurrentRevision != pushed.CurrentRevision+1 {
		t.Fatalf("updated current revision = %d, want %d", updated.CurrentRevision, pushed.CurrentRevision+1)
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
