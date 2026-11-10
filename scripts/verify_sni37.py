"""SNI-37 real-provider acceptance. Only an isolated local dev project is permitted."""

import argparse
import json
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--base-url", default="http://127.0.0.1:18080")
parser.add_argument("--queries", type=Path, required=True)
parser.add_argument("--evidence", type=Path, required=True)
parser.add_argument(
    "--phase", choices=["fixtures", "snapshot", "verify-snapshot"], required=True
)
args = parser.parse_args()
assert urllib.parse.urlsplit(args.base_url).hostname in ("127.0.0.1", "localhost")
record = json.loads(args.queries.read_text())
results = json.loads(args.evidence.read_text()) if args.evidence.exists() else {}


def api(actor, method, path, body=None, expected=200):
    req = urllib.request.Request(
        args.base_url + path,
        method=method,
        data=None if body is None else json.dumps(body).encode(),
        headers={
            "X-Dev-Actor-Id": actor,
            "Content-Type": "application/json",
            "Idempotency-Key": str(uuid.uuid4()),
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            status, raw = response.status, response.read()
    except urllib.error.HTTPError as error:
        status, raw = error.code, error.read()
    assert status == expected, (path, status, raw[:1000])
    return json.loads(raw) if raw else None


def detail(id):
    return api("dev-ana", "GET", "/snippets/" + id)


def query(actor, **kwargs):
    return api(
        actor,
        "GET",
        "/snippets?" + urllib.parse.urlencode({"name": record["prefix"], **kwargs}),
    )


def fixtures():
    # Add enough real records to traverse the UI's five-row pagination.
    for index in range(max(0, 8 - record["expectedCount"])):
        value = api(
            "dev-ana",
            "POST",
            "/snippets",
            {
                "name": record["prefix"] + "page-" + str(index),
                "description": None,
                "language": "printscript",
                "version": "1.1",
                "code": "println(1);",
            },
            201,
        )
        record["ids"]["compliant"].append(value["id"])
        record["expectedCount"] += 1
    args.queries.write_text(json.dumps(record, indent=2) + "\n")
    details = {id: detail(id) for ids in record["ids"].values() for id in ids}
    pages = []
    for actor in ("dev-thiago", "dev-ana", "dev-bruno"):
        visible = [
            row
            for row in details.values()
            if actor == row["ownerId"] or actor == "dev-ana"
        ]
        if actor == "dev-bruno":
            visible = [api(actor, "GET", "/snippets/" + record["outsider"])]
        for relation in ("owned", "shared", "all"):
            scoped = [
                r
                for r in visible
                if relation == "all" or (r["ownerId"] == actor) == (relation == "owned")
            ]
            for direction in ("asc", "desc"):
                # Public sort contract: status follows direction, ID tie-break is always ascending.
                ordered = [
                    r["id"]
                    for status in sorted(
                        {r["lint"]["status"] for r in scoped},
                        reverse=direction == "desc",
                    )
                    for r in sorted(scoped, key=lambda row: row["id"])
                    if r["lint"]["status"] == status
                ]
                for size in (1, 2):
                    obtained = []
                    for page in range(len(ordered) // size + 1):
                        value = query(
                            actor,
                            relation=relation,
                            sort="lint",
                            direction=direction,
                            page=page,
                            page_size=size,
                        )
                        assert value["count"] == len(ordered), value
                        obtained += [row["id"] for row in value["snippets"]]
                    assert obtained == ordered, (
                        actor,
                        relation,
                        direction,
                        obtained,
                        ordered,
                    )
                    pages.append(
                        {
                            "actor": actor,
                            "relation": relation,
                            "direction": direction,
                            "size": size,
                            "count": len(ordered),
                            "ids": obtained,
                        }
                    )
    for id in record["ids"]["not-compliant"]:
        api(
            "dev-ana",
            "PUT",
            "/snippets/" + id,
            {
                k: details[id][k]
                for k in ("name", "description", "language", "version", "code")
            },
            403,
        )
        api("dev-bruno", "GET", "/snippets/" + id, expected=404)
    bad = record["ids"]["not-compliant"][0]
    tests = []
    for outputs, comparison in (
        (["3"], "PASSED"),
        (["4"], "FAILED"),
        (["3", "3"], "FAILED"),
    ):
        existing = api("dev-thiago", "GET", "/snippets/" + bad + "/tests")["items"]
        test = next((t for t in existing if t["expectedOutputs"] == outputs), None)
        if test is None:
            test = api(
                "dev-thiago",
                "POST",
                "/snippets/" + bad + "/tests",
                {"inputs": [], "expectedOutputs": outputs},
                201,
            )
        api(
            "dev-ana",
            "POST",
            "/snippets/" + bad + "/tests",
            {"inputs": [], "expectedOutputs": outputs},
            403,
        )
        for actor in ("dev-thiago", "dev-ana"):
            run = api(
                actor,
                "POST",
                "/snippets/" + bad + "/tests/" + test["id"] + "/executions",
                {},
                201,
            )
            other = "dev-ana" if actor == "dev-thiago" else "dev-thiago"
            api(other, "GET", "/executions/" + run["executionId"], expected=403)
            req = urllib.request.Request(
                args.base_url + "/executions/" + run["executionId"] + "/events?after=0",
                headers={"X-Dev-Actor-Id": actor},
            )
            with urllib.request.urlopen(req, timeout=30) as response:
                events = [json.loads(line) for line in response if line.strip()]
            terminal = events[-1]["data"]
            assert terminal["comparison"] == comparison, events
            tests.append(
                {
                    "actor": actor,
                    "test": test,
                    "execution": run["executionId"],
                    "terminal": terminal,
                }
            )
        api("dev-bruno", "GET", "/snippets/" + bad + "/tests", expected=404)
    assert detail(bad)["lint"]["status"] == "not-compliant"
    rules = api("dev-ana", "GET", "/linting-rules/printscript/1.1")
    same = {
        r["id"]: r["value"]
        for r in rules["rules"]
        if r["value"] is not None and r["value"] is not False
    }
    noop = api("dev-ana", "PUT", "/linting-rules/printscript/1.1", {"rules": same})
    assert (
        noop["changed"] is False
        and noop["jobId"] is None
        and noop["revision"] == rules["revision"]
    ), noop
    return {"details": details, "queries": pages, "manualTests": tests, "noOp": noop}


if args.phase == "fixtures":
    results["fixtures"] = fixtures()
else:
    current = {id: detail(id) for ids in record["ids"].values() for id in ids}
    if args.phase == "snapshot":
        results["restartBefore"] = current
    else:
        assert current == results["restartBefore"], (
            "persisted state changed after restart"
        )
        results["restartAfter"] = current
args.evidence.write_text(json.dumps(results, indent=2, ensure_ascii=False) + "\n")
print(json.dumps({"phase": args.phase, "result": "PASS"}))
