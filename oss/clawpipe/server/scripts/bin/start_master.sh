#!/bin/bash
# Start only the cluster master

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

PYTHON_BIN="${FINSAVVYAI_PYTHON:-python3}"
if [ -z "${FINSAVVYAI_PYTHON:-}" ] && [ -x "$REPO_ROOT/.venv/bin/python" ]; then
    PYTHON_BIN="$REPO_ROOT/.venv/bin/python"
fi

"$PYTHON_BIN" src/core/start_master.py
