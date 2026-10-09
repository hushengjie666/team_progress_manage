import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import sys

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("recovery", Path(__file__).with_name("recover-navicat-sql.py"))
recovery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recovery)

BUSINESS_COLUMNS = ["workspace_id", "id", "account_id", "project_id", "task_id", "account_ref",
                    "status", "kind", "row_date", "updated_at", "payload"]


def literal(value):
    if value is None:
        return "NULL"
    return "'" + str(value).replace("\\", "\\\\").replace("'", "\\'") + "'"


def table(name, columns):
    fields = [f"  `{column}` {'json' if column in ['payload', 'response_body'] else 'varchar(128)'} NOT NULL"
              for column in columns]
    return f"CREATE TABLE `{name}` (\n" + ",\n".join(fields) + "\n) ENGINE=InnoDB;\n"


def insert(name, values):
    return f"INSERT INTO `{name}` VALUES (" + ", ".join(map(literal, values)) + ");\n"


def task_dump(cached_time="2026-10-09T01:00:00Z", status="completed"):
    timestamp = "2026-10-09T01:00:00Z"
    payload = {"id": "task_1", "workspaceId": "workspace_1", "projectId": "project_1",
               "title": "保留引号 '、逗号, 和反斜线 " + chr(92), "status": status, "stage": "planning",
               "updatedAt": cached_time, "actualPomodoros": 3}
    response = {"rows": [{"workspace_id": "workspace_1", "account_id": "account_1", "entity": "task",
                          "id": "task_1", "updated_at": cached_time, "payload": payload}],
                "server_time": timestamp}
    source = table("business_tasks", BUSINESS_COLUMNS)
    source += insert("business_tasks", ["workspace_1", "task_1", "account_1", "project_1", "task_1",
                                        "account_1", "completed", "planning", "2026-10-09", timestamp])
    source += table("idempotency_keys", ["account_id", "idempotency_key", "request_path", "response_status", "response_body", "created_at"])
    source += insert("idempotency_keys", ["account_1", "accept_1", "/tasks/task_1/accept-review", 200, json.dumps(response, ensure_ascii=False)])
    return source, payload


class RecoveryTests(unittest.TestCase):
    def test_sql_escaping_and_column_boundaries(self):
        tokens = recovery.split_values("'it\\'s, quoted', NULL, 'a\\\\b', 'double''quote'")
        self.assertEqual(list(map(recovery.decode_literal, tokens)), ["it's, quoted", None, "a\\b", "double'quote"])
        with self.assertRaises(ValueError):
            recovery.split_values("'unterminated")

    def test_restores_exact_original_snapshot_without_placeholder(self):
        source, payload = task_dump()
        output, report = recovery.repair_dump(source)
        self.assertIn(recovery.json_sql(payload), output)
        self.assertEqual(report["tables"]["business_tasks"]["exact_cached_snapshot"], 1)
        self.assertNotIn("indexed_placeholder", report["tables"]["business_tasks"])
        self.assertIn("`created_at`", output)

    def test_rejects_index_conflict_despite_equal_timestamp(self):
        source, _ = task_dump(status="pool")
        with self.assertRaisesRegex(ValueError, "conflicts with SQL status"):
            recovery.repair_dump(source, True)

    def test_does_not_treat_stale_snapshot_as_original(self):
        source, payload = task_dump(cached_time="2026-10-08T01:00:00Z")
        with self.assertRaisesRegex(ValueError, "allow-placeholders"):
            recovery.repair_dump(source)
        output, report = recovery.repair_dump(source, True)
        self.assertEqual(report["tables"]["business_tasks"]["indexed_placeholder"], 1)
        decision = next(d for d in report["decisions"] if d["table"] == "business_tasks")
        self.assertEqual(decision["method"], "indexed_placeholder")
        self.assertNotIn(recovery.json_sql(payload), output.split("INSERT INTO `idempotency_keys`")[0])

    def test_preserves_settings_json_and_accounts(self):
        source = table("accounts", ["id", "name", "email", "password_hash", "updated_at"])
        account_row = insert("accounts", ["account_1", "Owner", "owner@example.invalid", "hash_unchanged", "2026-10-09T01:00:00Z"])
        source += account_row + table("account_settings", ["account_id", "payload", "updated_at"])
        source += insert("account_settings", ["account_1", '{"timerEndSoundRepeats":2}'])
        output, report = recovery.repair_dump(source)
        self.assertIn(account_row, output)
        self.assertIn("'{\"timerEndSoundRepeats\":2}'", output)
        self.assertEqual(report["tables"]["account_settings"]["derived_metadata_timestamp"], 1)

    def test_placeholder_does_not_grant_unknown_member_roles(self):
        data = {"id": "member_1", "workspace_id": "workspace_1", "project_id": "project_1", "account_ref": "account_1",
                "status": "active", "updated_at": "2026-10-09T01:00:00Z"}
        payload = recovery.placeholder_payload(data, "project_member", {"account_1": {"id": "account_1", "name": "Known", "email": "known@example.invalid"}}, {})
        self.assertEqual(payload["roles"], [])
        self.assertEqual(payload["accountId"], "account_1")
        self.assertFalse(payload["recovery"]["originalPayloadAvailable"])

    def test_rejects_active_session_and_global_database_operations(self):
        with self.assertRaisesRegex(ValueError, "active work session"):
            recovery.placeholder_payload({"id": "session_1", "workspace_id": "workspace_1", "updated_at": "2026-10-09T01:00:00Z", "status": "active"}, "work_session", {}, {})
        source, _ = task_dump()
        with self.assertRaisesRegex(ValueError, "must not modify databases"):
            recovery.repair_dump("DROP DATABASE other_app;\n" + source)

    def test_private_output_never_overwrites_existing_file(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "output.sql"
            recovery.private_write(path, "original")
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
            with self.assertRaises(FileExistsError):
                recovery.private_write(path, "replacement")
            self.assertEqual(path.read_text(), "original")


if __name__ == "__main__":
    unittest.main()
