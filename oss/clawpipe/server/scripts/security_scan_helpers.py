"""Shared helpers and auxiliary scan functions for FinSavvyAI Security Scanner."""

import requests

PASS = "\033[92mPASS\033[0m"
FAIL = "\033[91mFAIL\033[0m"
WARN = "\033[93mWARN\033[0m"
INFO = "\033[94mINFO\033[0m"

results = {"pass": 0, "fail": 0, "warn": 0}


def check(name, passed, severity="fail", detail=""):
    """Record and print a single security check result."""
    status = PASS if passed else (FAIL if severity == "fail" else WARN)
    key = "pass" if passed else severity
    results[key] = results.get(key, 0) + 1
    detail_str = f" - {detail}" if detail else ""
    print(f"  [{status}] {name}{detail_str}")
    return passed


def section(title):
    """Print a section header."""
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print(f"{'=' * 60}")


def scan_tls(base_url):
    """Check TLS / transport security."""
    section("TLS / Transport Security")

    if base_url.startswith("https://"):
        check("HTTPS enabled", True)
        try:
            resp = requests.get(
                base_url.replace("https://", "http://"),
                timeout=3,
                allow_redirects=False,
            )
            check(
                "HTTP redirects to HTTPS",
                resp.status_code in (301, 302, 308),
                "warn",
                f"Status: {resp.status_code}",
            )
        except requests.ConnectionError:
            check("HTTP port closed (good)", True)
    else:
        check(
            "HTTPS enabled", False, "warn", "Running over HTTP - use TLS in production"
        )


def scan_rate_limiting(base_url):
    """Check rate limiting is active."""
    section("Rate Limiting")

    hit_limit = False
    for i in range(120):
        try:
            resp = requests.get(f"{base_url}/health", timeout=2)
            if resp.status_code == 429:
                hit_limit = True
                check(
                    "Rate limiting active",
                    True,
                    detail=f"Triggered after {i + 1} requests",
                )
                break
        except requests.ConnectionError:
            break

    if not hit_limit:
        check("Rate limiting active", False, "warn", "120 requests without rate limit")


def scan_information_disclosure(base_url):
    """Check error responses don't leak internal details."""
    section("Information Disclosure")

    try:
        resp = requests.post(
            f"{base_url}/v1/chat/completions",
            data="not json",
            headers={"Content-Type": "application/json"},
            timeout=5,
        )
        body = resp.text
        check(
            "Error responses don't leak stack traces",
            "Traceback" not in body and 'File "/' not in body,
            "fail",
        )
    except requests.ConnectionError:
        pass

    try:
        resp = requests.get(f"{base_url}/nonexistent/path/here", timeout=5)
        body = resp.text
        check(
            "404 responses are clean",
            "Traceback" not in body and "debug" not in body.lower(),
            "warn",
        )
    except requests.ConnectionError:
        pass


def scan_endpoints(base_url, master_url):
    """Check for exposed debug/admin endpoints."""
    section("Endpoint Security")

    debug_paths = ["/debug/pprof", "/debug/vars", "/.env", "/config", "/admin"]
    for path in debug_paths:
        try:
            resp = requests.get(f"{base_url}{path}", timeout=3)
            check(
                f"Debug endpoint {path} not exposed",
                resp.status_code in (401, 403, 404),
                "fail" if path in ("/.env", "/admin") else "warn",
                f"Status: {resp.status_code}" if resp.status_code == 200 else "",
            )
        except requests.ConnectionError:
            check(
                f"Debug endpoint {path}", True, detail="Connection refused (good)"
            )

    try:
        resp = requests.get(f"{base_url}/metrics", timeout=5)
        if resp.status_code == 200:
            body = resp.text.lower()
            check(
                "No API keys in metrics",
                "api_key" not in body
                and "secret" not in body
                and "password" not in body,
                "fail",
            )
    except requests.ConnectionError:
        pass


def scan_worker_security(worker_url):
    """Scan worker node for auth enforcement and security headers."""
    section("Worker Node Security")

    for path in ["/v1/chat/completions", "/models/load", "/models/unload"]:
        try:
            method = requests.post if path != "/v1/models" else requests.get
            resp = method(
                f"{worker_url}{path}",
                json={
                    "model": "test",
                    "messages": [{"role": "user", "content": "test"}],
                },
                timeout=5,
            )
            check(
                f"Worker {path} requires auth",
                resp.status_code in (401, 403),
                "fail",
                f"Got {resp.status_code}",
            )
        except requests.ConnectionError:
            check(f"Worker {path}", False, "warn", "Worker not reachable")

    try:
        resp = requests.get(f"{worker_url}/health", timeout=5)
        headers = resp.headers
        header_set = {k.lower() for k in headers}
        check(
            "Worker has X-Content-Type-Options",
            "x-content-type-options" in header_set,
            "fail",
        )
        check(
            "Worker has X-Frame-Options",
            "x-frame-options" in header_set,
            "fail",
        )
        cors = headers.get("Access-Control-Allow-Origin", "")
        check(
            "Worker CORS not wildcard",
            cors != "*",
            "warn",
            f"CORS: {cors}" if cors else "No CORS header",
        )
    except requests.ConnectionError:
        check("Worker reachable", False, "warn", "Worker not reachable")
