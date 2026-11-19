#!/usr/bin/env python3
"""Run the Protocol Explorer website locally, with uploads enabled.

Usage:
    python scripts/serve.py              # http://localhost:8000
    python scripts/serve.py --port 8080

Serves the project folder (the site is at /site/, the dataset at /data/protocols.json)
and adds a small API so the website's "Add a report" page can save reports:

    GET  /api/status                       -> {"upload": true}
    POST /api/reports?mode=<none|replace|keep-both>
         body: the report's HTML, header X-Filename: original file name
         -> {"status": "added", ...} or {"status": "exists", ...} or {"status": "error", ...}

The server only listens on this computer (127.0.0.1).
"""
import argparse
import json
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import datalib

MAX_UPLOAD = 15 * 1024 * 1024


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(datalib.ROOT), **kwargs)

    def log_message(self, fmt, *args):
        sys.stderr.write("  " + (fmt % args) + "\n")

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _json(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlparse(self.path).path
        if path in ("/", "/index.html"):
            self.send_response(302)
            self.send_header("Location", "/site/")
            self.end_headers()
            return
        if path == "/api/status":
            return self._json(200, {"upload": True})
        return super().do_GET()

    def do_POST(self):
        url = urlparse(self.path)
        if url.path != "/api/reports":
            return self._json(404, {"status": "error", "message": "Not found"})
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_UPLOAD:
            return self._json(400, {"status": "error", "message": "The file is empty or too large (max 15 MB)."})
        text = self.rfile.read(length).decode("utf-8", errors="replace")
        name = self.headers.get("X-Filename") or "report.html"
        mode = (parse_qs(url.query).get("mode") or [None])[0]
        mode = mode if mode in ("replace", "keep-both") else None
        try:
            res = datalib.add(text, name, mode)
        except datalib.ReportError as ex:
            return self._json(400, {"status": "error", "message": str(ex)})
        if res["status"] == "added":
            dataset, errors, _ = datalib.build()
            if dataset is None:
                return self._json(500, {"status": "error",
                                        "message": "Saved, but the dataset could not be rebuilt:\n" + "\n".join(errors)})
            datalib.write(dataset)
        return self._json(200, res)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8000)
    args = ap.parse_args()
    dataset, errors, _ = datalib.build()
    if dataset is None:
        print("Warning: the dataset could not be rebuilt:\n  " + "\n  ".join(errors))
    else:
        datalib.write(dataset)
    srv = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"Protocol Explorer running at http://localhost:{args.port}/  (Ctrl+C to stop)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
