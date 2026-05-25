#!/usr/bin/env bash
# trace-query.sh — wrapper around `trace_processor` for the canonical
# pipewarden Perfetto SQL queries under scripts/perfetto/.
#
# Usage:
#   scripts/trace-query.sh scan_p95
#   scripts/trace-query.sh scan_p95 /path/to/some.trace
#
# The Makefile target `make trace-query Q=<name>` is the recommended
# entry point for contributors; this script is what it calls.

set -euo pipefail

QUERY="${1:-}"
TRACE="${2:-/tmp/pipewarden.trace}"
SQL_DIR="$(cd "$(dirname "$0")/perfetto" && pwd)"

if [ -z "$QUERY" ]; then
  echo "Usage: $0 <query-name> [trace-file]" >&2
  echo "Available queries:" >&2
  for f in "$SQL_DIR"/*.sql; do
    name="$(basename "$f" .sql)"
    desc="$(head -1 "$f" | sed -E 's/^-- *[^—-]*[—-] *//')"
    printf '  %-20s %s\n' "$name" "$desc" >&2
  done
  exit 64
fi

SQL="$SQL_DIR/$QUERY.sql"

if [ ! -f "$SQL" ]; then
  echo "Unknown query: $QUERY (no $SQL)" >&2
  echo "See $SQL_DIR for available *.sql files." >&2
  exit 64
fi

if ! command -v trace_processor >/dev/null 2>&1; then
  cat >&2 <<'EOF'
trace_processor binary not found. Install with:

  curl -L https://get.perfetto.dev/trace_processor -o /usr/local/bin/trace_processor
  chmod +x /usr/local/bin/trace_processor

(macOS: brew install perfetto)
See docs/sre/trace-cookbook.md for full setup.
EOF
  exit 127
fi

if [ ! -f "$TRACE" ]; then
  echo "Trace file not found: $TRACE" >&2
  echo "Capture one first by running pipewarden with PIPEWARDEN_TRACE=1." >&2
  exit 1
fi

exec trace_processor "$TRACE" -q "$SQL"
