#!/usr/bin/env python3
"""Enrich existing placeholders from verified export evidence without inventing history."""
import argparse
import collections
import copy
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("navicat_recovery", Path(__file__).with_name("recover-navicat-sql.py"))
recovery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recovery)

TABLES = {"business_projects": "project", "business_tasks": "task"}
STAGES = {"planning": "规划", "execution": "执行", "check": "检查", "sales": "销售",
          "requirements": "需求", "design": "设计", "development": "开发", "testing": "测试",
          "deployment": "部署", "acceptance": "验收"}
STATUSES = {"pool": "任务池", "committed": "已安排", "in_progress": "进行中", "pending_review": "待验收",
            "completed": "已完成", "split": "已拆分", "archived": "已归档"}


def key(table, data):
    return table, data["workspace_id"], data["id"]


def verified_project_names(records):
    snapshots = recovery.cached_snapshots(records)
    names = collections.defaultdict(lambda: collections.defaultdict(list))
    tasks = {key(r["table"], r["data"]): r["data"] for r in records if r["table"] == "business_tasks"}
    for (workspace, entity, identity), versions in snapshots.items():
        if entity != "task":
            continue
        data = tasks.get(("business_tasks", workspace, identity))
        if not data or data["updated_at"] not in versions:
            continue
        row = versions[data["updated_at"]]
        payload = recovery.validate_snapshot(data, entity, row)
        name = payload.get("project")
        if not isinstance(name, str) or not name.strip() or name.startswith("[待补全]"):
            continue
        names[(workspace, data["project_id"])][name].append(identity)
    return {k: {"value": next(iter(v)), "taskIds": sorted(next(iter(v.values()))),
                "source": "exact_cached_task_project_label"}
            for k, v in names.items() if len(v) == 1}


def build_plan(source, current_rows, now):
    _, records, _ = recovery.parse_dump(source)
    original = {key(r["table"], r["data"]): r["data"] for r in records if r["table"] in TABLES}
    names = verified_project_names(records)
    accounts = {r["data"]["id"]: r["data"].get("name", "") for r in records if r["table"] == "accounts"}
    projects = {(r["workspace_id"], r["id"]): r["payload"] for r in current_rows if r["table"] == "business_projects"}
    tasks_by_project = collections.defaultdict(list)
    linked = collections.defaultdict(collections.Counter)
    for record in records:
        data, table = record["data"], record["table"]
        if table == "business_tasks":
            tasks_by_project[(data["workspace_id"], data["project_id"])].append(data)
        elif table in ["business_focus_sessions", "business_work_sessions", "business_execution_signals"] and data.get("task_id"):
            linked[(data["workspace_id"], data["task_id"])][table] += 1
    changes, skipped, seen = [], [], set()
    for current in current_rows:
        table = current["table"]
        if table not in TABLES:
            raise ValueError("Current rows may contain only projects and tasks")
        identity = key(table, current)
        if identity in seen:
            raise ValueError("Duplicate current row identity")
        seen.add(identity)
        payload = current["payload"]
        marker = payload.get("recovery", {})
        if marker.get("source") != "navicat_missing_payload" or marker.get("originalPayloadAvailable") is not False:
            continue
        data = original.get(identity)
        if not data or payload.get("id") != current["id"] or payload.get("workspaceId") != current["workspace_id"]:
            raise ValueError("Placeholder identity does not match the export")
        if marker.get("enrichment"):
            skipped.append({"key": identity, "reason": "already_enriched"})
            continue
        if current["updated_at"] != data["updated_at"] or marker.get("retainedIndexes") != data:
            skipped.append({"key": identity, "reason": "changed_since_import"})
            continue
        for column in ["account_id", "project_id", "task_id", "status", "kind", "row_date"]:
            if current.get(column) != data.get(column):
                raise ValueError("Current indexes no longer match the export")
        next_payload = copy.deepcopy(payload)
        verified = {"indexDate": data.get("row_date"), "originalUpdatedAt": data["updated_at"],
                    "recordOwnerAccountId": data.get("account_id")}
        owner = accounts.get(data.get("account_id"))
        owner_line = f"记录所属账号：{owner}。" if owner else ""
        date_line = f"原 SQL 索引日期：{data['row_date']}；原记录更新时间：{data['updated_at']}。"
        if table == "business_projects":
            project_key = (data["workspace_id"], data["id"])
            evidence = names.get(project_key)
            expected_name = f"[待补全] {evidence['value'] if evidence else '历史项目 ' + data['id'][-8:]}"
            if payload.get("name") != expected_name or payload.get("description") != recovery.NOTICE:
                skipped.append({"key": identity, "reason": "placeholder_text_edited"})
                continue
            if evidence:
                next_payload["name"] = evidence["value"]
                verified["name"] = evidence
            tasks = tasks_by_project[project_key]
            status_counts = collections.Counter(t["status"] for t in tasks)
            summary = "、".join(f"{STATUSES.get(s, s)} {count} 条" for s, count in sorted(status_counts.items()))
            next_payload["description"] = ("原始项目说明待补全。已核实关联任务 "
                + f"{len(tasks)} 条" + (f"（{summary}）" if summary else "") + "。"
                + ("项目目标、默认工时和阶段配置尚未恢复。" if evidence else "原项目名称、项目目标、默认工时和阶段配置尚未恢复。"))
            verified["taskCountInExport"] = len(tasks)
        else:
            if payload.get("notes") != recovery.NOTICE or payload.get("title") != f"[待补全] 历史任务 {data['id'][-8:]}" or payload.get("status") != data["status"] or payload.get("stage") != data["kind"]:
                skipped.append({"key": identity, "reason": "placeholder_text_edited"})
                continue
            project_key = (data["workspace_id"], data["project_id"])
            if project_key not in projects:
                raise ValueError("Task has no current project in the same workspace")
            evidence = names.get(project_key)
            current_name = projects[project_key]["name"]
            project_name = evidence["value"] if evidence and current_name == "[待补全] " + evidence["value"] else current_name
            next_payload["project"] = project_name
            verified.update(projectId=data["project_id"], status=data["status"], stage=data["kind"])
            if evidence and project_name == evidence["value"]:
                verified["projectName"] = evidence
            counts = linked[(data["workspace_id"], data["id"])]
            verified["linkedRowsInExport"] = dict(counts)
            next_payload["notes"] = ("原始任务标题和说明缺失，待补全。\n"
                + f"所属项目：{project_name}；状态：{STATUSES.get(data['status'], data['status'])}；阶段：{STAGES.get(data['kind'], data['kind'])}。\n"
                + owner_line + "\n" + date_line + "\n"
                + f"原 SQL 关联记录：专注 {counts['business_focus_sessions']} 条、工作 {counts['business_work_sessions']} 条、执行信号 {counts['business_execution_signals']} 条。\n"
                + "所属账号不代表原负责人；关联记录数量不代表工时。负责人、估时、实际工时和完整创建时间仍待补全。")
        next_payload["updatedAt"] = now
        next_payload["recovery"]["enrichment"] = {"source": "verified_export_relationships", "appliedAt": now,
            "verifiedFields": verified, "originalDescriptionAvailable": False}
        changes.append({"table": table, "workspace_id": data["workspace_id"], "id": data["id"],
                        "before": current, "after": next_payload, "updated_at": now})
    return {"source_sha256": hashlib.sha256(source.encode()).hexdigest(), "created_at": now,
            "changes": changes, "skipped": skipped,
            "summary": {"rows": len(changes), "project_names": sum("name" in c["after"]["recovery"]["enrichment"]["verifiedFields"] for c in changes),
                        "projects": sum(c["table"] == "business_projects" for c in changes),
                        "tasks": sum(c["table"] == "business_tasks" for c in changes)},
            "limitations": ["No missing task title, original description, assignment, permissions or work duration is inferred.",
                            "Descriptions contain verified export context, not restored original text.",
                            "Recovery flags remain incomplete; original SQL indexes and backup preimages are retained."]}


