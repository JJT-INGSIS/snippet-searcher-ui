"""SNI-75 real HTTP fixture and assertions. Uses isolated local dev services, never mock results."""

import argparse
import json
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--base-url", default="http://127.0.0.1:18080")
parser.add_argument("--evidence", type=Path, required=True)
args = parser.parse_args()
assert urllib.parse.urlsplit(args.base_url).hostname in (
    "127.0.0.1",
    "localhost",
    "::1",
)


def api(actor, method, path, body=None, expected=200, extra=None):
    request = urllib.request.Request(
        args.base_url + path,
        data=None if body is None else json.dumps(body).encode(),
        method=method,
        headers={
            "X-Dev-Actor-Id": actor,
            "Content-Type": "application/json",
            **(extra or {}),
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            status, data = response.status, json.load(response)
    except urllib.error.HTTPError as error:
        status, data = error.code, json.load(error)
    assert status == expected, (method, path, status, data)
    return data


def create(owner, name, code, version="1.1"):
    return api(
        owner,
        "POST",
        "/snippets",
        {
            "name": name,
            "description": None,
            "language": "printscript",
            "version": version,
            "code": code,
        },
        expected=201,
        extra={"Idempotency-Key": str(uuid.uuid4())},
    )["id"]


def progress(job, terminal=True):
    for _ in range(160):
        result = api("dev-thiago", "GET", "/jobs/" + job)
        if not terminal or result["status"] in (
            "COMPLETED",
            "PARTIAL",
            "FAILED",
            "SUPERSEDED",
        ):
            return result
        time.sleep(0.3)
    raise AssertionError(("job did not finish", result))


owner = "dev-thiago"
reader = "dev-ana"
prefix = "SNI75-" + uuid.uuid4().hex[:10]
code = 'let saludo:string="¡Hola, señor! 🚀";println(saludo);'
ids = [create(owner, prefix + "-" + str(i), code) for i in range(8)]
other_version = create(owner, prefix + "-v10", code, version="1.0")
other_owner = create("dev-bruno", prefix + "-other-owner", code)
for snippet in ids[:2]:
    api(owner, "PUT", "/snippets/" + snippet + "/shares/" + reader, expected=201)
catalog = api(owner, "GET", "/formatting-rules/printscript/1.1")
assert any(
    rule["id"] == "enforce-spacing-before-colon-in-declaration"
    for rule in catalog["rules"]
)
targets = [
    row
    for row in api(
        owner, "GET", "/snippets?relation=owned&language=printscript&page_size=100"
    )["snippets"]
    if row["version"] == "1.1"
]
started = time.monotonic()
saved = api(
    owner,
    "PUT",
    "/formatting-rules/printscript/1.1",
    {"rules": {"enforce-spacing-before-colon-in-declaration": True}},
)
elapsed = time.monotonic() - started
assert saved["changed"] and saved["jobId"]
first = progress(saved["jobId"], terminal=False)
assert first["status"] not in ("COMPLETED", "PARTIAL"), (
    "PUT waited for whole batch",
    first,
)
finished = progress(saved["jobId"])
assert (
    finished["status"] == "COMPLETED"
    and finished["processed"] == len(targets)
    and finished["failed"] == 0
), finished
repeated = api(
    owner,
    "PUT",
    "/formatting-rules/printscript/1.1",
    {"rules": {"enforce-spacing-before-colon-in-declaration": True}},
)
assert repeated["changed"] is False and repeated["jobId"] is None
for snippet in ids:
    original = api(owner, "GET", "/snippets/" + snippet)
    formatted = api(owner, "GET", "/snippets/" + snippet + "/formatted")
    assert original["code"] == code
    assert (
        formatted["source"] == "stored"
        and formatted["rulesRevision"] == saved["revision"]
    )
    assert "¡Hola, señor! 🚀" in formatted["code"] and formatted["code"] != code
formatted = api(reader, "GET", "/snippets/" + ids[0] + "/formatted")
assert formatted["source"] == "stored"
api("dev-bruno", "GET", "/snippets/" + ids[0] + "/formatted", expected=404)
api(reader, "GET", "/jobs/" + saved["jobId"], expected=404)
assert (
    api(owner, "GET", "/snippets/" + other_version + "/formatted")["source"]
    == "on-demand"
)
assert (
    api("dev-bruno", "GET", "/snippets/" + other_owner + "/formatted")["source"]
    == "on-demand"
)
record = {
    "prefix": prefix,
    "ids": ids,
    "original": code,
    "name": prefix + "-0",
    "job": saved["jobId"],
    "rulesRevision": saved["revision"],
    "processorRevision": formatted["processorRevision"],
    "formatted": formatted["code"],
    "putSeconds": elapsed,
    "firstProgress": first,
    "terminal": finished,
    "targetCount": len(targets),
    "otherVersion": other_version,
    "otherOwner": other_owner,
    "phases": ["healthy"],
}
args.evidence.write_text(json.dumps(record, indent=2, ensure_ascii=False) + "\n")
print(
    json.dumps(
        {
            "phase": "healthy",
            "result": "passed",
            "job": saved["jobId"],
            "putSeconds": elapsed,
        }
    )
)
