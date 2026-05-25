#!/usr/bin/env bash
# AMLIQ database backup helper.
#
# Usage:
#   DB_URL=postgres://user:pass@host:5432/aml ./scripts/backup.sh
#   DB_URL=... BACKUP_DIR=/var/backups ./scripts/backup.sh
#
# Exit codes:
#   0  backup succeeded, file written
#   1  pg_dump failed (network, auth, OOM)
#   2  required env / tool missing
#
# RTO target: 4 hours. RPO target: 24 hours (daily backup cadence).
# Retention: 30 daily, 12 monthly, 7 annual. Tier mapped to
# data-handling-policy.md §4.

set -euo pipefail

: "${DB_URL:?DB_URL env var is required (postgres connection string)}"

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TS="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
OUT="${BACKUP_DIR}/aegis-${TS}.sql.gz"

mkdir -p "${BACKUP_DIR}"

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump not found in PATH — install postgresql-client" >&2
  exit 2
fi

echo "[backup] dumping to ${OUT}"
pg_dump --no-owner --no-privileges --format=plain "${DB_URL}" \
  | gzip -9 > "${OUT}"

SIZE_BYTES="$(wc -c < "${OUT}" | tr -d ' ')"
echo "[backup] complete: ${OUT} (${SIZE_BYTES} bytes)"

# Sanity: a backup smaller than 1 KB almost always means the dump
# silently produced an empty file (network reset, auth failure not
# returning non-zero on some pg versions).
if [ "${SIZE_BYTES}" -lt 1024 ]; then
  echo "[backup] FAIL: output ${OUT} is suspiciously small" >&2
  exit 1
fi

# Optional: SHA-256 the artefact so audit can prove integrity.
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "${OUT}" > "${OUT}.sha256"
  echo "[backup] checksum: $(cat "${OUT}.sha256")"
fi
