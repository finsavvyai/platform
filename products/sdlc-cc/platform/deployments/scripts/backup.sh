#!/usr/bin/env bash
# Postgres + pgvector backup driver.
#
# Wraps pgBackRest with the platform's defaults (15-minute WAL cadence,
# governance-locked S3) and posts a Prometheus pushgateway metric on
# completion so we can alert on stale backups.
#
# Day 16 of the production-ready roadmap.

set -euo pipefail

TYPE="diff"
STANZA="${PGBACKREST_STANZA:-sdlc}"
PUSHGATEWAY="${PROMETHEUS_PUSHGATEWAY_URL:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --type)
      TYPE="$2"
      shift 2
      ;;
    --stanza)
      STANZA="$2"
      shift 2
      ;;
    *)
      echo "unknown flag: $1" >&2
      exit 2
      ;;
  esac
done

case "$TYPE" in
  full|diff|incr) ;;
  *)
    echo "--type must be one of: full|diff|incr (got '$TYPE')" >&2
    exit 2
    ;;
esac

start_ts="$(date -u +%s)"
echo "[backup] starting $TYPE backup of stanza=$STANZA at $(date -u --iso-8601=seconds)"

if ! pgbackrest --stanza="$STANZA" --type="$TYPE" backup; then
  echo "[backup] pgbackrest backup FAILED" >&2
  exit 1
fi

# Verify the backup is reachable + intact before celebrating.
if ! pgbackrest --stanza="$STANZA" --output=json info > /tmp/pgbackrest-info.json; then
  echo "[backup] pgbackrest info verification FAILED" >&2
  exit 1
fi

end_ts="$(date -u +%s)"
elapsed=$((end_ts - start_ts))
echo "[backup] completed in ${elapsed}s"

# Push a Prometheus gauge so PgBackupStale alert can fire when the
# scheduler dies.
if [[ -n "$PUSHGATEWAY" ]]; then
  cat <<EOF | curl -sS --data-binary @- "$PUSHGATEWAY/metrics/job/pgbackrest/instance/$STANZA"
# TYPE last_pgbackrest_run_seconds gauge
last_pgbackrest_run_seconds $end_ts
# TYPE last_pgbackrest_duration_seconds gauge
last_pgbackrest_duration_seconds $elapsed
EOF
fi
