"""SNI-78/64/75: real-provider recovery and lint batches, using an explicitly isolated local project."""

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
parser.add_argument("--base-url", default="http://localhost:18080")
parser.add_argument("--provider-url", default="http://localhost:18082")
parser.add_argument("--compose-dir", required=True)
parser.add_argument("--project", required=True)
parser.add_argument("--control", type=Path, required=True)
parser.add_argument("--evidence", type=Path, required=True)
parser.add_argument(
    "--phase",
    action="append",
    choices=["lost_ack", "delayed_start", "retained_result", "lint_batch"],
)
args = parser.parse_args()
assert args.project.startswith("sni75-")
assert all(
    urllib.parse.urlsplit(url).hostname in ("localhost", "127.0.0.1")
    for url in (args.base_url, args.provider_url)
)
compose_command = ["docker", "compose", "--project-directory", args.compose_dir]
for file in ("compose.yaml", "compose.redis.yaml", "acceptance.yaml"):
    compose_command += ["-f", str(Path(args.compose_dir) / file)]
compose_command += ["-p", args.project, "--profile", "assets"]
seen = args.control.with_suffix(".seen.json")


def compose(*command):
    return subprocess.run(
        [*compose_command, *command], text=True, capture_output=True, check=True
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


def request(base, actor, method, path, body=None, expected=200):
    headers = {
        "X-Dev-Actor-Id": actor,
        "Content-Type": "application/json",
        "Idempotency-Key": str(uuid.uuid4()),
    }
    req = urllib.request.Request(
        base + path,
        data=None if body is None else json.dumps(body).encode(),
        method=method,
        headers=headers,
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            raw = response.read()
            status, value = response.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        raw = error.read()
        status, value = error.code, json.loads(raw) if raw else None
    assert status == expected, (path, status, value)
    return value


def api(actor, method, path, body=None, expected=200):
    return request(args.base_url, actor, method, path, body, expected)


def operation(id):
    return request(args.provider_url, "unused-internal", "GET", "/operations/" + id)


def control(value):
    if seen.exists():
        seen.unlink()
    temporary = args.control.with_suffix(".tmp")
    temporary.write_text(json.dumps(value))
    temporary.replace(args.control)


def wait_until(check, seconds=120):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        value = check()
        if value:
            return value
        time.sleep(0.1)
    raise AssertionError("Condition did not become true before test deadline")


def healthy():
    def ready():
        try:
            return api("dev-thiago", "GET", "/languages")
        except (OSError, AssertionError):
            return None

    wait_until(ready)


def create(actor, marker, code):
    return api(
        actor,
        "POST",
        "/snippets",
        {
            "name": marker,
            "description": None,
            "language": "printscript",
            "version": "1.1",
            "code": code,
        },
        201,
    )["id"]


def rules(actor, kind, selected):
    response = api(
        actor, "PUT", "/" + kind + "-rules/printscript/1.1", {"rules": selected}
    )
    assert response["changed"] and response["jobId"], response
    return response


def finished(actor, job):
    terminal = {"COMPLETED", "PARTIAL", "FAILED", "SUPERSEDED"}
    return wait_until(
        lambda: (
            value
            if (value := api(actor, "GET", "/jobs/" + job))["status"] in terminal
            else None
        ),
        300,
    )


def observed(stage):
    def read():
        if not seen.exists():
            return None
        value = json.loads(seen.read_text())
        return value if value["stage"] == stage else None

    return wait_until(read)


def permits(job, snippet):
    return json.loads(
        sql(
            f"SELECT COALESCE(json_agg(json_build_object('id',p.id,'state',p.state,'remote',p.remote->>'id','proof',p.resolution_evidence)), '[]') FROM execution_permits p JOIN background_job_items i ON p.item_id=i.id WHERE p.job_id='{job}' AND i.item_key='{snippet}'"
        )
    )


def prepare_rules(actor, kind, selected):
    current = api(actor, "GET", "/" + kind + "-rules/printscript/1.1")
    effective = {
        rule["id"]: rule["value"]
        for rule in current["rules"]
        if rule["value"] is not None and rule["value"] is not False
    }
    if effective == selected:
        reset = {} if selected else {"mandatory-variable-or-literal-in-println": True}
        saved = rules(actor, kind, reset)
        assert finished(actor, saved["jobId"])["status"] == "COMPLETED"


def lost_acknowledgement(actor):
    prepare_rules(
        actor, "formatting", {"enforce-spacing-before-colon-in-declaration": True}
    )
    marker = "SNI78-lost-ack-" + uuid.uuid4().hex[:8]
    code = 'let saludo:string="' + marker + '";println(saludo);'
    snippet = create(actor, marker, code)
    control({"holdReply": marker, "once": True, "holdSeconds": 40})
    saved = rules(
        actor, "formatting", {"enforce-spacing-before-colon-in-declaration": True}
    )
    captured = observed("holdReply")
    before = permits(saved["jobId"], snippet)
    assert len(before) == 1 and before[0]["remote"] == captured["id"], before
    # The actual provider has accepted the operation; only its response to Snippets is withheld.
    accepted = operation(captured["id"])
    assert accepted["command"]["code"] == code
    compose("kill", "-s", "SIGKILL", "snippets-service")
    compose("up", "-d", "--no-deps", "snippets-service")
    healthy()
    terminal = finished(actor, saved["jobId"])
    assert terminal["status"] == "COMPLETED", terminal
    after = permits(saved["jobId"], snippet)
    assert (
        len(after) == 1
        and after[0]["id"] == before[0]["id"]
        and after[0]["state"] == "RELEASED"
    ), after
    derived = api(actor, "GET", "/snippets/" + snippet + "/formatted")
    assert derived["source"] == "stored" and marker in derived["code"]
    control({})
    return {
        "snippet": snippet,
        "operation": captured["id"],
        "job": saved["jobId"],
        "before": before,
        "after": after,
        "terminal": terminal,
        "fault": "actual accepted response withheld; Snippets killed and restarted",
    }


def delayed_start(actor):
    prepare_rules(
        actor, "formatting", {"enforce-spacing-after-colon-in-declaration": True}
    )
    marker = "SNI78-delayed-start-" + uuid.uuid4().hex[:8]
    code = 'let saludo:string="' + marker + '";println(saludo);'
    snippet = create(actor, marker, code)
    control({"gate": marker, "once": True, "holdSeconds": 40})
    saved = rules(
        actor, "formatting", {"enforce-spacing-after-colon-in-declaration": True}
    )
    captured = observed("gate")

    def fenced():
        try:
            value = operation(captured["id"])
            return (
                value
                if value["state"] == "CANCELLED" and value["command"] is None
                else None
            )
        except (OSError, AssertionError):
            return None

    fence = wait_until(fenced)
    # Absence was not used as proof: a tombstone exists BEFORE releasing the delayed PUT.
    terminal = finished(actor, saved["jobId"])
    assert terminal["status"] == "COMPLETED", terminal
    control({})
    time.sleep(0.5)
    after = operation(captured["id"])
    assert after == fence and after["reason"] == "START_FENCED", after
    attempts = permits(saved["jobId"], snippet)
    assert len(attempts) == 2 and all(
        attempt["state"] == "RELEASED" for attempt in attempts
    ), attempts
    assert api(actor, "GET", "/snippets/" + snippet)["code"] == code
    return {
        "snippet": snippet,
        "operation": captured["id"],
        "job": saved["jobId"],
        "terminal": terminal,
        "permits": attempts,
        "delayedPutStayedFenced": True,
    }


def redis_and_provider_restart(actor):
    prepare_rules(actor, "formatting", {"mandatory-line-break-after-statement": True})
    marker = "SNI78-retained-" + uuid.uuid4().hex[:8]
    snippet = create(actor, marker, 'println("' + marker + '");')
    control({"holdReply": marker, "once": True, "holdSeconds": 40})
    saved = rules(actor, "formatting", {"mandatory-line-break-after-statement": True})
    captured = observed("holdReply")
    previous = wait_until(
        lambda: value
        if (value := operation(captured["id"]))["state"] == "COMPLETED"
        else None
    )
    time.sleep(
        1.2
    )  # Preserve the configured every-second AOF guarantee rather than claiming fsync-always.
    compose("restart", "redis")
    compose("restart", "printscript-service")
    recovered = wait_until(lambda: lookup(captured["id"]))
    assert recovered == previous, (previous, recovered)
    control({})
    terminal = finished(actor, saved["jobId"])
    assert terminal["status"] == "COMPLETED", terminal
    attempts = permits(saved["jobId"], snippet)
    assert len(attempts) == 1 and attempts[0]["state"] == "RELEASED", attempts
    return {
        "snippet": snippet,
        "operation": captured["id"],
        "job": saved["jobId"],
        "terminal": terminal,
        "resultSurvivedBothRestarts": True,
    }


def lookup(id):
    try:
        return operation(id)
    except (OSError, AssertionError):
        return None


def lint_batch(actor):
    prepare_rules(actor, "linting", {})
    prefix = "SNI64-real-batch-" + uuid.uuid4().hex[:8]
    good = create(actor, prefix + "-good", "println(1);")
    bad = create(actor, prefix + "-bad", "println(1+2);")
    disabled = rules(actor, "linting", {})
    assert finished(actor, disabled["jobId"])["status"] == "COMPLETED"
    assert all(
        api(actor, "GET", "/snippets/" + id)["lint"]["status"] == "compliant"
        for id in (good, bad)
    )
    enabled = rules(
        actor, "linting", {"mandatory-variable-or-literal-in-println": True}
    )
    terminal = finished(actor, enabled["jobId"])
    assert terminal["status"] == "COMPLETED", terminal
    detail = api(actor, "GET", "/snippets/" + bad)
    assert detail["lint"]["status"] == "not-compliant" and detail["lint"]["diagnostics"]
    assert detail["code"] == "println(1+2);"
    api(actor, "PUT", "/snippets/" + bad + "/shares/dev-ana", expected=201)
    query = urllib.parse.urlencode(
        {"name": prefix, "lint": "not-compliant", "page_size": 1}
    )
    page = api("dev-ana", "GET", "/snippets?" + query)
    assert page["count"] == 1 and page["snippets"][0]["id"] == bad, page
    api("dev-bruno", "GET", "/snippets/" + bad, expected=404)
    counts = json.loads(
        sql(
            f"SELECT json_object_agg(snippet_id, amount) FROM (SELECT snippet_id,count(*) AS amount FROM snippet_lint_assessments WHERE snippet_id IN ('{good}','{bad}') GROUP BY snippet_id) x"
        )
    )
    assert counts == {good: 3, bad: 3}, counts
    return {
        "ids": [good, bad],
        "job": enabled["jobId"],
        "terminal": terminal,
        "auditCounts": counts,
        "readerFilterCount": page["count"],
        "originalIntact": True,
    }


healthy()
results = json.loads(args.evidence.read_text()) if args.evidence.exists() else {}
try:
    for name, action in (
        ("lost_ack", lambda: lost_acknowledgement("dev-juanfran")),
        ("delayed_start", lambda: delayed_start("dev-juanfran")),
        ("retained_result", lambda: redis_and_provider_restart("dev-juanfran")),
        ("lint_batch", lambda: lint_batch("dev-juan")),
    ):
        if args.phase and name not in args.phase:
            continue
        results[name] = action()
        args.evidence.write_text(
            json.dumps(results, indent=2, ensure_ascii=False) + "\n"
        )
        print(
            json.dumps({"phase": name, "result": "PASS", "evidence": results[name]}),
            flush=True,
        )
finally:
    control({})
