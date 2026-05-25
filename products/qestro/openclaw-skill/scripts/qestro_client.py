#!/usr/bin/env python3
"""
Qestro API Client for OpenClaw Skill
=====================================

This script is invoked by the OpenClaw AI agent to interact
with the Qestro testing platform API. It handles:

- Dashboard status queries
- Test suite execution
- Failure analysis
- AI-powered test generation
- Self-healing status checks
- Daily QA summaries

Usage:
    python3 qestro_client.py dashboard
    python3 qestro_client.py run-suite "Login Regression"
    python3 qestro_client.py failures
    python3 qestro_client.py analyze "test-id-123"
    python3 qestro_client.py generate --scenario "checkout flow" --platform web
    python3 qestro_client.py self-healing
    python3 qestro_client.py daily-summary

Environment:
    QESTRO_API_URL  - Base URL (default: http://localhost:3020)
    QESTRO_API_KEY  - API key for authentication
"""

import os
import sys
import json
import urllib.request
import urllib.error
from datetime import datetime

# ─── Configuration ────────────────────────────────────────────────────

QESTRO_API = os.environ.get("QESTRO_API_URL", "http://localhost:3020")
QESTRO_KEY = os.environ.get("QESTRO_API_KEY", "")

# ─── API Client ───────────────────────────────────────────────────────

def api_request(method, path, data=None, timeout=30):
    """Make an authenticated request to the Qestro API."""
    url = f"{QESTRO_API}/api{path}"
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if QESTRO_KEY:
        headers["Authorization"] = f"Bearer {QESTRO_KEY}"

    req_data = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body) if body else {"success": True}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        try:
            return json.loads(body)
        except json.JSONDecodeError:
            return {"error": True, "status": e.code, "message": body[:500]}
    except urllib.error.URLError as e:
        return {"error": True, "message": f"Connection failed: {e.reason}"}
    except Exception as e:
        return {"error": True, "message": str(e)}


def openclaw_request(action, params=None):
    """Make a request via the OpenClaw incoming webhook endpoint."""
    return api_request("POST", "/openclaw/incoming", {
        "action": action,
        "params": params or {},
    })


# ─── Commands ─────────────────────────────────────────────────────────

def cmd_dashboard():
    """Get dashboard statistics and QA health overview."""
    result = openclaw_request("dashboard")

    if result.get("success") and result.get("data"):
        d = result["data"]
        tc = d.get("testCases", {})
        ex = d.get("execution", {})
        sb = ex.get("statusBreakdown", {})
        sec = d.get("security", {})
        ai = d.get("aiStats", {})
        sys_info = d.get("system", {})

        print(f"📊 Qestro Dashboard")
        print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print(f"🖥️  System: {sys_info.get('status', 'N/A')} | Uptime: {sys_info.get('uptime', 'N/A')}")
        print()
        print(f"🧪 Test Cases: {tc.get('total', 0)} total ({tc.get('active', 0)} active)")

        by_type = tc.get("byType", {})
        if by_type:
            parts = [f"{k}: {v}" for k, v in by_type.items()]
            print(f"   Types: {', '.join(parts)}")

        print()
        print(f"📈 Coverage: {ex.get('coverage', 0)}%")
        print(f"   ✅ Passed: {sb.get('passed', 0)}%")
        print(f"   ❌ Failed: {sb.get('failed', 0)}%")
        print(f"   ⏳ Pending: {sb.get('pending', 0)}%")
        print()
        print(f"🛡️  Security: {sec.get('grade', 'N/A')} ({sec.get('score', 0)}/100)")

        crit = sec.get("criticalIssues", 0)
        if crit == 0:
            print(f"   ✅ No critical vulnerabilities")
        else:
            print(f"   ⚠️  {crit} critical issues!")

        print()
        print(f"🤖 AI Stats:")
        print(f"   🔧 Self-Healed: {ai.get('selfHealed', 0)} tests")
        print(f"   ✨ Generated: {ai.get('generated', 0)} tests")
        opt_ms = ai.get("optimizedTimeMs", 0)
        print(f"   ⚡ Optimized: {opt_ms / 1000:.1f}s saved")
    else:
        print(f"❌ Failed to fetch dashboard: {result.get('message', result.get('error', 'Unknown error'))}")


