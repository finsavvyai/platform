#!/usr/bin/env bash
set -e
find logs -type f -name "*.log" -delete 2>/dev/null || true
echo "Logs cleaned."
