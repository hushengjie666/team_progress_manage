import copy
import importlib.util
import json
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("enrichment", Path(__file__).with_name("enrich-navicat-recovery.py"))
enrichment = importlib.util.module_from_spec(spec)
spec.loader.exec_module(enrichment)
spec = importlib.util.spec_from_file_location("fixtures", Path(__file__).with_name("test_recover_navicat_sql.py"))
fixtures = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixtures)
recovery = enrichment.recovery
TIME = "2026-10-09T01:00:00Z"
NOW = "2026-10-09T02:00:00Z"


def fixture():
    source, payload = fixtures.task_dump()
    payload.update(project="真实项目", notes="原始说明", createdAt=TIME)
    source = source[:source.index("CREATE TABLE `idempotency_keys`")]
    source += fixtures.table("business_projects", fixtures.BUSINESS_COLUMNS)
    source += fixtures.insert("business_projects", ["workspace_1", "project_1", "account_1", "project_1", None,
                               "account_1", None, None, "2026-10-09", TIME])
    source += fixtures.insert("business_tasks", ["workspace_1", "task_2", "account_1", "project_1", "task_2",
                               "account_1", "pool", "planning", "2026-10-09", TIME])
    response = {"rows": [{"workspace_id": "workspace_1", "account_id": "account_1", "entity": "task", "id": "task_1",
                          "updated_at": TIME, "payload": payload}], "server_time": TIME}
    source += fixtures.table("idempotency_keys", ["account_id", "idempotency_key", "request_path", "response_status", "response_body", "created_at"])
    source += fixtures.insert("idempotency_keys", ["account_1", "cache", "/tasks/task_1", 200, json.dumps(response)])
    _, records, _ = recovery.parse_dump(source)
    current = []
    for record in records:
        if record["table"] not in enrichment.TABLES:
            continue
        data = record["data"]
        if data["id"] == "task_1":
            p = payload
        else:
            p = recovery.placeholder_payload(data, enrichment.TABLES[record["table"]], {}, {("workspace_1", "project_1"): "真实项目"})
        current.append({"table": record["table"], **copy.deepcopy(data), "payload": copy.deepcopy(p)})
    return source, current


class EnrichmentTests(unittest.TestCase):
    def test_recovers_name_and_context_without_inventing_missing_task_details(self):
        source, current = fixture()
        plan = enrichment.build_plan(source, current, NOW)
        self.assertEqual(plan["summary"], {"rows": 2, "project_names": 1, "projects": 1, "tasks": 1})
        project = next(c["after"] for c in plan["changes"] if c["table"] == "business_projects")
        task = next(c["after"] for c in plan["changes"] if c["table"] == "business_tasks")
        self.assertEqual(project["name"], "真实项目")
        self.assertEqual(task["title"], "[待补全] 历史任务 task_2")
        self.assertNotIn("primaryExecutorMemberId", task)
        self.assertEqual(task["actualPomodoros"], 0)
        self.assertIn("索引日期", task["notes"])
        self.assertFalse(project["recovery"]["originalPayloadAvailable"])
        self.assertEqual(project["recovery"]["retainedIndexes"], current[1]["payload"]["recovery"]["retainedIndexes"])
        self.assertEqual(current, fixture()[1])

    def test_changed_rows_and_user_text_are_preserved(self):
        source, current = fixture()
        current[1]["payload"]["name"] = "用户新名称"
        current[2]["updated_at"] = NOW
        plan = enrichment.build_plan(source, current, NOW)
        self.assertEqual(plan["changes"], [])
        self.assertEqual({s["reason"] for s in plan["skipped"]}, {"placeholder_text_edited", "changed_since_import"})

    def test_task_context_uses_current_project_name_after_user_rename(self):
        source, current = fixture()
        current[1]["payload"]["name"] = "用户新名称"
        plan = enrichment.build_plan(source, current, NOW)
        self.assertEqual(plan["changes"][0]["after"]["project"], "用户新名称")
        self.assertNotIn("projectName", plan["changes"][0]["after"]["recovery"]["enrichment"]["verifiedFields"])

    def test_never_uses_a_project_from_another_workspace(self):
        source, current = fixture()
        current[1]["workspace_id"] = "other_workspace"
        current[1]["payload"]["workspaceId"] = "other_workspace"
        with self.assertRaisesRegex(ValueError, "identity"):
            enrichment.build_plan(source, current, NOW)

    def test_inconsistent_indexes_and_duplicate_rows_abort(self):
        source, current = fixture()
        current[2]["status"] = "completed"
        with self.assertRaisesRegex(ValueError, "indexes"):
            enrichment.build_plan(source, current, NOW)
        source, current = fixture()
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            enrichment.build_plan(source, current + [current[0]], NOW)

    def test_conflicting_project_names_are_not_resolved_by_guessing(self):
        source, _ = fixture()
        _, records, _ = recovery.parse_dump(source)
        task = copy.deepcopy(next(r for r in records if r["table"] == "business_tasks" and r["data"]["id"] == "task_1"))
        task["data"].update(id="task_3", task_id="task_3")
        cache = copy.deepcopy(next(r for r in records if r["table"] == "idempotency_keys"))
        row = cache["data"]["response_body"]["rows"][0]
        row["id"] = "task_3"
        row["payload"].update(id="task_3", project="不同名称")
        self.assertNotIn(("workspace_1", "project_1"), enrichment.verified_project_names(records + [task, cache]))

    def test_stale_project_label_is_not_used(self):
        source, _ = fixture()
        _, records, _ = recovery.parse_dump(source)
        next(r for r in records if r["table"] == "business_tasks")["data"]["updated_at"] = NOW
        self.assertEqual(enrichment.verified_project_names(records), {})

    def test_sql_locks_and_checks_every_preimage_before_updating(self):
        source, current = fixture()
        plan = enrichment.build_plan(source, current, NOW)
        sql = enrichment.guarded_sql(plan)
        self.assertEqual(sql.count("FOR UPDATE;"), 2)
        self.assertIn("CHECK (ok = 1)", sql)
        self.assertIn("AND payload = CAST", sql)
        self.assertIn("account_ref <=>", sql)
        self.assertLess(sql.rindex("AND payload = CAST"), sql.index("UPDATE business_"))
        self.assertTrue(sql.endswith("DROP TEMPORARY TABLE tm_recovery_guard;\n"))
        self.assertNotIn("DROP TABLE", sql)

    def test_enrichment_is_idempotent(self):
        source, current = fixture()
        plan = enrichment.build_plan(source, current, NOW)
        for change in plan["changes"]:
            row = next(r for r in current if r["table"] == change["table"] and r["id"] == change["id"])
            row["payload"] = change["after"]
            row["updated_at"] = NOW
        self.assertEqual(enrichment.build_plan(source, current, NOW)["changes"], [])


if __name__ == "__main__":
    unittest.main()