def cmd_run_suite(suite_name):
    """Execute a test suite by name."""
    if not suite_name:
        print("❌ Please specify a suite name.")
        print("Usage: run-suite \"Login Regression\"")
        return

    result = openclaw_request("run-suite", {"suite": suite_name})

    if result.get("success") and result.get("data"):
        d = result["data"]
        print(f"🧪 Test Suite Execution Started")
        print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print(f"📋 Suite: {suite_name}")
        print(f"🔑 Run ID: {d.get('id', 'N/A')}")
        print(f"📊 Status: {d.get('status', 'N/A')}")
        print(f"🧩 Tests: {d.get('testCount', 'N/A')} cases")
        print(f"⏱️  ETA: {d.get('estimatedDuration', 'N/A')}")
        print()
        print(f"I'll notify you when results are ready.")
    else:
        print(f"❌ Failed to start suite: {result.get('message', 'Unknown error')}")


def cmd_failures():
    """Get recent test failures."""
    result = openclaw_request("failures")

    if result.get("success") and result.get("data"):
        d = result["data"]
        count = d.get("count", 0)
        failures = d.get("recentFailures", [])

        if count == 0:
            print("✅ No recent test failures! All systems green. 🟢")
        else:
            print(f"⚠️  {count} Recent Failures")
            print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            for i, f in enumerate(failures, 1):
                print(f"  {i}. ❌ {f.get('name', 'Unknown')}")
                print(f"     Error: {f.get('error', 'No details')}")
                print(f"     ID: {f.get('id', 'N/A')}")
                print()
            print(f"💡 Use 'analyze <test-id>' for AI root cause analysis.")
    else:
        print(f"❌ Failed to fetch failures: {result.get('message', 'Unknown error')}")


def cmd_analyze(test_id):
    """Analyze a specific test failure using AI."""
    if not test_id:
        print("❌ Please specify a test ID to analyze.")
        print("Usage: analyze \"test-id-123\"")
        return

    # Use the AI testing endpoint for analysis
    result = api_request("POST", "/ai/analyze-failure", {"testId": test_id})

    if result.get("success") and result.get("data"):
        d = result["data"]
        print(f"🔍 AI Failure Analysis")
        print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print(f"🔑 Test ID: {test_id}")
        print(f"🎯 Root Cause: {d.get('rootCause', 'Unknown')}")
        print(f"📁 Category: {d.get('category', 'Unknown')}")
        print(f"📊 Confidence: {d.get('confidence', 0) * 100:.0f}%")
        print()
        print(f"💡 Suggested Fix:")
        print(f"   {d.get('suggestedFix', 'No suggestion available')}")

        prevention = d.get("preventionSteps", [])
        if prevention:
            print()
            print(f"🛡️  Prevention Steps:")
            for step in prevention:
                print(f"   • {step}")
    else:
        print(f"❌ Analysis failed: {result.get('message', 'Unknown error')}")


def cmd_generate(scenario, platform="web"):
    """Generate test cases from a natural language description."""
    if not scenario:
        print("❌ Please describe the test scenario.")
        print('Usage: generate --scenario "user login with 2FA" --platform web')
        return

    result = api_request("POST", "/ai/generate-test", {
        "description": scenario,
        "framework": "playwright",
        "testType": "e2e",
        "url": "",
    })

    if result.get("success"):
        code = result.get("testCode", "")
        meta = result.get("metadata", {})

        print(f"✨ Test Generated Successfully")
        print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print(f"📋 Scenario: {scenario}")
        print(f"🌐 Platform: {platform}")
        print(f"🔧 Framework: {meta.get('framework', 'playwright')}")
        print(f"📅 Generated: {meta.get('generatedAt', datetime.now().isoformat())}")
        print()
        print(f"📝 Generated Code:")
        print(f"```typescript")
        print(code)
        print(f"```")
        print()
        print(f"💡 Want me to save this test to Qestro? Just say 'save it'.")
    else:
        print(f"❌ Generation failed: {result.get('message', result.get('error', 'Unknown error'))}")


