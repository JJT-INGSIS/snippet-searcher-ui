"""Real lint races and recovery; requires an isolated local Compose project with workers enabled."""

import argparse
import json
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--base-url", default="http://127.0.0.1:18080")
parser.add_argument("--compose-dir", type=Path, required=True)
parser.add_argument("--project", required=True)
parser.add_argument("--control", type=Path, required=True)
parser.add_argument("--evidence", type=Path, required=True)
parser.add_argument(
    "--phase", choices=["prepare", "code-race", "rules-race", "recovery"], required=True
)
args = parser.parse_args()
assert args.project.startswith("sni75-sni37-")
assert urllib.parse.urlsplit(args.base_url).hostname in ("127.0.0.1", "localhost")
owner = "dev-juanfran"
command = ["docker", "compose", "--project-directory", str(args.compose_dir)]
for file in ("compose.yaml", "compose.redis.yaml", "acceptance.yaml"):
    command += ["-f", str(args.compose_dir / file)]
command += ["-p", args.project, "--profile", "assets"]
seen = args.control.with_suffix(".seen.json")
rule = {"mandatory-variable-or-literal-in-println": True}
record = json.loads(args.evidence.read_text()) if args.evidence.exists() else {}


def compose(*values, input=None):
    return subprocess.run(
        [*command, *values], input=input, text=True, capture_output=True, check=True
    ).stdout.strip()


def sql(query):
    return compose(
        "exec",
        "-T",
        "snippets-db",
        "psql",
        "-U",
        "snippets",
        "-d",
        "snippets",
        "-At",
        "-c",
        query,
    )


