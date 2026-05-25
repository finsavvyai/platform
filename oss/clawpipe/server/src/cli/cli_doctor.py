"""CLI doctor and quickstart commands for FinSavvyAI."""

import os
import shutil
import socket
import subprocess
import sys


# ---------------------------------------------------------------------------
# doctor
# ---------------------------------------------------------------------------

_CHECKS = [
    ("Python >= 3.11", "_check_python"),
    ("pip / pip3 available", "_check_pip"),
    ("aiohttp installed", "_check_aiohttp"),
    ("FINSAVVYAI_API_KEY set", "_check_api_key"),
    ("Gateway reachable on :8080", "_check_gateway"),
    ("Master reachable on :8000", "_check_master"),
    ("Docker available (optional)", "_check_docker"),
]


def _check_python() -> tuple[bool, str]:
    ok = sys.version_info >= (3, 11)
    return ok, f"Python {sys.version.split()[0]}"


def _check_pip() -> tuple[bool, str]:
    ok = shutil.which("pip3") is not None or shutil.which("pip") is not None
    return ok, "pip3" if shutil.which("pip3") else ("pip" if shutil.which("pip") else "not found")


def _check_aiohttp() -> tuple[bool, str]:
    try:
        import aiohttp  # noqa: F401
        import importlib.metadata
        version = importlib.metadata.version("aiohttp")
        return True, f"aiohttp {version}"
    except Exception:
        return False, "not installed — run: pip install aiohttp"


def _check_api_key() -> tuple[bool, str]:
    val = os.environ.get("FINSAVVYAI_API_KEY", "")
    if val:
        return True, f"set ({val[:4]}…)"
    return False, "not set — add FINSAVVYAI_API_KEY to your .env"


def _check_gateway() -> tuple[bool, str]:
    return _check_port("localhost", 8080)


def _check_master() -> tuple[bool, str]:
    return _check_port("localhost", 8000)


def _check_docker() -> tuple[bool, str]:
    if shutil.which("docker") is None:
        return False, "not installed (optional)"
    try:
        result = subprocess.run(
            ["docker", "info"], capture_output=True, text=True, timeout=5
        )
        ok = result.returncode == 0
        return ok, "running" if ok else "daemon not running"
    except Exception:
        return False, "error running docker info"


def _check_port(host: str, port: int) -> tuple[bool, str]:
    try:
        with socket.create_connection((host, port), timeout=2):
            return True, f"{host}:{port} reachable"
    except OSError:
        return False, f"{host}:{port} not reachable — is the service running?"


async def run_doctor(cli) -> int:
    """Run all diagnostic checks and print a report."""
    c = cli.formatter._colorize
    cli._print_header("FinSavvyAI Doctor", "System diagnostics and setup checks")

    failures = 0
    check_fns = {
        "_check_python": _check_python,
        "_check_pip": _check_pip,
        "_check_aiohttp": _check_aiohttp,
        "_check_api_key": _check_api_key,
        "_check_gateway": _check_gateway,
        "_check_master": _check_master,
        "_check_docker": _check_docker,
    }

    for label, fn_name in _CHECKS:
        fn = check_fns[fn_name]
        try:
            ok, detail = fn()
        except Exception as exc:
            ok, detail = False, str(exc)
        icon = c("✓", "green") if ok else c("✗", "red")
        status = c("PASS", "green") if ok else c("FAIL", "red")
        print(f"  {icon}  {label:<40} {status}  {c(detail, 'gray')}")
        if not ok:
            failures += 1

    print()
    if failures == 0:
        print(c("All checks passed — you're good to go!", "green"))
    else:
        print(c(f"{failures} check(s) failed. Fix the issues above and re-run doctor.", "yellow"))
        print(c("Tip: run `finsavvyai quickstart` to start all services.", "gray"))
    print()
    return failures


# ---------------------------------------------------------------------------
# quickstart
# ---------------------------------------------------------------------------

QUICKSTART_STEPS = [
    "Copy .env.example → .env and fill in your API keys",
    "pip install -r requirements.txt",
    "python -m src.core.master_server &",
    "python -m src.workers.worker_node &",
    "python -m src.api.gateway",
]


async def run_quickstart(cli) -> None:
    """Print an interactive quickstart guide."""
    c = cli.formatter._colorize
    cli._print_header("FinSavvyAI Quickstart", "Get from zero to first API response in < 5 minutes")

    print(c("Step-by-step setup guide", "bold"))
    print()
    for i, step in enumerate(QUICKSTART_STEPS, 1):
        print(f"  {c(str(i), 'cyan')}. {step}")
    print()
    print(c("One-liner (Docker):", "bold"))
    print(f"  {c('docker run -p 8080:8080 finsavvyai/finsavvyai:latest', 'cyan')}")
    print()
    print(c("Verify:", "bold"))
    print(f"  {c('curl http://localhost:8080/health', 'cyan')}")
    print(f"  {c('curl http://localhost:8080/v1/models', 'cyan')}")
    print()
    print(c("Then run `finsavvyai doctor` to confirm everything is healthy.", "gray"))
    print()
