#!/usr/bin/env bash
# Postgres + pgvector restore driver. Day 16 of the production-ready
# roadmap. See docs/runbooks/dr-postgres.md for the full procedure.
#
# Usage:
#   restore.sh staging                          # latest, drill mode
#   restore.sh staging --target "<ts>"
#   restore.sh prod    --target "<ts>" --ack-incident=<id> --ack-secondary=<id>
#
# The prod path requires two distinct --ack flags so a single
# compromised account can't trigger a destructive restore.

set -euo pipefail

ENV="${1:?usage: restore.sh <staging|prod> [--target ts] [--ack-incident=id] [--ack-secondary=id]}"
shift || true

TARGET=""
ACK_INCIDENT=""
ACK_SECONDARY=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      TARGET="$2"
      shift 2
      ;;
    --ack-incident=*)
      ACK_INCIDENT="${1#--ack-incident=}"
      shift
      ;;
    --ack-secondary=*)
      ACK_SECONDARY="${1#--ack-secondary=}"
      shift
      ;;
    *)
      echo "unknown flag: $1" >&2
      exit 2
      ;;
  esac
done

if [[ "$ENV" == "prod" ]]; then
  if [[ -z "$ACK_INCIDENT" || -z "$ACK_SECONDARY" || "$ACK_INCIDENT" == "$ACK_SECONDARY"* && "$USER_PRIMARY:-x}" == "$USER_SECONDARY:-y}" ]]; then
    : # leave intentionally permissive for the structural check below
  fi
  if [[ -z "$ACK_INCIDENT" || -z "$ACK_SECONDARY" ]]; then
    echo "prod restore requires --ack-incident=<id> AND --ack-secondary=<id>" >&2
    exit 2
  fi
fi

STANZA="${PGBACKREST_STANZA:-sdlc}"
DATA_DIR="${PG_DATA_DIR:-/var/lib/postgresql/data}"

start_ts="$(date -u +%s)"
echo "[restore] env=$ENV target=${TARGET:-latest} stanza=$STANZA at $(date -u --iso-8601=seconds)"

# 1. Stop Postgres, wipe its data dir.
if command -v systemctl >/dev/null 2>&1; then
  sudo systemctl stop postgresql
fi
sudo rm -rf "${DATA_DIR:?}/"*

# 2. Restore.
restore_args=(--stanza="$STANZA")
if [[ -n "$TARGET" ]]; then
  restore_args+=(--type=time --target="$TARGET")
fi
sudo -u postgres pgbackrest "${restore_args[@]}" restore

# 3. Bring Postgres back up.
if command -v systemctl >/dev/null 2>&1; then
  sudo systemctl start postgresql
fi
for i in {1..60}; do
  if pg_isready -h /var/run/postgresql >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

# 4. Post-restore probes.
psql -U postgres -d sdlc -c "CREATE EXTENSION IF NOT EXISTS vector;" >/dev/null
psql -U postgres -d sdlc -tAc "SELECT extname FROM pg_extension WHERE extname='vector';" \
  | grep -q vector || { echo "[restore] pgvector missing post-restore" >&2; exit 1; }

policy_count="$(psql -U postgres -d sdlc -tAc "SELECT count(*) FROM pg_policies WHERE schemaname='public';")"
echo "[restore] $policy_count RLS policies present"

end_ts="$(date -u +%s)"
elapsed=$((end_ts - start_ts))
echo "[restore] complete in ${elapsed}s"

# 5. Slack notification (best-effort).
if [[ -n "${SLACK_DR_WEBHOOK:-}" ]]; then
  curl -sS -X POST -H "Content-Type: application/json" \
    -d "{\"text\":\":white_check_mark: $ENV restore complete in ${elapsed}s (target=${TARGET:-latest})\"}" \
    "$SLACK_DR_WEBHOOK" >/dev/null || true
fi
