#!/usr/bin/env python3
"""Repair a Navicat export offline; preserve original snapshots and label missing data."""
import argparse
import collections
import hashlib
import json
import os
from pathlib import Path
import re

INSERT = re.compile(r"^INSERT INTO `([\w]+)` VALUES \((.*)\);\s*$")
TABLE = re.compile(r"CREATE TABLE `([\w]+)` \((.*?)\n\) ENGINE=", re.S)
ENTITIES = {
    "business_projects": "project", "business_project_members": "project_member",
    "business_tasks": "task", "business_daily_plans": "daily_plan",
    "business_focus_sessions": "focus_session", "business_work_sessions": "work_session",
    "business_execution_signals": "execution_signal", "business_reward_state": "reward_state",
    "business_interruptions": "interruption", "business_task_templates": "task_template",
    "business_template_instances": "template_instance",
}
NOTICE = "原 SQL 缺少业务 JSON；此记录仅保留可核实的索引信息，缺失详情需人工补全。"


def split_values(source):
    result, start, index, quoted = [], 0, 0, False
    while index < len(source):
        char = source[index]
        if quoted and char == "\\":
            index += 2
            continue
        if char == "'":
            if quoted and index + 1 < len(source) and source[index + 1] == "'":
                index += 2
                continue
            quoted = not quoted
        elif char == "," and not quoted:
            result.append(source[start:index].strip())
            start = index + 1
        index += 1
    if quoted:
        raise ValueError("Unterminated SQL string")
    result.append(source[start:].strip())
    return result


def decode_literal(token):
    if token.lower() == "null":
        return None
    if re.fullmatch(r"-?\d+(?:\.\d+)?", token):
        return json.loads(token)
    if not (token.startswith("'") and token.endswith("'")):
        raise ValueError("Unsupported SQL literal; only quoted strings, numbers and NULL are accepted")
    source, result, index = token[1:-1], [], 0
    escapes = {"0": "\0", "b": "\b", "n": "\n", "r": "\r", "t": "\t", "Z": "\x1a"}
    while index < len(source):
        char = source[index]
        if char == "\\":
            index += 1
            if index == len(source):
                raise ValueError("Unterminated SQL escape")
            result.append(escapes.get(source[index], source[index]))
        elif char == "'" and index + 1 < len(source) and source[index + 1] == "'":
            result.append("'")
            index += 1
        else:
            result.append(char)
        index += 1
    return "".join(result)


def sql_text(value):
    # Hex UTF-8 avoids changing JSON escapes under different SQL modes.
    return "_utf8mb4 X'" + value.encode("utf-8").hex() + "'"


def json_sql(value):
    return sql_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")))


def parse_dump(source):
    if re.search(r"(?im)^\s*(?:USE\s|(?:CREATE|DROP)\s+DATABASE|(?:CREATE|ALTER)\s+USER|GRANT\s|SET\s+(?:GLOBAL|@@GLOBAL))", source):
        raise ValueError("Export must not modify databases, users or global server settings")
    schemas = {}
    for match in TABLE.finditer(source):
        columns = re.findall(r"^\s+`(\w+)`\s+(\w+)", match[2], re.M)
        schemas[match[1]] = columns
    if not schemas:
        raise ValueError("No supported CREATE TABLE statements")
    records, lines = [], source.splitlines(keepends=True)
    for index, line in enumerate(lines):
        if not line.lstrip().upper().startswith("INSERT"):
            continue
        match = INSERT.fullmatch(line)
        if not match or match[1] not in schemas:
            raise ValueError(f"Unsupported INSERT at line {index + 1}")
        table, tokens = match[1], split_values(match[2])
        columns = [name for name, _ in schemas[table]]
        missing = None
        if len(tokens) == len(columns) - 1:
            if table in ENTITIES:
                missing = "payload"
            elif table == "account_settings":
                missing = "updated_at"
            elif table == "idempotency_keys":
                missing = "created_at"
            else:
                raise ValueError(f"Unknown missing column in {table}")
        elif len(tokens) != len(columns):
            raise ValueError(f"Unexpected value count in {table} at line {index + 1}")
        present = [column for column in columns if column != missing]
        data = dict(zip(present, map(decode_literal, tokens)))
        for column, kind in schemas[table]:
            if kind.lower() == "json" and column in data:
                data[column] = json.loads(data[column])
        records.append({"line": index, "table": table, "tokens": dict(zip(present, tokens)),
                        "data": data, "missing": missing})
    return schemas, records, lines


