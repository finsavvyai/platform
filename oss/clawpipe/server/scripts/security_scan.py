#!/usr/bin/env python3
"""
FinSavvyAI Security Scanner
Checks for common security issues in the production deployment.

Usage:
    python3 scripts/security_scan.py [--base-url http://localhost:8080] \
        [--master-url http://localhost:8000] [--worker-url http://localhost:8001]
"""

import argparse
import sys

import requests

from security_scan_helpers import (
    FAIL,
    PASS,
    WARN,
    check,
    results,
    scan_endpoints,
    scan_information_disclosure,
    scan_rate_limiting,
    scan_tls,
    scan_worker_security,
    section,
)


def scan_auth(base_url):
    """Check authentication and authorization controls."""
    section("Authentication & Authorization")

    try:
        resp = requests.get(f"{base_url}/v1/models", timeout=5)
        check(
            "Endpoints require authentication",
            resp.status_code in (401, 403),
            "fail",
            f"Got {resp.status_code}" if resp.status_code == 200 else "",
        )
    except requests.ConnectionError:
        check("Gateway reachable", False, "fail", "Connection refused")
        return

    resp = requests.get(
        f"{base_url}/v1/models",
        headers={"Authorization": "Bearer invalid-key-12345"},
        timeout=5,
    )
    check("Invalid API key rejected", resp.status_code in (401, 403), "fail")

    resp = requests.get(
        f"{base_url}/v1/models",
        headers={"Authorization": "Bearer ' OR '1'='1"},
        timeout=5,
    )
    check(
        "SQL injection in auth header blocked",
        resp.status_code in (401, 403),
        "fail",
    )


def scan_headers(base_url):
    """Check security headers on gateway responses."""
    section("Security Headers")

    try:
        resp = requests.get(f"{base_url}/health", timeout=5)
    except requests.ConnectionError:
        check("Gateway reachable", False, "fail")
        return

    headers = resp.headers
    header_set = {k.lower() for k in headers}
    check(
        "No server version exposed",
        "server" not in headers or "Python" not in headers.get("server", ""),
        "warn",
        headers.get("server", "not set"),
    )
    check("Content-Type set", "content-type" in headers, "warn")
    check(
        "X-Content-Type-Options present",
        "x-content-type-options" in header_set,
        "fail",
    )
    check(
        "X-Frame-Options present",
        "x-frame-options" in header_set,
        "fail",
    )
    check(
        "Referrer-Policy present",
        "referrer-policy" in header_set,
        "warn",
    )


def scan_injection(base_url):
    """Check injection attack handling."""
    section("Injection Attacks")

    payloads = [
        ("SQL Injection", {"model": "'; DROP TABLE users;--"}),
        ("XSS in model name", {"model": "<script>alert(1)</script>"}),
        ("Command Injection", {"model": "test; cat /etc/passwd"}),
        ("Path Traversal in model", {"model": "../../../etc/passwd"}),
    ]

    for name, extra in payloads:
        body = {**extra, "messages": [{"role": "user", "content": "test"}]}
        try:
            resp = requests.post(
                f"{base_url}/v1/chat/completions",
                json=body,
                headers={"Content-Type": "application/json"},
                timeout=5,
            )
            check(
                f"{name} handled safely",
                resp.status_code != 500,
                "fail",
                f"Status: {resp.status_code}",
            )
        except requests.ConnectionError:
            check(f"{name}", False, "warn", "Connection refused")


def main():
    """Run all security scans and report results."""
    parser = argparse.ArgumentParser(description="FinSavvyAI Security Scanner")
    parser.add_argument(
        "--base-url", default="http://localhost:8080", help="Gateway URL"
    )
    parser.add_argument(
        "--master-url", default="http://localhost:8000", help="Master URL"
    )
    parser.add_argument(
        "--worker-url", default="http://localhost:8001", help="Worker URL"
    )
    args = parser.parse_args()

    print("FinSavvyAI Security Scanner")
    print(f"Target: {args.base_url}")
    print(f"Master: {args.master_url}")
    print(f"Worker: {args.worker_url}")

    scan_tls(args.base_url)
    scan_auth(args.base_url)
    scan_headers(args.base_url)
    scan_injection(args.base_url)
    scan_rate_limiting(args.base_url)
    scan_endpoints(args.base_url, args.master_url)
    scan_information_disclosure(args.base_url)
    scan_worker_security(args.worker_url)

    print(f"\n{'=' * 60}")
    print("  RESULTS")
    print(f"{'=' * 60}")
    total = results["pass"] + results["fail"] + results["warn"]
    print(f"  Total checks: {total}")
    print(f"  [{PASS}] {results['pass']} passed")
    print(f"  [{FAIL}] {results['fail']} failed")
    print(f"  [{WARN}] {results['warn']} warnings")
    print()

    if results["fail"] > 0:
        print(f"  VERDICT: {FAIL} - {results['fail']} critical issue(s) found")
        sys.exit(1)
    elif results["warn"] > 0:
        print(f"  VERDICT: {WARN} - Passed with {results['warn']} warning(s)")
        sys.exit(0)
    else:
        print(f"  VERDICT: {PASS} - All checks passed")
        sys.exit(0)


if __name__ == "__main__":
    main()
