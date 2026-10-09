package main

import (
	"context"
	"encoding/json"
	"reflect"
	"testing"
)

func relationalFixtureRows() []businessRow {
	samples := map[string]string{
		"project":           `{"id":"project_core","workspaceId":"workspace_test","name":"项目中文 🍅","description":"quote \" and \\ slash","defaultExpectedStartHours":2.25,"taskStageMode":"regular","sortOrder":3,"createdAt":"2026-10-09T00:00:00Z","updatedAt":"2026-10-09T00:00:00Z","extension":{"keep":true}}`,
		"project_member":    `{"id":"member_core","workspaceId":"workspace_test","projectId":"project_core","accountId":"account_owner","name":"成员","email":"owner@example.com","roles":["executor","project_owner"],"status":"active","createdAt":"2026-10-09T00:00:00Z","updatedAt":"2026-10-09T00:00:00Z"}`,
		"task":              `{"id":"task_core","workspaceId":"workspace_test","projectId":"project_core","project":"项目中文 🍅","title":"重要任务","notes":"正文\n第二行","tags":["乙","甲","乙"],"creatorMemberId":"member_core","primaryExecutorMemberId":"member_core","collaboratorMemberIds":["member_core"],"priority":"high","severity":"high","stage":"requirements","status":"pool","progressPercent":12.5,"progressNote":"进行中","estimatePomodoros":3,"actualPomodoros":1,"repeatRule":"weekly","repeatWeekdays":[5,1],"sortOrder":7,"subtasks":[{"id":"sub_b","title":"第二项","completed":false,"createdAt":"2026-10-09T00:00:00Z","extra":"保留"},{"id":"sub_a","title":"第一项","completed":true,"createdAt":"2026-10-09T00:00:00Z","completedAt":"2026-10-09T01:00:00Z"}],"estimateHistory":[{"id":"estimate_a","estimatedPomodoros":3,"actualPomodoros":1,"recordedAt":"2026-10-09T00:00:00Z","source":"manual"}],"createdAt":"2026-10-09T00:00:00Z","updatedAt":"2026-10-09T00:00:00Z"}`,
		"daily_plan":        `{"id":"plan_core","workspaceId":"workspace_test","ownerAccountId":"account_owner","date":"2026-10-09","capacityPomodoros":8,"completedPomodoros":1,"committedTaskIds":["task_core"],"suggestedTaskIds":[],"overloadAcknowledged":false,"reflection":"复盘","review":{"mood":"good","wins":"完成","blockers":"无","interruptionPattern":"无","tomorrowFocus":"继续","extra":"保留"},"createdAt":"2026-10-09T00:00:00Z","updatedAt":"2026-10-09T00:00:00Z"}`,
		"focus_session":     `{"id":"focus_core","taskId":"task_core","mode":"focus","duration":1500,"startedAt":"2026-10-09T00:00:00Z","endedAt":"2026-10-09T01:00:00Z","outcome":"completed","interruptionCounts":{"internal":1,"external":0}}`,
		"work_session":      `{"id":"work_core","ownerAccountId":"account_owner","taskId":"task_core","executorMemberId":"member_core","focusSessionId":"focus_core","status":"ended","startedAt":"2026-10-09T00:00:00Z","endedAt":"2026-10-09T01:00:00Z","resumedAt":"2026-10-09T00:30:00Z","totalPausedSeconds":15,"createdAt":"2026-10-09T00:00:00Z","updatedAt":"2026-10-09T01:00:00Z"}`,
		"execution_signal":  `{"id":"signal_core","workSessionId":"work_core","taskId":"task_core","executorMemberId":"member_core","type":"work_ended","createdAt":"2026-10-09T01:00:00Z","payload":{"custom":"事件扩展"}}`,
		"interruption":      `{"id":"interruption_core","taskId":"task_core","sessionId":"focus_core","type":"internal","action":"defer","note":"稍后处理","createdAt":"2026-10-09T01:00:00Z"}`,
		"reward_state":      `{"streak":2,"dailyGoal":8,"badges":["乙","甲"],"focusGarden":1,"visualProgress":3}`,
		"task_template":     `{"id":"template_core","name":"模板","description":"说明","project":"项目","tags":["测试"],"priority":"medium","severity":"medium","stage":"planning","estimatePomodoros":2,"subtasks":["乙","甲"],"repeatRule":"none"}`,
		"template_instance": `{"templateId":"template_core","taskId":"task_core","createdAt":"2026-10-09T01:00:00Z"}`,
	}
	rows := []businessRow{}
	for _, spec := range businessEntityTables {
		raw := json.RawMessage(samples[spec.entity])
		id := stringField(raw, "id")
		if id == "" {
			id = spec.entity + "_core"
		}
		rows = append(rows, businessRow{WorkspaceID: "workspace_test", AccountID: "account_owner", Entity: spec.entity, ID: id, UpdatedAt: "2026-10-09T01:00:00Z", Payload: raw})
	}
	return rows
}
func assertRelationalJSON(t *testing.T, want, got json.RawMessage) {
	t.Helper()
	var a, b any
	if err := json.Unmarshal(want, &a); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(got, &b); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(a, b) {
		t.Fatalf("business payload changed: want=%s got=%s", want, got)
	}
}
func TestRelationalStorageUsesCoreColumnsAndOrderedDetails(t *testing.T) {
	api := mysqlSeededApp(t)
	ctx := context.Background()
	rows := relationalFixtureRows()
	tx, err := api.db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer mysqlRollback(tx)
	for _, row := range rows {
		if err := businessUpsertRow(ctx, tx, row); err != nil {
			t.Fatal(err)
		}
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}
	for _, row := range rows {
		loaded, found, err := businessExistingRow(ctx, api.db, row.WorkspaceID, row.Entity, row.ID)
		if err != nil || !found {
			t.Fatalf("%s load: %v", row.Entity, err)
		}
		assertRelationalJSON(t, row.Payload, loaded.Payload)
		table, _ := businessTableForEntity(row.Entity)
		// A stale or empty compatibility snapshot must not erase core business data.
		if _, err := api.db.ExecContext(ctx, "UPDATE "+table.table+" SET payload = '{}' WHERE workspace_id = ? AND id = ?", row.WorkspaceID, row.ID); err != nil {
			t.Fatal(err)
		}
		loaded, found, err = businessExistingRow(ctx, api.db, row.WorkspaceID, row.Entity, row.ID)
		if err != nil || !found {
			t.Fatalf("%s core-only load: %v", row.Entity, err)
		}
		var expected map[string]json.RawMessage
		json.Unmarshal(row.Payload, &expected)
		delete(expected, "extension")
		delete(expected, "payload")
		if row.Entity == "daily_plan" {
			var review map[string]any
			json.Unmarshal(expected["review"], &review)
			delete(review, "extra")
			expected["review"], _ = json.Marshal(review)
		}
		want, _ := json.Marshal(expected)
		assertRelationalJSON(t, want, loaded.Payload)
	}
}
func TestRelationalWriteRejectsInvalidTypesAtomically(t *testing.T) {
	api := mysqlSeededApp(t)
	ctx := context.Background()
	row := relationalFixtureRows()[2]
	for _, patch := range []string{`{"title":42}`, `{"estimatePomodoros":"3"}`, `{"subtasks":[{"completed":"false"}]}`, `{"tags":[null]}`, `{"collaboratorMemberIds":{}}`} {
		next := row
		next.Payload, _ = applyBusinessMergePatch(row.Payload, json.RawMessage(patch))
		tx, err := api.db.BeginTx(ctx, nil)
		if err != nil {
			t.Fatal(err)
		}
		if err := businessUpsertRow(ctx, tx, next); err == nil {
			mysqlRollback(tx)
			t.Fatalf("accepted invalid core values: %s", patch)
		}
		mysqlRollback(tx)
		_, found, err := businessExistingRow(ctx, api.db, row.WorkspaceID, row.Entity, row.ID)
		if err != nil || found {
			t.Fatalf("failed write leaked a row: found=%v err=%v", found, err)
		}
	}
}

func TestRelationalSchemaCoversEditableDomainFields(t *testing.T) {
	for _, resource := range domainResourceSpecs {
		schema, ok := relationalEntities[resource.entity]
		if !ok {
			t.Fatalf("missing relational entity %s", resource.entity)
		}
		covered := map[string]bool{}
		for name := range schema.Fields {
			covered[name] = true
		}
		for _, name := range schema.Objects {
			covered[name] = true
		}
		for _, relation := range schema.Relations {
			covered[relation.Field] = true
		}
		for name := range resource.patchFields {
			// estimateHours is converted to estimatePomodoros before persistence.
			if resource.entity == "task" && name == "estimateHours" {
				continue
			}
			if !covered[name] {
				t.Errorf("editable field %s.%s has no relational storage", resource.entity, name)
			}
		}
	}
}
