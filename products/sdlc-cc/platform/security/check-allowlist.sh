#!/bin/bash
# Verify every entry in security/allowlist.yml has cve, tool, service,
# reason, expires; fail if any entry is past its expiry date.
#
# Run from repo root or pass the file path:  check-allowlist.sh [path]

set -euo pipefail

FILE="${1:-security/allowlist.yml}"
if [ ! -f "$FILE" ]; then
  echo "ERROR: allowlist not found: $FILE" >&2
  exit 2
fi

python3 - "$FILE" <<'PY'
import datetime as dt
import sys

import yaml

path = sys.argv[1]
with open(path) as f:
    data = yaml.safe_load(f) or {}

entries = data.get("allowlist") or []
if not isinstance(entries, list):
    sys.exit("allowlist must be a list")

required = {"cve", "tool", "service", "reason", "expires"}
today = dt.date.today()
errors = []

for i, entry in enumerate(entries):
    if not isinstance(entry, dict):
        errors.append(f"[{i}] not a mapping")
        continue
    missing = required - entry.keys()
    if missing:
        errors.append(f"[{i}] {entry.get('cve','?')}: missing {sorted(missing)}")
        continue
    expires = entry["expires"]
    if isinstance(expires, str):
        expires = dt.date.fromisoformat(expires)
    if not isinstance(expires, dt.date):
        errors.append(f"[{i}] {entry['cve']}: 'expires' must be a date")
        continue
    if expires < today:
        errors.append(
            f"[{i}] {entry['cve']}: expired on {expires} — re-evaluate or remove"
        )

if errors:
    print("Allowlist validation FAILED:", file=sys.stderr)
    for line in errors:
        print(f"  - {line}", file=sys.stderr)
    sys.exit(1)

print(f"Allowlist OK ({len(entries)} entries)")
PY
