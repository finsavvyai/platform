#!/usr/bin/env bash
# AMLIQ database restore helper.
#
# Usage:
#   DB_URL=postgres://user:pass@host:5432/aml \
#   BACKUP_FILE=./backups/aegis-2026-04-29T00-00-00Z.sql.gz \
#   ./scripts/restore.sh
#
# Verifies the SHA-256 checksum (if present) before loading. Refuses
# to run against a database whose name does not contain "restore" or
# "test" — production restores must use scripts/dr_failover.sh which
# requires a maintenance-window flag.

set -euo pipefail

: "${DB_URL:?DB_URL env var is required}"
: "${BACKUP_FILE:?BACKUP_FILE env var is required}"

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "backup file not found: ${BACKUP_FILE}" >&2
  exit 2
fi

if [[ -f "${BACKUP_FILE}.sha256" ]]; then
  echo "[restore] verifying checksum"
  sha256sum -c "${BACKUP_FILE}.sha256"
fi

DB_NAME="$(echo "${DB_URL}" | sed -E 's|.*/([^/?]+).*|\1|')"
case "${DB_NAME}" in
  *restore*|*test*|*staging*) ;;
  *)
    echo "REFUSING to restore over '${DB_NAME}'." >&2
    echo "Use a database whose name contains 'restore', 'test', or" >&2
    echo "'staging'. Production restores require dr_failover.sh." >&2
    exit 1
    ;;
esac

echo "[restore] loading ${BACKUP_FILE} → ${DB_NAME}"
gunzip -c "${BACKUP_FILE}" | psql "${DB_URL}"
echo "[restore] complete"
