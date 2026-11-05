"""Opt-in SNI-75 fault proxy. Forwards real responses; only injects explicit fixture failures/delays."""

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
parser.add_argument("--control", type=str, required=True)
args = parser.parse_args()

control = Path(args.control)
seen = control.with_suffix(".seen.json")
lock = threading.Lock()


class Proxy(BaseHTTPRequestHandler):
    def do_GET(self):
        self.forward()

    def do_POST(self):
        self.forward()

    def do_PUT(self):
        self.forward()

    def log_message(self, *args):
        pass

    def forward(self):
        if self.headers.get("Transfer-Encoding", "").lower() == "chunked":
            chunks = []
            while True:
                size = int(self.rfile.readline().split(b";")[0], 16)
                if not size:
                    while self.rfile.readline().strip():
                        pass
                    break
                chunks.append(self.rfile.read(size))
                self.rfile.read(2)
            body = b"".join(chunks)
        else:
            body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        config = json.loads(control.read_text()) if control.exists() else {}
        if (
            self.command == "POST"
            and self.path == "/linting"
            and config.get("lintFailure")
        ):
            if config["lintFailure"] in json.loads(body).get("code", ""):
                self.send_response(503)
                self.send_header("Content-Type", "application/problem+json")
                self.end_headers()
                self.wfile.write(
                    b'{"status":503,"type":"urn:acceptance:injected-lint-outage"}'
                )
                return
        if self.command == "POST" and self.path == "/formatting":
            code = json.loads(body).get("code", "")
            if config.get("failure") and config["failure"] in code:
                self.send_response(503)
                self.send_header("Content-Type", "application/problem+json")
                self.end_headers()
                self.wfile.write(
                    b'{"status":503,"type":"urn:acceptance:injected-provider-outage"}'
                )
                return
            time.sleep(config.get("delay", 0))
            if config.get("gate") and config["gate"] in code:
                with lock:
                    seen.write_text(json.dumps({"code": code, "at": time.time()}))
                deadline = time.monotonic() + 4
                while (
                    control.exists()
                    and json.loads(control.read_text()).get("gate") == config["gate"]
                    and time.monotonic() < deadline
                ):
                    time.sleep(0.02)
        connection = http.client.HTTPConnection(
            "127.0.0.1", args.provider_port, timeout=150
        )
        try:
            headers = {
                k: v
                for k, v in self.headers.items()
                if k.lower() not in ("host", "connection", "transfer-encoding")
            }
            connection.request(self.command, self.path, body or None, headers)
            response = connection.getresponse()
            self.send_response(response.status)
            for key, value in response.getheaders():
                if key.lower() not in ("transfer-encoding", "connection"):
                    self.send_header(key, value)
            self.end_headers()
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
