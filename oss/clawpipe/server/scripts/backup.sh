#!/bin/bash
# FinSavvyAI Automated Backup Script
# Run manually or via cron: 0 2 * * * /opt/finsavvyai/scripts/backup.sh
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

INSTALL_DIR="${INSTALL_DIR:-/opt/finsavvyai}"
BACKUP_DIR="${BACKUP_DIR:-/opt/finsavvyai/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="finsavvyai-backup-${TIMESTAMP}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

echo -e "${GREEN}FinSavvyAI Backup${NC} - $(date)"
echo "================================"

# Create backup directory
mkdir -p "$BACKUP_PATH"

# 1. Backup API keys and auth data
echo -n "  API keys & auth... "
if [ -d "$INSTALL_DIR/.finsavvyai" ]; then
    cp -r "$INSTALL_DIR/.finsavvyai" "$BACKUP_PATH/finsavvyai-config/"
    echo "done"
else
    # Try home directory
    if [ -d "$HOME/.finsavvyai" ]; then
        cp -r "$HOME/.finsavvyai" "$BACKUP_PATH/finsavvyai-config/"
        echo "done (from ~)"
    else
        echo "skipped (not found)"
    fi
fi

# 2. Backup environment config
echo -n "  Environment config... "
for envfile in "$INSTALL_DIR/.env" "$INSTALL_DIR/scripts/config/production.env"; do
    if [ -f "$envfile" ]; then
        cp "$envfile" "$BACKUP_PATH/"
    fi
done
echo "done"

# 3. Backup cluster config
echo -n "  Cluster config... "
if [ -f "$INSTALL_DIR/cluster-config.json" ] || [ -f "$HOME/.finsavvyai/cluster-config.json" ]; then
    cp "$INSTALL_DIR/cluster-config.json" "$BACKUP_PATH/" 2>/dev/null || \
    cp "$HOME/.finsavvyai/cluster-config.json" "$BACKUP_PATH/" 2>/dev/null || true
    echo "done"
else
    echo "skipped"
fi

# 4. Backup Cloudflare tunnel credentials
echo -n "  Cloudflare tunnel... "
if [ -d "$INSTALL_DIR/cloudflare-tunnel/credentials" ]; then
    cp -r "$INSTALL_DIR/cloudflare-tunnel/credentials" "$BACKUP_PATH/tunnel-credentials/"
    echo "done"
else
    echo "skipped"
fi

# 5. Backup systemd service files
echo -n "  Systemd services... "
mkdir -p "$BACKUP_PATH/systemd"
cp /etc/systemd/system/finsavvyai-*.service "$BACKUP_PATH/systemd/" 2>/dev/null || echo -n "(not installed) "
echo "done"

# 6. Backup Grafana dashboards (if running in Docker)
echo -n "  Grafana data... "
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q finsavvyai-grafana; then
    docker cp finsavvyai-grafana:/var/lib/grafana "$BACKUP_PATH/grafana-data/" 2>/dev/null && echo "done" || echo "skipped"
else
    echo "skipped (not running)"
fi

# 7. Backup Prometheus data snapshot (if running)
echo -n "  Prometheus snapshot... "
if curl -s -XPOST http://localhost:9090/api/v1/admin/tsdb/snapshot > /dev/null 2>&1; then
    echo "triggered (manual copy needed)"
else
    echo "skipped"
fi

# 8. Compress backup
echo -n "  Compressing... "
cd "$BACKUP_DIR"
tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"
rm -rf "$BACKUP_PATH"
BACKUP_SIZE=$(du -sh "${BACKUP_NAME}.tar.gz" | cut -f1)
echo "done (${BACKUP_SIZE})"

# 9. Clean old backups
echo -n "  Cleaning backups older than ${RETENTION_DAYS} days... "
DELETED=$(find "$BACKUP_DIR" -name "finsavvyai-backup-*.tar.gz" -mtime +${RETENTION_DAYS} -delete -print | wc -l)
echo "${DELETED} removed"

# Summary
echo ""
echo -e "${GREEN}Backup complete!${NC}"
echo "  Location: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
echo "  Size: ${BACKUP_SIZE}"
echo ""
echo "Restore with:"
echo "  tar -xzf ${BACKUP_NAME}.tar.gz"
echo "  cp -r ${BACKUP_NAME}/finsavvyai-config/* ~/.finsavvyai/"
