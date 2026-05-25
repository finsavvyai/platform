#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "${ROOT}/.env" 2>/dev/null || true

echo "→ Starting Gateway (9000)..."
uvicorn services.gateway.app:app --host 127.0.0.1 --port 9000 --reload