def payload_key(row):
    return row.get("workspace_id"), row.get("entity"), row.get("id")


def cached_snapshots(records):
    result = collections.defaultdict(dict)
    for record in records:
        if record["table"] != "idempotency_keys":
            continue
        response = record["data"]["response_body"]
        if not isinstance(response, dict):
            raise ValueError("Cached response must be a JSON object")
        for row in response.get("rows", []):
            if not isinstance(row.get("payload"), dict):
                raise ValueError("Cached business payload must be a JSON object")
            key, timestamp = payload_key(row), row.get("updated_at")
            if not all(key) or not timestamp:
                raise ValueError("Cached row is missing identity or timestamp")
            previous = result[key].get(timestamp)
            if previous and previous["payload"] != row["payload"]:
                raise ValueError("Conflicting cached payloads at the same identity and timestamp")
            result[key][timestamp] = row
    return result


def validate_snapshot(data, entity, snapshot):
    payload = snapshot["payload"]
    if payload.get("id") != data["id"] or payload.get("workspaceId") != data["workspace_id"]:
        raise ValueError("Cached payload identity does not match SQL indexes")
    checks = {"project_id": data["id"] if entity == "project" else payload.get("projectId"),
              "task_id": data["id"] if entity == "task" else payload.get("taskId"),
              "status": payload.get("status") or payload.get("outcome"),
              "kind": next((payload.get(key) for key in ["stage", "mode", "type", "priority", "severity"] if payload.get(key)), None)}
    for column, value in checks.items():
        if (data.get(column) or None) != (value or None):
            raise ValueError(f"Cached {entity} payload conflicts with SQL {column}")
    if snapshot.get("account_id") != data.get("account_id"):
        raise ValueError("Cached row owner does not match SQL owner")
    return payload


def placeholder_payload(data, entity, accounts, project_labels):
    timestamp, identity = data["updated_at"], data["id"]
    payload = {"id": identity, "workspaceId": data["workspace_id"],
               "createdAt": timestamp, "updatedAt": timestamp}
    marker = {"source": "navicat_missing_payload", "originalPayloadAvailable": False,
              "notice": NOTICE, "retainedIndexes": data.copy()}
    payload["recovery"] = marker
    if entity == "project":
        hint = project_labels.get((data["workspace_id"], identity))
        payload.update(name=f"[待补全] {hint or ('历史项目 ' + identity[-8:])}", description=NOTICE,
                       defaultExpectedStartHours=0, taskStageMode="regular", sortOrder=0)
    elif entity == "project_member":
        account = accounts.get(data.get("account_ref"), {})
        payload.update(projectId=data["project_id"], name=account.get("name") or f"[待补全] 历史成员 {identity[-8:]}",
                       roles=[], status=data.get("status") or "disabled")
        if account:
            payload.update(accountId=account["id"], email=account["email"])
    elif entity == "task":
        payload.update(projectId=data["project_id"], project=project_labels.get((data["workspace_id"], data["project_id"]), "[待补全] 历史项目"),
                       title=f"[待补全] 历史任务 {identity[-8:]}", notes=NOTICE, tags=["待补全"],
                       status=data["status"], stage=data["kind"], priority="medium", severity="medium",
                       estimatePomodoros=0, actualPomodoros=0, sortOrder=0, subtasks=[], estimateHistory=[],
                       collaboratorMemberIds=[], repeatRule="none")
    elif entity == "daily_plan":
        payload.update(ownerAccountId=data["account_id"], date=data["row_date"], capacityPomodoros=0,
                       completedPomodoros=0, committedTaskIds=[], suggestedTaskIds=[], reflection=NOTICE,
                       review={"mood": "normal", "wins": "", "blockers": NOTICE, "interruptionPattern": "", "tomorrowFocus": ""})
    elif entity == "focus_session":
        payload.update(mode=data["kind"], duration=0, startedAt=timestamp, endedAt=timestamp,
                       interruptionCounts={"internal": 0, "external": 0})
        if data.get("status"):
            payload["outcome"] = data["status"]
    elif entity == "work_session":
        if data["status"] != "ended":
            raise ValueError("Cannot reconstruct an active work session without its timer payload")
        payload.update(ownerAccountId=data["account_id"], taskId=data["task_id"], focusSessionId="",
                       status="ended", startedAt=timestamp, endedAt=timestamp, totalPausedSeconds=0)
    elif entity == "execution_signal":
        payload.update(taskId=data["task_id"], type=data["kind"], workSessionId="", createdAt=timestamp)
    elif entity == "reward_state":
        payload.update(streak=0, dailyGoal=0, badges=[], focusGarden=0, visualProgress=0)
    else:
        raise ValueError(f"No safe placeholder model for {entity}")
    if data.get("task_id") and entity != "task":
        payload["taskId"] = data["task_id"]
    return payload


