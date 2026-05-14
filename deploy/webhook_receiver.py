#!/usr/bin/env python3
"""GitHub webhook receiver — pulls latest code and restarts the app on push to main."""

import http.server
import json
import hmac
import hashlib
import subprocess
import logging
import os
import sys

logging.basicConfig(
    filename="/var/log/webhook-deploy.log",
    level=logging.INFO,
    format="%(asctime)s %(message)s",
)

# Load secret from .env file
SECRET = ""
ENV_PATH = "/var/www/UltimateHealthApp/backend/.env"
try:
    with open(ENV_PATH) as f:
        for line in f:
            if line.startswith("WEBHOOK_SECRET="):
                SECRET = line.strip().split("=", 1)[1]
except FileNotFoundError:
    logging.warning(f".env not found at {ENV_PATH}")

PORT = 9097
DEPLOY_DIR = "/var/www/UltimateHealthApp"


def verify_signature(body: bytes, signature: str) -> bool:
    """Verify GitHub's HMAC SHA-256 signature."""
    if not SECRET or not signature:
        logging.warning("No secret configured — skipping signature verification (insecure)")
        return True

    expected = "sha256=" + hmac.new(
        SECRET.encode(), body, hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(expected, signature)


class Handler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)
        signature = self.headers.get("X-Hub-Signature-256", "")

        if not verify_signature(body, signature):
            logging.warning("Invalid webhook signature from %s", self.client_address[0])
            self.send_response(403)
            self.end_headers()
            return

        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            self.send_response(400)
            self.end_headers()
            return

        # Only deploy on push to main branch
        ref = payload.get("ref", "")
        if ref != "refs/heads/main":
            self.send_response(200)
            self.end_headers()
            return

        logging.info("Deploy triggered — ref: %s, action: push", ref)

        try:
            # Pull latest code
            result = subprocess.run(
                ["git", "pull", "origin", "main"],
                cwd=DEPLOY_DIR, capture_output=True, text=True, timeout=120,
            )
            if result.returncode != 0:
                logging.error("git pull failed: %s", result.stderr)

            # Reinstall backend deps
            subprocess.run(
                ["bash", "-c", f"source {DEPLOY_DIR}/backend/venv/bin/activate && pip install -r {DEPLOY_DIR}/backend/requirements.txt"],
                shell=True, capture_output=True, text=True, timeout=120,
            )

            # Build frontend
            subprocess.run(
                ["npm", "ci"], cwd=os.path.join(DEPLOY_DIR, "frontend"),
                capture_output=True, text=True, timeout=120,
            )
            subprocess.run(
                ["npm", "run", "build"], cwd=os.path.join(DEPLOY_DIR, "frontend"),
                capture_output=True, text=True, timeout=120,
            )

            # Restart backend
            subprocess.run(["systemctl", "restart", "ultimatehealth"], check=True)

            logging.info("Deploy complete")

        except Exception as e:
            logging.error("Deploy failed: %s", str(e))

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"status": "ok"}).encode())

    def log_message(self, format, *args):
        """Suppress default stderr logging."""
        pass


if __name__ == "__main__":
    server = http.server.HTTPServer(("", PORT), Handler)
    logging.info("Webhook receiver started on port %d", PORT)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logging.info("Shutting down")
        server.shutdown()
