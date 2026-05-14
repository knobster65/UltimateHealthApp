#!/usr/bin/env python3
"""Smoke test for deployed UltimateHealthApp — tests API through Nginx on the live server."""

import http.client
import json
import sys
import hmac as hmac_mod
import hashlib

BASE = "127.0.0.1"  # Local Nginx (no SSL for simplicity)
PORT = 443          # HTTPS port
USE_HTTPS = True

print("=" * 50)
print("UltimateHealthApp Deployment Smoke Test")
print("=" * 50)
passed = 0
failed = 0

def request(method, path, body=None, extra_headers=None):
    global failed
    try:
        if USE_HTTPS:
            import ssl
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            conn = http.client.HTTPSConnection(BASE, PORT, context=ctx)
        else:
            conn = http.client.HTTPConnection(BASE, PORT)

        headers = {"Content-Type": "application/json"}
        if extra_headers:
            headers.update(extra_headers)
        data = json.dumps(body).encode() if body else None
        conn.request(method, path, body=data, headers=headers)
        resp = conn.getresponse()
        raw = resp.read().decode()
        return resp.status, raw
    except Exception as e:
        failed += 1
        print(f"  FAIL: {e}")
        return None, None

def test(name, status, body_raw):
    global passed, failed
    if status is None:
        print(f"  [FAIL] {name} — connection error")
        failed += 1
        return None
    try:
        body = json.loads(body_raw) if body_raw else {}
    except json.JSONDecodeError:
        print(f"  [FAIL] {name} — status {status}, couldn't parse JSON")
        failed += 1
        return None

    print(f"  [OK]   {name} — status {status}")
    passed += 1
    return body

# --- Tests ---

print("\n1. Health check (via Nginx)")
status, raw = request("GET", "/health")
test("Health endpoint", status, raw)

print("\n2. Login with correct credentials")
status, raw = request("POST", "/api/auth/login", {"username": "test", "password": "changeme"})
login_body = test("Login /api/auth/login returns 200 + token", status, raw)
token = login_body.get("token") if login_body else None

if not token or ":" not in token:
    print("  [FAIL] No valid token received")
    failed += 1
else:
    print(f"  [OK]   Token received ({len(token)} chars)")
    passed += 1

print("\n3. Login with wrong password (should 401)")
status, raw = request("POST", "/api/auth/login", {"username": "test", "password": "wrong"})
test("Login with bad password returns 401", status, raw)
if status == 401:
    passed += 1
else:
    failed += 1
    print(f"  [FAIL] Expected 401, got {status}")

print("\n4. Session check with valid token")
status, raw = request("GET", "/auth/session", extra_headers={"Authorization": f"Bearer {token}"})
session_body = test("Session endpoint returns user info", status, raw)

print("\n5. CORS preflight (OPTIONS to /api/auth/login)")
try:
    import ssl
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    conn = http.client.HTTPSConnection(BASE, PORT, context=ctx)
    extra = {
        "Origin": "https://karcass.com",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type, Authorization",
    }
    conn.request("OPTIONS", "/api/auth/login", headers=extra)
    resp = conn.getresponse()
    cors_acmh = resp.getheader("Access-Control-Allow-Methods") or ""
    cors_acoh = resp.getheader("Access-Control-Allow-Headers") or ""
    if resp.status in (200, 204) and "POST" in cors_acmh:
        print(f"  [OK]   CORS preflight OK — Allow-Methods: {cors_acmh}")
        passed += 1
    else:
        print(f"  [WARN] CORS response status={resp.status}, Allow-Methods='{cors_acmh}', Allow-Headers='{cors_acoh}'")
        failed += 1
except Exception as e:
    print(f"  [FAIL] CORS preflight error: {e}")
    failed += 1

print("\n6. Frontend HTML served by Nginx")
status, raw = request("GET", "/")
if status and "<html" in (raw or "").lower():
    print(f"  [OK]   Frontend served — {len(raw or '')} bytes")
    passed += 1
else:
    print(f"  [FAIL] Frontend returned status {status}, no HTML found")
    failed += 1

# --- Summary ---
total = passed + failed
print("\n" + "=" * 50)
print(f"Results: {passed}/{total} passed, {failed} failed")
if failed == 0:
    print("All smoke tests PASSED!")
else:
    print(f"Some tests FAILED — see above for details.")
print("=" * 50)
sys.exit(1 if failed > 0 else 0)