def cmd_self_healing():
    """Get self-healing status and recent fixes."""
    result = openclaw_request("dashboard")

    if result.get("success") and result.get("data"):
        ai = result["data"].get("aiStats", {})
        healed = ai.get("selfHealed", 0)
        print(f"🔧 Self-Healing Status")
        print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print(f"   Tests Saved: {healed}")
        print(f"   Status: {'🟢 Active' if healed > 0 else '⚪ No recent activity'}")
        print()
        print(f"Self-healing automatically fixes:")
        print(f"   • Broken CSS/XPath selectors")
        print(f"   • Timing issues (added waits)")
        print(f"   • Assertion value drift")
        print(f"   • Retry logic for flaky tests")
    else:
        print(f"❌ Failed to fetch status: {result.get('message', 'Unknown error')}")


def cmd_daily_summary():
    """Get the daily QA summary."""
    result = openclaw_request("dashboard")

    if result.get("success") and result.get("data"):
        d = result["data"]
        tc = d.get("testCases", {})
        ex = d.get("execution", {})
        sb = ex.get("statusBreakdown", {})
        ai = d.get("aiStats", {})
        sec = d.get("security", {})

        today = datetime.now().strftime("%B %d, %Y")

        print(f"📋 Daily QA Summary — {today}")
        print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print()
        print(f"📊 Overall Health: {'🟢 Excellent' if sb.get('failed', 0) < 5 else '🟡 Needs Attention'}")
        print()
        print(f"🧪 Tests: {tc.get('total', 0)} total | {tc.get('active', 0)} active")
        print(f"📈 Coverage: {ex.get('coverage', 0)}%")
        print(f"✅ Pass Rate: {sb.get('passed', 0)}%")
        print(f"❌ Failure Rate: {sb.get('failed', 0)}%")
        print()
        print(f"🤖 AI Activity:")
        print(f"   🔧 Tests Self-Healed: {ai.get('selfHealed', 0)}")
        print(f"   ✨ Tests Generated: {ai.get('generated', 0)}")
        print()
        print(f"🛡️  Security: {sec.get('grade', 'N/A')} ({sec.get('score', 0)}/100)")
        crit = sec.get("criticalIssues", 0)
        print(f"   {'✅ No critical issues' if crit == 0 else f'⚠️ {crit} critical issues'}")
        print()
        print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print(f"Powered by Qestro AI Testing Platform")
    else:
        print(f"❌ Failed to generate summary: {result.get('message', 'Unknown error')}")


# ─── CLI Dispatcher ───────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print("🧪 Qestro CLI — OpenClaw Integration")
        print()
        print("Commands:")
        print("  dashboard          Show QA dashboard stats")
        print("  run-suite <name>   Execute a test suite")
        print("  failures           Show recent test failures")
        print("  analyze <id>       AI analysis of a test failure")
        print("  generate           Generate test from description")
        print("  self-healing       Show self-healing status")
        print("  daily-summary      Daily QA summary report")
        print()
        print(f"API: {QESTRO_API}")
        print(f"Key: {'configured' if QESTRO_KEY else 'not set'}")
        return

    cmd = sys.argv[1].lower()

    if cmd == "dashboard":
        cmd_dashboard()
    elif cmd == "run-suite":
        suite = sys.argv[2] if len(sys.argv) > 2 else ""
        cmd_run_suite(suite)
    elif cmd == "failures":
        cmd_failures()
    elif cmd == "analyze":
        test_id = sys.argv[2] if len(sys.argv) > 2 else ""
        cmd_analyze(test_id)
    elif cmd == "generate":
        scenario = ""
        platform = "web"
        if "--scenario" in sys.argv:
            idx = sys.argv.index("--scenario") + 1
            if idx < len(sys.argv):
                scenario = sys.argv[idx]
        if "--platform" in sys.argv:
            idx = sys.argv.index("--platform") + 1
            if idx < len(sys.argv):
                platform = sys.argv[idx]
        cmd_generate(scenario, platform)
    elif cmd == "self-healing":
        cmd_self_healing()
    elif cmd == "daily-summary":
        cmd_daily_summary()
    else:
        print(f"❌ Unknown command: {cmd}")
        print("Use 'python3 qestro_client.py' without arguments to see available commands.")


if __name__ == "__main__":
    main()