def repair_dump(source, allow_placeholders=False):
    schemas, records, lines = parse_dump(source)
    snapshots = cached_snapshots(records)
    accounts = {r["data"]["id"]: r["data"] for r in records if r["table"] == "accounts"}
    project_labels = {}
    for (workspace, entity, _), versions in snapshots.items():
        if entity != "task":
            continue
        payload = versions[max(versions)]["payload"]
        if payload.get("projectId") and payload.get("project"):
            project_labels[(workspace, payload["projectId"])] = payload["project"]
    counts = collections.defaultdict(collections.Counter)
    decisions = []
    for record in records:
        table, data, missing = record["table"], record["data"], record["missing"]
        counts[table]["source_rows"] += 1
        if not missing:
            counts[table]["unchanged"] += 1
            continue
        tokens, decision = record["tokens"].copy(), {}
        if missing == "payload":
            entity = ENTITIES[table]
            snapshot = snapshots[(data["workspace_id"], entity, data["id"])].get(data["updated_at"])
            if snapshot:
                payload = validate_snapshot(data, entity, snapshot)
                method = "exact_cached_snapshot"
            else:
                if not allow_placeholders:
                    raise ValueError("Some payloads have no exact snapshot; review the loss and explicitly use --allow-placeholders")
                payload = placeholder_payload(data, entity, accounts, project_labels)
                method = "indexed_placeholder"
            tokens[missing] = json_sql(payload)
            decision = {"table": table, "workspace_id": data["workspace_id"], "id": data["id"], "method": method}
            counts[table][method] += 1
        else:
            if table == "idempotency_keys":
                timestamp = data["response_body"].get("server_time")
                if not timestamp:
                    timestamp = max((row.get("updated_at", "") for row in data["response_body"].get("rows", [])), default="")
                if not timestamp:
                    timestamp = accounts.get(data["account_id"], {}).get("updated_at")
            else:
                timestamp = accounts.get(data["account_id"], {}).get("updated_at")
            if not timestamp:
                raise ValueError(f"No documented timestamp source for {table}")
            tokens[missing] = sql_text(timestamp)
            counts[table]["derived_metadata_timestamp"] += 1
            decision = {"table": table, "account_id": data["account_id"], "method": "derived_metadata_timestamp", "column": missing}
        columns = [name for name, _ in schemas[table]]
        lines[record["line"]] = "INSERT INTO `" + table + "` (" + ", ".join("`" + c + "`" for c in columns) + ") VALUES (" + ", ".join(tokens[c] for c in columns) + ");\n"
        decisions.append(decision)
    output = "-- Repaired offline; import only into a new candidate database. Original export remains unchanged.\n" + "".join(lines)
    report = {"source_sha256": hashlib.sha256(source.encode()).hexdigest(),
              "repaired_sha256": hashlib.sha256(output.encode()).hexdigest(),
              "allow_placeholders": allow_placeholders, "tables": {t: dict(c) for t, c in counts.items()},
              "limitations": ["Only snapshots with exact identity, owner, timestamp and indexed fields are restored as original payloads.",
                              "Placeholder names and zero numeric defaults are not recovered business values.",
                              "Placeholder roles are empty; no missing management permission is inferred.",
                              "Missing metadata timestamps use server_time, latest returned row time, or the owning account timestamp; these are inferred, not original export values."],
              "decisions": decisions}
    return output, report


def private_write(path, content):
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8", newline="") as file:
        file.write(content)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--allow-placeholders", action="store_true")
    args = parser.parse_args()
    if args.output.exists() or args.report.exists():
        parser.error("Output and report must be new files")
    raw = args.input.read_bytes()
    output, report = repair_dump(raw.decode("utf-8-sig"), args.allow_placeholders)
    report["source_sha256"] = hashlib.sha256(raw).hexdigest()
    private_write(args.output, output)
    private_write(args.report, json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"source_sha256": report["source_sha256"], "repaired_sha256": report["repaired_sha256"], "tables": report["tables"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
