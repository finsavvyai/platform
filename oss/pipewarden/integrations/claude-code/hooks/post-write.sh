#!/usr/bin/env bash
#
# postToolUse hook for Claude Code: scan the file Claude just wrote.
#
# Wire in ~/.claude/settings.json under hooks.postToolUse, matcher="Edit|Write".
# Claude Code passes the tool result JSON on stdin; we extract the
# touched path and run `pipewarden scan` on it. Exit non-zero on any
# finding of severity >= high so Claude has to fix before continuing.
#
# Set PIPEWARDEN_HOOK_DISABLED=1 to make this a no-op.
set -euo pipefail

if [[ "${PIPEWARDEN_HOOK_DISABLED:-}" == "1" ]]; then
  exit 0
fi

if ! command -v pipewarden >/dev/null 2>&1; then
  # Fail-open: don't block Claude when pipewarden isn't installed,
  # just note the absence.
  printf 'pipewarden hook: CLI not installed, skipping scan\n' >&2
  exit 0
fi

payload=$(cat)
path=$(printf '%s' "$payload" | python3 -c '
import json, sys
try:
    data = json.loads(sys.stdin.read())
except Exception:
    sys.exit(0)
ti = data.get("tool_input", {}) or {}
print(ti.get("file_path") or ti.get("path") or "")
' 2>/dev/null || true)

if [[ -z "$path" || ! -f "$path" ]]; then
  exit 0
fi

# Skip obvious non-source files to keep the hook fast.
case "$path" in
  *.md|*.txt|*.json|*.yml|*.yaml|*.toml|*.lock|*.svg|*.png|*.jpg|*.gif)
    exit 0
    ;;
esac

# Run the scan, JSON output, capture exit code.
report=$(pipewarden scan "$path" --format=json 2>/dev/null || true)

if [[ -z "$report" ]]; then
  exit 0
fi

# Count findings of severity high or critical.
high=$(printf '%s' "$report" | python3 -c '
import json, sys
try:
    data = json.loads(sys.stdin.read())
except Exception:
    sys.exit(0)
n = 0
for f in data.get("findings", []) or []:
    sev = (f.get("severity") or "").lower()
    if sev in ("high", "critical"):
        n += 1
print(n)
' 2>/dev/null || echo 0)

if [[ "$high" -gt 0 ]]; then
  printf '\npipewarden: %s blocked %d high/critical finding(s) in %s\n' \
    "post-write hook" "$high" "$path" >&2
  printf 'Re-run `pipewarden scan %s` for the full report.\n' "$path" >&2
  printf 'Override with PIPEWARDEN_HOOK_DISABLED=1 to bypass.\n' >&2
  exit 1
fi

exit 0
