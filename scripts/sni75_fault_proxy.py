"""Local opt-in fault proxy: successful payloads always come from the actual provider."""

import argparse
import http.client
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--port", type=int, default=18083)
parser.add_argument("--provider-port", type=int, default=18082)
parser.add_argument("--control", required=True)
args = parser.parse_args()
control = Path(args.control)
seen = control.with_suffix(".seen.json")
lock = threading.Lock()
selected = {}


def config():
    return json.loads(control.read_text()) if control.exists() else {}


def hold(stage, token, path, code, settings):
    with lock:
        chosen = selected.setdefault((stage, token), path)
        if settings.get("once") and chosen != path:
            return
        temporary = seen.with_suffix(".tmp")
        temporary.write_text(
            json.dumps(
                {
                    "stage": stage,
                    "id": path.split("/")[-1],
                    "code": code,
                    "at": time.time(),
                }
            )
        )
        temporary.replace(seen)
    deadline = time.monotonic() + settings.get("holdSeconds", 4)
    while config().get(stage) == token and time.monotonic() < deadline:
        time.sleep(0.02)


class Proxy(BaseHTTPRequestHandler):
    def do_GET(self):
        self.forward()

    def do_POST(self):
        self.forward()

    def do_PUT(self):
        self.forward()

    def log_message(self, *args):
        pass

    def body(self):
        if self.headers.get("Transfer-Encoding", "").lower() != "chunked":
            return self.rfile.read(int(self.headers.get("Content-Length", 0)))
        chunks = []
        while True:
            size = int(self.rfile.readline().split(b";")[0], 16)
            if not size:
                while self.rfile.readline().strip():
                    pass
                return b"".join(chunks)
            chunks.append(self.rfile.read(size))
            self.rfile.read(2)

    def reject(self):
        self.send_response(503)
        self.send_header("Content-Type", "application/problem+json")
        self.end_headers()
        self.wfile.write(
            b'{"status":503,"type":"urn:acceptance:injected-provider-outage"}'
        )

    def forward(self):
        body = self.body()
        settings = config()
        command = json.loads(body) if body else {}
        code = command.get("code", "")
        operation = self.command == "PUT" and self.path.startswith("/operations/")
        formatting = (self.command == "POST" and self.path == "/formatting") or (
            operation and command.get("kind") == "FORMAT"
        )
        if (
            self.command == "POST"
            and self.path == "/linting"
            and settings.get("lintFailure")
            and settings["lintFailure"] in code
        ):
            self.reject()
            return
        if formatting:
            if settings.get("failure") and settings["failure"] in code:
                self.reject()
                return
            time.sleep(settings.get("delay", 0))
            if settings.get("gate") and settings["gate"] in code:
                hold("gate", settings["gate"], self.path, code, settings)
        connection = http.client.HTTPConnection(
            "127.0.0.1", args.provider_port, timeout=150
        )
        try:
            headers = {
                key: value
                for key, value in self.headers.items()
                if key.lower() not in ("host", "connection", "transfer-encoding")
            }
            connection.request(self.command, self.path, body or None, headers)
            response = connection.getresponse()
            buffered = None
            if (
                operation
                and settings.get("holdReply")
                and settings["holdReply"] in code
            ):
                buffered = response.read()
                hold("holdReply", settings["holdReply"], self.path, code, settings)
            self.send_response(response.status)
            for key, value in response.getheaders():
                if key.lower() not in (
                    "transfer-encoding",
                    "connection",
                    "content-length",
                ):
                    self.send_header(key, value)
            if buffered is not None:
                self.send_header("Content-Length", str(len(buffered)))
            elif response.getheader("Content-Length") is not None:
                self.send_header("Content-Length", response.getheader("Content-Length"))
            self.end_headers()
            if buffered is not None:
                self.wfile.write(buffered)
            else:
                while True:
                    chunk = response.read1(65536)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            connection.close()


ThreadingHTTPServer(("0.0.0.0", args.port), Proxy).serve_forever()
