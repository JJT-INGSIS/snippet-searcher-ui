"""Opt-in SNI-75 failure/recovery tests: only a fresh, explicitly named local Compose project."""

import argparse
import http.client
import json
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--base-url", default="http://localhost:18080")
parser.add_argument("--compose-dir", type=str, required=True)
parser.add_argument("--project", required=True)
parser.add_argument("--proxy-control", type=str, required=True)
parser.add_argument("--evidence", type=str, required=True)
parser.add_argument(
    "--phase",
    action="append",
    choices=["recovery", "failure", "code_race", "rules_race", "interactive"],
)
args = parser.parse_args()
assert args.project.startswith("sni75-"), (
    "Use a new sni75-* Compose project, never shared development data"
)
assert urllib.parse.urlsplit(args.base_url).hostname in (
    "localhost",
    "127.0.0.1",
    "::1",
)

STATE = Path(args.evidence)
CONTROL = Path(args.proxy_control)
SEEN = CONTROL.with_suffix(".seen.json")
OWNER = "dev-thiago"
BASE = args.base_url.rstrip("/")
COMPOSE = [
    "docker",
    "compose",
    "--project-directory",
    args.compose_dir,
    "-f",
    str(Path(args.compose_dir) / "compose.yaml"),
    "-f",
    str(Path(args.compose_dir) / "compose.redis.yaml"),
    "-f",
    str(Path(args.compose_dir) / "acceptance.yaml"),
    "-p",
    args.project,
    "--profile",
    "assets",
]


