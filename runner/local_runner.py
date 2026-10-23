#!/usr/bin/env python3
"""Local runner for Code Training: runs exercises with *your* Python (PyTorch, GPU, …).

Usage:
    python runner/local_runner.py [--port 8765] [--host 127.0.0.1]

Then in the app: Réglages → Moteur d'exécution → « Runner local », and paste the token
printed below. Only requests carrying that token are executed: other websites you visit
cannot use the runner to execute code on your machine.

Standard library only. Each execution runs in a fresh subprocess with a timeout.
"""

import argparse
import importlib.util
import json
import os
import platform
import secrets
import subprocess
import sys
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HARNESS = ROOT / "public" / "harness.py"
TOKEN_FILE = Path.home() / ".code-training-runner-token"
MAX_BODY = 2 * 1024 * 1024
MAX_TIMEOUT = 600


def load_token() -> str:
    if TOKEN_FILE.exists():
        token = TOKEN_FILE.read_text().strip()
        if token:
            return token
    token = secrets.token_urlsafe(24)
    TOKEN_FILE.write_text(token)
    try:
        TOKEN_FILE.chmod(0o600)
    except OSError:
        pass
    return token


def package_version(name: str):
    if importlib.util.find_spec(name) is None:
        return None
    try:
        from importlib.metadata import version

        dist = {"sklearn": "scikit-learn"}.get(name, name)
        return version(dist)
    except Exception:
        return "installé"


def accelerators():
    """Reports CUDA / Apple MPS availability without importing torch in the server process."""
    if importlib.util.find_spec("torch") is None:
        return False, False
    probe = (
        "import json, torch;"
        "print(json.dumps([torch.cuda.is_available(),"
        " bool(getattr(torch.backends, 'mps', None) and torch.backends.mps.is_available())]))"
    )
    try:
        out = subprocess.run([sys.executable, "-c", probe], capture_output=True, text=True, timeout=60)
        cuda, mps = json.loads(out.stdout.strip().splitlines()[-1])
        return bool(cuda), bool(mps)
    except Exception:
        return False, False


class Handler(BaseHTTPRequestHandler):
    token = ""
    info = {}

    def log_message(self, fmt, *args):  # quieter logs
        sys.stderr.write("[runner] " + (fmt % args) + "\n")

    def _cors(self):
        origin = self.headers.get("Origin")
        self.send_header("Access-Control-Allow-Origin", origin or "*")
        self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Runner-Token")
        # Chrome "Private Network Access": lets an https:// page reach this loopback server.
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Access-Control-Max-Age", "600")

    def _json(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _authorized(self):
        return secrets.compare_digest(self.headers.get("X-Runner-Token", ""), self.token)

    def do_OPTIONS(self):  # noqa: N802
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):  # noqa: N802
        if self.path != "/health":
            return self._json(404, {"error": "not found"})
        if not self._authorized():
            return self._json(401, {"error": "invalid token"})
        return self._json(200, self.info)

    def do_POST(self):  # noqa: N802
        if self.path != "/run":
            return self._json(404, {"error": "not found"})
        if not self._authorized():
            return self._json(401, {"error": "invalid token"})
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BODY:
            return self._json(413, {"error": "payload too large"})
        try:
            body = json.loads(self.rfile.read(length))
            payload = body["payload"]
            timeout = min(float(body.get("timeout", 30)), MAX_TIMEOUT)
        except (ValueError, KeyError, TypeError):
            return self._json(400, {"error": "bad request"})

        env = dict(os.environ, MPLBACKEND="Agg", PYTHONIOENCODING="utf-8")
        with tempfile.TemporaryDirectory(prefix="ct-run-") as workdir:
            try:
                proc = subprocess.run(
                    [sys.executable, str(HARNESS)],
                    input=json.dumps(payload), capture_output=True, text=True,
                    timeout=timeout, cwd=workdir, env=env,
                )
            except subprocess.TimeoutExpired:
                return self._json(408, {"error": "timeout"})
        try:
            result = json.loads(proc.stdout)
        except ValueError:
            stderr = (proc.stderr or "").strip()[-3000:]
            result = {"ok": False, "error": stderr or "Le processus Python s'est arrêté sans résultat."}
        return self._json(200, result)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()

    if not HARNESS.exists():
        sys.exit(f"harness introuvable : {HARNESS}")

    cuda, mps = accelerators()
    Handler.token = load_token()
    Handler.info = {
        "python": platform.python_version(),
        "packages": {name: package_version(name) for name in ["numpy", "pandas", "sklearn", "torch", "matplotlib"]},
        "cuda": cuda,
        "mps": mps,
    }

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    pkgs = ", ".join(f"{k} {v}" for k, v in Handler.info["packages"].items() if v) or "aucun paquet scientifique"
    print("\n  Code Training — runner local")
    print(f"  URL    : http://{args.host}:{args.port}")
    print(f"  Token  : {Handler.token}")
    print(f"  Python : {Handler.info['python']} ({pkgs})")
    print(f"  GPU    : CUDA={'oui' if cuda else 'non'}  MPS={'oui' if mps else 'non'}")
    print("\n  Colle l'URL et le token dans Réglages → Moteur d'exécution. Ctrl+C pour arrêter.\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Runner arrêté.")


if __name__ == "__main__":
    main()