def api(method, path, body=None, expected=200):
    request = urllib.request.Request(
        args.base_url + path,
        method=method,
        data=None if body is None else json.dumps(body).encode(),
        headers={
            "X-Dev-Actor-Id": owner,
            "Content-Type": "application/json",
            "Idempotency-Key": str(uuid.uuid4()),
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            status, raw = response.status, response.read()
    except urllib.error.HTTPError as error:
        status, raw = error.code, error.read()
    assert status == expected, (path, status, raw[:1000])
    return json.loads(raw) if raw else None


def wait(check, seconds=120):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        value = check()
        if value:
            return value
        time.sleep(0.05)
    raise AssertionError("Timed out waiting for explicit condition")


def health():
    try:
        return api("GET", "/languages")
    except (OSError, AssertionError):
        return None


def control(value):
    temporary = args.control.with_suffix(".tmp")
    temporary.write_text(json.dumps(value))
    temporary.replace(args.control)


def rules(selection):
    value = api("PUT", "/linting-rules/printscript/1.1", {"rules": selection})
    assert value["changed"] and value["jobId"], value
    return value


def done(id):
    def terminal():
        value = api("GET", "/jobs/" + id)
        return (
            value
            if value["status"] in ("COMPLETED", "PARTIAL", "FAILED", "SUPERSEDED")
            else None
        )

    return wait(terminal, 180)


def settled(selection):
    current = api("GET", "/linting-rules/printscript/1.1")
    effective = {
        r["id"]: r["value"]
        for r in current["rules"]
        if r["value"] is not None and r["value"] is not False
    }
    if effective != selection:
        assert done(rules(selection)["jobId"])["status"] == "COMPLETED"


def create(label, code):
    return api(
        "POST",
        "/snippets",
        {
            "name": label,
            "description": None,
            "language": "printscript",
            "version": "1.1",
            "code": code,
        },
        201,
    )["id"]


def prepare():
    settled({})
    prefix = "SNI37-batch-" + uuid.uuid4().hex[:8]
    ids = [create(prefix + "-" + str(i), "println(1+2);") for i in range(12)]
    return {"prefix": prefix, "ids": ids, "owner": owner}


def gated():
    def observed():
        if seen.exists():
            value = json.loads(seen.read_text())
            return value if value["stage"] == "lintGate" else None
        return None

    return wait(observed)


def race(code_change):
    settled({})
    marker = "SNI37-race-" + uuid.uuid4().hex[:8]
    old = 'println("' + marker + '");println(1+2);'
    new = "println(1);"
    id = create(marker, old)
    if seen.exists():
        seen.unlink()
    # Hold only requests containing the unique old snapshot; the edited code is not gated.
    control({"lintGate": marker, "holdSeconds": 25})
    first = rules(rule)
    held = gated()
    assert held["code"] == old
    if code_change:
        api(
            "PUT",
            "/snippets/" + id,
            {
                "name": marker,
                "description": None,
                "language": "printscript",
                "version": "1.1",
                "code": new,
            },
        )
        winning = first
    else:
        winning = rules({})
    confirmed = time.time()
    assert confirmed < held["at"] + 25, "change did not commit before gate deadline"
    control({})
    terminal = done(winning["jobId"])
    assert terminal["status"] == "COMPLETED", terminal
    previous = done(first["jobId"])
    value = api("GET", "/snippets/" + id)
    assert (
        value["lint"]["status"] == "compliant" and value["lint"]["diagnostics"] == []
    ), value
    assert value["code"] == (new if code_change else old)
    assert value["lint"]["rulesRevision"] == winning["revision"]
    item = sql(
        f"SELECT state FROM background_job_items WHERE job_id='{first['jobId']}' AND item_key='{id}'"
    )
    # An obsolete rules attempt may complete into audit history. JdbcLintAssessments
    # guards the current pointer separately; item COMPLETED alone is not publication.
    published = json.loads(
        sql(
            f"SELECT json_build_object('rules',a.rules_revision,'codeHash',a.code_hash) FROM snippets s JOIN snippet_lint_assessments a ON a.id=s.current_lint_assessment WHERE s.id='{id}'"
        )
    )
    assert published["rules"] == winning["revision"]
    assert published["codeHash"] == value["lint"]["codeHash"]
    if code_change:
        assert item == "SUPERSEDED", item
    return {
        "snippet": id,
        "held": held,
        "changeConfirmedAt": confirmed,
        "first": first,
        "winning": winning,
        "previous": previous,
        "terminal": terminal,
        "oldItemState": item,
        "published": published,
        "detail": value,
    }


def recovery():
    settled({})
    control({"lintDelay": 0.3})
    job = rules(rule)["jobId"]

    def partial():
        value = api("GET", "/jobs/" + job)
        return (
            value
            if value["processed"] > 0
            and value["pending"] > 0
            and value["status"] == "RUNNING"
            else None
        )

    before = wait(partial)
    compose("stop", "-t", "10", "snippets-service")
    durable = json.loads(
        sql(
            f"SELECT json_build_object('state',state,'completed',(SELECT count(*) FROM background_job_items WHERE job_id='{job}' AND state='COMPLETED')) FROM background_jobs WHERE id='{job}'"
        )
    )
    assert durable["state"] not in ("COMPLETED", "PARTIAL", "FAILED", "SUPERSEDED"), (
        durable
    )
    compose("restart", "redis")
    compose("up", "-d", "--no-deps", "snippets-service")
    wait(health)
    after = done(job)
    assert (
        after["status"] == "COMPLETED" and after["processed"] >= before["processed"]
    ), (before, after)
    assert after["processed"] > durable["completed"], (durable, after)
    snapshot_query = f"SELECT json_agg(json_build_object('id',id,'key',item_key,'state',state,'result',result_reference) ORDER BY id) FROM background_job_items WHERE job_id='{job}'"
    snapshot = sql(snapshot_query)
    audits_query = f"SELECT count(*) FROM snippet_lint_assessments WHERE snippet_id IN (SELECT item_key::uuid FROM background_job_items WHERE job_id='{job}')"
    audits = sql(audits_query)
    envelope = sql(f"SELECT envelope::text FROM event_outbox WHERE job_id='{job}'")
    # Credentials stay inside the container; only a duplicate event ID is returned.
    prefix = 'export REDISCLI_AUTH="$(cat /run/secrets/redis_password)"; redis-cli '
    event = compose(
        "exec",
        "-T",
        "redis",
        "sh",
        "-c",
        prefix + '--raw -x XADD snippet-searcher:local:events "*" event',
        input=envelope,
    )

    def acknowledged():
        groups = json.loads(
            compose(
                "exec",
                "-T",
                "redis",
                "sh",
                "-c",
                prefix + "--json XINFO GROUPS snippet-searcher:local:events",
            )
        )
        group = next(g for g in groups if g["name"] == "snippet-processing-v1")
        pending = compose(
            "exec",
            "-T",
            "redis",
            "sh",
            "-c",
            prefix
            + "--raw XPENDING snippet-searcher:local:events snippet-processing-v1 "
            + event
            + " "
            + event
            + " 1",
        )
        return (
            tuple(map(int, group["last-delivered-id"].split("-")))
            >= tuple(map(int, event.split("-")))
            and not pending
        )

    wait(acknowledged, 30)
    assert sql(snapshot_query) == snapshot and sql(audits_query) == audits
    assert (
        int(
            sql(
                f"SELECT count(*)-count(DISTINCT item_key) FROM background_job_items WHERE job_id='{job}'"
            )
        )
        == 0
    )
    assert (
        int(
            sql(
                f"SELECT count(*) FROM execution_permits WHERE job_id='{job}' AND state <> 'RELEASED'"
            )
        )
        == 0
    )
    return {
        "job": job,
        "before": before,
        "stoppedDurable": durable,
        "after": after,
        "redeliveryRecord": event,
        "redeliveryAcknowledged": True,
        "unchangedLogicalItems": len(json.loads(snapshot)),
        "auditCountUnchanged": int(audits),
        "activePermits": 0,
    }


try:
    record[args.phase] = {
        "prepare": prepare,
        "code-race": lambda: race(True),
        "rules-race": lambda: race(False),
        "recovery": recovery,
    }[args.phase]()
    args.evidence.write_text(json.dumps(record, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({"phase": args.phase, "result": "PASS"}))
finally:
    control({})