def api(method, path, body=None, expected=200):
    request = urllib.request.Request(
        BASE + path,
        data=None if body is None else json.dumps(body).encode(),
        method=method,
        headers={
            "X-Dev-Actor-Id": OWNER,
            "Content-Type": "application/json",
            "Idempotency-Key": str(uuid.uuid4()),
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            status, data = response.status, json.load(response)
    except urllib.error.HTTPError as error:
        status, data = error.code, json.load(error)
    assert status == expected, (method, path, status, data)
    return data


def compose(*args, input=None):
    return subprocess.run(
        COMPOSE + list(args), input=input, text=True, capture_output=True, check=True
    ).stdout


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
    ).strip()


def rules(selection):
    response = api("PUT", "/formatting-rules/printscript/1.1", {"rules": selection})
    assert response["changed"] and response["jobId"], response
    return response


def progress(job, terminal=True):
    deadline = time.monotonic() + 300
    while time.monotonic() < deadline:
        result = api("GET", "/jobs/" + job)
        if not terminal or result["status"] in (
            "COMPLETED",
            "PARTIAL",
            "FAILED",
            "SUPERSEDED",
        ):
            return result
        time.sleep(0.15)
    raise AssertionError(("job timeout", result))


def create(name, code):
    return api(
        "POST",
        "/snippets",
        {
            "name": name,
            "description": None,
            "language": "printscript",
            "version": "1.1",
            "code": code,
        },
        201,
    )["id"]


def control(value):
    temporary = CONTROL.with_suffix(".tmp")
    temporary.write_text(json.dumps(value))
    temporary.replace(CONTROL)


def waitgate():
    deadline = time.monotonic() + 120
    while not SEEN.exists() and time.monotonic() < deadline:
        time.sleep(0.025)
    assert SEEN.exists(), "formatting request did not reach gate"


def waithealthy():
    for _ in range(200):
        try:
            api("GET", "/languages")
            return
        except (OSError, AssertionError):
            time.sleep(0.2)
    raise AssertionError("snippets not ready")


def recovery():
    control({"delay": 0.18})
    saved = rules({"enforce-spacing-around-equals": True})
    job = saved["jobId"]
    deadline = time.monotonic() + 120
    while time.monotonic() < deadline:
        before = progress(job, False)
        if before["processed"] > 0 and before["status"] not in ("COMPLETED", "PARTIAL"):
            break
        time.sleep(0.05)
    else:
        raise AssertionError(("no partial progress", before))
    compose("stop", "-t", "10", "snippets-service")
    durable = sql(
        f"SELECT json_build_object('state',state,'completed',(SELECT count(*) FROM background_job_items WHERE job_id='{job}' AND state='COMPLETED')) FROM background_jobs WHERE id='{job}'"
    )
    time.sleep(1.1)
    compose("restart", "redis")
    compose("up", "-d", "--no-deps", "snippets-service")
    waithealthy()
    after = progress(job)
    assert (
        after["status"] == "COMPLETED" and after["processed"] >= before["processed"]
    ), (before, after)
    snapshot = sql(
        f"SELECT json_agg(json_build_object('id',id,'key',item_key,'state',state,'result',result_reference) ORDER BY id) FROM background_job_items WHERE job_id='{job}'"
    )
    envelope = sql(f"SELECT envelope::text FROM event_outbox WHERE job_id='{job}'")
    record = compose(
        "exec",
        "-T",
        "redis",
        "sh",
        "-c",
        'export REDISCLI_AUTH="$(cat /run/secrets/redis_password)"; redis-cli --raw -x XADD snippet-searcher:local:events "*" event',
        input=envelope,
    )
    acknowledged = False
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        group_data = compose(
            "exec",
            "-T",
            "redis",
            "sh",
            "-c",
            'export REDISCLI_AUTH="$(cat /run/secrets/redis_password)"; redis-cli --json XINFO GROUPS snippet-searcher:local:events',
        )
        groups = json.loads(group_data)
        group = next(
            group for group in groups if group["name"] == "snippet-processing-v1"
        )
        pending = compose(
            "exec",
            "-T",
            "redis",
            "sh",
            "-c",
            'export REDISCLI_AUTH="$(cat /run/secrets/redis_password)"; redis-cli --raw XPENDING snippet-searcher:local:events snippet-processing-v1 '
            + record.strip()
            + " "
            + record.strip()
            + " 1",
        )
        delivered = tuple(map(int, group["last-delivered-id"].split("-"))) >= tuple(
            map(int, record.strip().split("-"))
        )
        if delivered and not pending.strip():
            acknowledged = True
            break
        time.sleep(0.1)
    assert acknowledged, "duplicate event was not consumed and ACKed"
    duplicate = progress(job)
    assert duplicate == after, (after, duplicate)
    assert (
        sql(
            f"SELECT json_agg(json_build_object('id',id,'key',item_key,'state',state,'result',result_reference) ORDER BY id) FROM background_job_items WHERE job_id='{job}'"
        )
        == snapshot
    )
    assert (
        int(
            sql(
                f"SELECT count(*)-count(DISTINCT item_key) FROM background_job_items WHERE job_id='{job}'"
            )
        )
        == 0
    )
    control({})
    return {
        "job": job,
        "before": before,
        "stoppedDurable": json.loads(durable),
        "after": after,
        "redeliveryRecord": record.strip(),
        "redeliveryAcknowledged": acknowledged,
        "unchangedLogicalItems": len(json.loads(snapshot)),
    }


def failure():
    marker = "SNI75-FAULT-" + uuid.uuid4().hex[:8]
    code = 'println("' + marker + '");'
    snippet = create(marker, code)
    control({"failure": marker})
    saved = rules({"enforce-spacing-before-colon-in-declaration": True})
    terminal = progress(saved["jobId"])
    assert terminal["status"] == "PARTIAL" and terminal["failed"] == 1, terminal
    row = json.loads(
        sql(
            f"SELECT json_build_object('state',state,'reason',last_error,'attempts',attempts) FROM background_job_items WHERE job_id='{saved['jobId']}' AND item_key='{snippet}'"
        )
    )
    assert row["state"] == "FAILED" and row["reason"] == "LANGUAGE_UNAVAILABLE", row
    assert api("GET", "/snippets/" + snippet)["code"] == code
    control({})
    formatted = api("GET", "/snippets/" + snippet + "/formatted")
    assert marker in formatted["code"]
    return {
        "snippet": snippet,
        "job": saved["jobId"],
        "terminal": terminal,
        "item": row,
        "originalIntact": True,
        "fault": "proxy returns HTTP 503 only for this fixture; other calls go to real provider",
    }


def code_race():
    marker = "SNI75-CODE-" + uuid.uuid4().hex[:8]
    old = 'println("' + marker + '-old");'
    new = 'println("' + marker + '-new");'
    snippet = create(marker, old)
    if SEEN.exists():
        SEEN.unlink()
    control({"gate": marker})
    saved = rules({"mandatory-line-break-after-statement": True})
    waitgate()
    gated = json.loads(SEEN.read_text())
    assert gated["code"] == old
    api(
        "PUT",
        "/snippets/" + snippet,
        {
            "name": marker,
            "description": None,
            "language": "printscript",
            "version": "1.1",
            "code": new,
        },
    )
    assert time.time() - gated["at"] < 4, "edit missed the held formatting response"
    control({})
    terminal = progress(saved["jobId"])
    assert terminal["status"] == "COMPLETED", terminal
    formatted = api("GET", "/snippets/" + snippet + "/formatted")
    assert (
        marker + "-new" in formatted["code"]
        and marker + "-old" not in formatted["code"]
    ), formatted
    assert api("GET", "/snippets/" + snippet)["code"] == new
    return {
        "snippet": snippet,
        "job": saved["jobId"],
        "terminal": terminal,
        "formattedRevision": formatted["rulesRevision"],
        "newOriginalIntact": True,
    }


def rules_race():
    marker = "SNI75-RULES-" + uuid.uuid4().hex[:8]
    snippet = create(marker, 'let saludo:string="' + marker + '";println(saludo);')
    if SEEN.exists():
        SEEN.unlink()
    control({"gate": marker})
    first = rules({"enforce-spacing-after-colon-in-declaration": True})
    waitgate()
    gated = json.loads(SEEN.read_text())
    second = rules({"enforce-spacing-before-colon-in-declaration": True})
    assert time.time() - gated["at"] < 4, (
        "rule change missed the held formatting response"
    )
    control({})
    old = progress(first["jobId"])
    new = progress(second["jobId"])
    assert (
        old["status"] in ("SUPERSEDED", "COMPLETED") and new["status"] == "COMPLETED"
    ), (old, new)
    item_state = sql(
        f"SELECT state FROM background_job_items WHERE job_id='{first['jobId']}' AND item_key='{snippet}'"
    )
    assert item_state == "SUPERSEDED", item_state
    formatted = api("GET", "/snippets/" + snippet + "/formatted")
    assert (
        formatted["rulesRevision"] == second["revision"]
        and "saludo :string" in formatted["code"]
    ), formatted
    return {
        "snippet": snippet,
        "first": old,
        "second": new,
        "winningRevision": second["revision"],
        "oldTargetItem": item_state,
    }


def interactive():
    code = 'let nombre:string=readInput("Nombre?");println("Hola, "+nombre);'
    snippet = create("SNI75-INTERACTIVE-" + uuid.uuid4().hex[:8], code)
    execution = api("POST", "/snippets/" + snippet + "/executions", {}, 201)[
        "executionId"
    ]
    target = urllib.parse.urlsplit(BASE)
    client = http.client.HTTPConnection(target.hostname, target.port, timeout=150)
    client.request(
        "GET",
        "/executions/" + execution + "/events?after=0",
        headers={"X-Dev-Actor-Id": OWNER},
    )
    response = client.getresponse()
    assert response.status == 200
    events = []
    while True:
        event = json.loads(response.readline())
        events.append(event)
        if event["type"] == "input-required":
            break
    control({"delay": 0.1})
    saved = rules(
        {
            "enforce-spacing-around-equals": True,
            "mandatory-line-break-after-statement": True,
        }
    )
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        overlap = progress(saved["jobId"], False)
        if overlap["processed"] > 0:
            break
        time.sleep(0.05)
    assert overlap["status"] not in ("COMPLETED", "PARTIAL"), overlap
    held = int(
        sql(
            "SELECT count(*) FROM execution_permits WHERE kind='MANUAL' AND state <> 'RELEASED'"
        )
    )
    assert held >= 1, held
    api(
        "POST",
        "/executions/" + execution + "/inputs",
        {"requestId": event["data"]["requestId"], "value": "Ana"},
    )
    while True:
        line = response.readline()
        assert line, "stream ended before terminal"
        event = json.loads(line)
        events.append(event)
        if event["type"] == "terminal":
            break
    client.close()
    control({})
    terminal = progress(saved["jobId"])
    assert terminal["status"] == "COMPLETED", terminal
    assert any(
        e["type"] == "output" and e["data"]["text"] == "Hola, Ana" for e in events
    ), events
    return {
        "snippet": snippet,
        "execution": execution,
        "job": saved["jobId"],
        "terminal": terminal,
        "manualPermitsDuringBatch": held,
        "events": events,
    }


if __name__ == "__main__":
    waithealthy()
    results = json.loads(STATE.read_text()) if STATE.exists() else {}
    phases = args.phase or [
        "recovery",
        "failure",
        "code_race",
        "rules_race",
        "interactive",
    ]
    for phase in phases:
        try:
            results[phase] = globals()[phase]()
            STATE.write_text(json.dumps(results, indent=2, ensure_ascii=False))
            print(
                json.dumps(
                    {"phase": phase, "result": "PASS", "evidence": results[phase]}
                ),
                flush=True,
            )
        finally:
            control({})
