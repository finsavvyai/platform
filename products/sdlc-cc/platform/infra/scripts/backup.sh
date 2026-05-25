#!/usr/bin/env bash
set -euo pipefail

# ─── SDLC Platform Backup Script ─────────────────────────
# Backs up PostgreSQL, Redis, and configuration data
# Designed for cron scheduling: 0 2 * * * /path/to/backup.sh
# ──────────────────────────────────────────────────────────

BACKUP_DIR="${BACKUP_DIR:-/var/backups/sdlc-platform}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
NAMESPACE="${K8S_NAMESPACE:-sdlc-platform}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="${BACKUP_DIR}/${TIMESTAMP}"
LOG_FILE="${BACKUP_DIR}/backup.log"
S3_BUCKET="${S3_BACKUP_BUCKET:-}"
SLACK_WEBHOOK="${SLACK_WEBHOOK_URL:-}"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $1" | tee -a "$LOG_FILE"; }
error() { log "ERROR: $1"; notify_failure "$1"; exit 1; }

notify_failure() {
    if [[ -n "$SLACK_WEBHOOK" ]]; then
        curl -s -X POST "$SLACK_WEBHOOK" \
            -H 'Content-Type: application/json' \
            -d "{\"text\":\"🚨 SDLC Backup FAILED: $1\nTimestamp: ${TIMESTAMP}\nHost: $(hostname)\"}" || true
    fi
}

notify_success() {
    if [[ -n "$SLACK_WEBHOOK" ]]; then
        curl -s -X POST "$SLACK_WEBHOOK" \
            -H 'Content-Type: application/json' \
            -d "{\"text\":\"✅ SDLC Backup completed\nTimestamp: ${TIMESTAMP}\nSize: $1\nDuration: $2s\"}" || true
    fi
}

mkdir -p "$BACKUP_PATH"
START_TIME=$(date +%s)
log "Starting backup: ${TIMESTAMP}"

# ─── PostgreSQL Backup ────────────────────────────────────
log "Backing up PostgreSQL..."

PG_POD=$(kubectl -n "$NAMESPACE" get pod -l app=sdlc-postgres -o jsonpath='{.items[0].metadata.name}' 2>/dev/null) \
    || error "Cannot find PostgreSQL pod"

kubectl -n "$NAMESPACE" exec "$PG_POD" -- \
    pg_dump -U sdlc -Fc --no-owner --no-acl sdlc \
    > "${BACKUP_PATH}/postgres_sdlc.dump" \
    || error "PostgreSQL dump failed"

# Verify dump is valid
PG_SIZE=$(stat -f%z "${BACKUP_PATH}/postgres_sdlc.dump" 2>/dev/null || stat --printf="%s" "${BACKUP_PATH}/postgres_sdlc.dump")
if [[ "$PG_SIZE" -lt 1024 ]]; then
    error "PostgreSQL dump suspiciously small: ${PG_SIZE} bytes"
fi
log "PostgreSQL backup: ${PG_SIZE} bytes"

# ─── Redis Backup ─────────────────────────────────────────
log "Backing up Redis..."

REDIS_POD=$(kubectl -n "$NAMESPACE" get pod -l app=sdlc-redis -o jsonpath='{.items[0].metadata.name}' 2>/dev/null) \
    || error "Cannot find Redis pod"

# Trigger BGSAVE and wait
kubectl -n "$NAMESPACE" exec "$REDIS_POD" -- redis-cli BGSAVE || error "Redis BGSAVE failed"
sleep 5

kubectl -n "$NAMESPACE" cp "${REDIS_POD}:/data/dump.rdb" "${BACKUP_PATH}/redis_dump.rdb" \
    || error "Redis dump copy failed"

REDIS_SIZE=$(stat -f%z "${BACKUP_PATH}/redis_dump.rdb" 2>/dev/null || stat --printf="%s" "${BACKUP_PATH}/redis_dump.rdb")
log "Redis backup: ${REDIS_SIZE} bytes"

# ─── Kubernetes Config Backup ─────────────────────────────
log "Backing up Kubernetes config..."

kubectl -n "$NAMESPACE" get configmaps -o yaml > "${BACKUP_PATH}/configmaps.yaml" 2>/dev/null || true
kubectl -n "$NAMESPACE" get secrets -o yaml > "${BACKUP_PATH}/secrets.yaml.enc" 2>/dev/null || true
kubectl -n "$NAMESPACE" get deployments -o yaml > "${BACKUP_PATH}/deployments.yaml" 2>/dev/null || true
kubectl -n "$NAMESPACE" get services -o yaml > "${BACKUP_PATH}/services.yaml" 2>/dev/null || true
kubectl -n "$NAMESPACE" get ingress -o yaml > "${BACKUP_PATH}/ingress.yaml" 2>/dev/null || true

# Encrypt secrets backup
if command -v gpg &>/dev/null && [[ -n "${GPG_KEY_ID:-}" ]]; then
    gpg --encrypt --recipient "$GPG_KEY_ID" "${BACKUP_PATH}/secrets.yaml.enc"
    rm -f "${BACKUP_PATH}/secrets.yaml.enc"
    log "Secrets encrypted with GPG"
fi

# ─── Compress ─────────────────────────────────────────────
log "Compressing backup..."
tar -czf "${BACKUP_DIR}/${TIMESTAMP}.tar.gz" -C "$BACKUP_DIR" "$TIMESTAMP"
rm -rf "$BACKUP_PATH"

TOTAL_SIZE=$(stat -f%z "${BACKUP_DIR}/${TIMESTAMP}.tar.gz" 2>/dev/null || stat --printf="%s" "${BACKUP_DIR}/${TIMESTAMP}.tar.gz")
log "Compressed backup: ${TOTAL_SIZE} bytes"

# ─── Upload to S3 ────────────────────────────────────────
if [[ -n "$S3_BUCKET" ]]; then
    log "Uploading to S3: ${S3_BUCKET}..."
    aws s3 cp "${BACKUP_DIR}/${TIMESTAMP}.tar.gz" \
        "s3://${S3_BUCKET}/backups/${TIMESTAMP}.tar.gz" \
        --storage-class STANDARD_IA \
        --sse aws:kms \
        || error "S3 upload failed"
    log "S3 upload complete"
fi

# ─── Cleanup Old Backups ─────────────────────────────────
log "Cleaning up backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "*.tar.gz" -mtime "+${RETENTION_DAYS}" -delete 2>/dev/null || true

if [[ -n "$S3_BUCKET" ]]; then
    # Set S3 lifecycle policy instead of manual deletion
    log "S3 lifecycle policy handles remote retention"
fi

# ─── Checksum ─────────────────────────────────────────────
sha256sum "${BACKUP_DIR}/${TIMESTAMP}.tar.gz" > "${BACKUP_DIR}/${TIMESTAMP}.sha256"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

log "Backup completed in ${DURATION}s — ${TOTAL_SIZE} bytes"
notify_success "$(numfmt --to=iec "$TOTAL_SIZE" 2>/dev/null || echo "${TOTAL_SIZE} bytes")" "$DURATION"