def guarded_sql(plan):
    # Run with mysql in batch mode, without --force: any failed guard disconnects and rolls back.
    lines = ["-- Apply to the selected database using mysql WITHOUT --force; any failed guard must abort the session.",
             "CREATE TEMPORARY TABLE tm_recovery_guard (ok INT NOT NULL CHECK (ok = 1));", "START TRANSACTION;"]
    for change in plan["changes"]:
        if change["table"] not in TABLES:
            raise ValueError("Unsupported target table")
        table, before = change["table"], change["before"]
        where = f"workspace_id = {recovery.sql_text(change['workspace_id'])} AND id = {recovery.sql_text(change['id'])}"
        lines.append(f"SELECT id FROM {table} WHERE {where} FOR UPDATE;")
        lines.append(f"INSERT INTO tm_recovery_guard SELECT IF(COUNT(*) = 1, 1, 0) FROM {table} WHERE {where} "
                     + f"AND BINARY updated_at = BINARY {recovery.sql_text(before['updated_at'])} "
                     + "".join(f"AND {column} <=> {recovery.sql_text(value) if value is not None else 'NULL'} "
                               for column, value in before["payload"]["recovery"]["retainedIndexes"].items()
                               if column in ["account_id", "project_id", "task_id", "account_ref", "status", "kind", "row_date"])
                     + f"AND payload = CAST({recovery.json_sql(before['payload'])} AS JSON);")
    for change in plan["changes"]:
        where = f"workspace_id = {recovery.sql_text(change['workspace_id'])} AND id = {recovery.sql_text(change['id'])}"
        lines.append(f"UPDATE {change['table']} SET payload = {recovery.json_sql(change['after'])}, "
                     + f"updated_at = {recovery.sql_text(change['updated_at'])} WHERE {where};")
        lines.append("INSERT INTO tm_recovery_guard VALUES (IF(ROW_COUNT() = 1, 1, 0));")
    lines += ["COMMIT;", "DROP TEMPORARY TABLE tm_recovery_guard;"]
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--current", type=Path, required=True, help="JSONL of current projects/tasks, including SQL indexes and payload")
    parser.add_argument("--plan", type=Path, required=True)
    parser.add_argument("--sql", type=Path, required=True)
    args = parser.parse_args()
    if args.plan.exists() or args.sql.exists():
        parser.error("Outputs must be new files")
    source = args.input.read_bytes()
    rows = [json.loads(line) for line in args.current.read_text().splitlines() if line.strip()]
    plan = build_plan(source.decode("utf-8-sig"), rows, datetime.now(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z"))
    plan["source_sha256"] = hashlib.sha256(source).hexdigest()
    recovery.private_write(args.plan, json.dumps(plan, ensure_ascii=False, indent=2) + "\n")
    recovery.private_write(args.sql, guarded_sql(plan))
    print(json.dumps(plan["summary"], ensure_ascii=False))


if __name__ == "__main__":
    main()
