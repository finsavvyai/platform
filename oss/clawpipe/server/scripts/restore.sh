#!/bin/bash
# FinSavvyAI Restore Script
# Restores from a backup created by backup.sh
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

INSTALL_DIR="${INSTALL_DIR:-/opt/finsavvyai}"

if [ -z "$1" ]; then
    echo "Usage: $0 <backup-file.tar.gz>"
    echo ""
    echo "Available backups:"
    ls -lh "${INSTALL_DIR}/backups"/finsavvyai-backup-*.tar.gz 2>/dev/null || echo "  No backups found in ${INSTALL_DIR}/backups/"
    exit 1
fi

BACKUP_FILE="$1"
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

echo -e "${GREEN}FinSavvyAI Restore${NC}"
echo "================================"
echo "Backup: $BACKUP_FILE"
echo ""

# Confirm
echo -e "${YELLOW}This will overwrite current configuration. Services should be stopped.${NC}"
read -p "Continue? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

# Extract backup
TEMP_DIR=$(mktemp -d)
echo -n "  Extracting backup... "
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"
BACKUP_DIR=$(ls "$TEMP_DIR")
echo "done"

# Stop services
echo -n "  Stopping services... "
sudo systemctl stop finsavvyai-worker 2>/dev/null || true
sudo systemctl stop finsavvyai-gateway 2>/dev/null || true
sudo systemctl stop finsavvyai-master 2>/dev/null || true
echo "done"

# Restore API keys
echo -n "  Restoring API keys... "
if [ -d "$TEMP_DIR/$BACKUP_DIR/finsavvyai-config" ]; then
    mkdir -p "$INSTALL_DIR/.finsavvyai"
    cp -r "$TEMP_DIR/$BACKUP_DIR/finsavvyai-config/"* "$INSTALL_DIR/.finsavvyai/"
    chmod 700 "$INSTALL_DIR/.finsavvyai"
    echo "done"
else
    echo "skipped (not in backup)"
fi

# Restore environment config
echo -n "  Restoring environment config... "
if [ -f "$TEMP_DIR/$BACKUP_DIR/.env" ]; then
    cp "$TEMP_DIR/$BACKUP_DIR/.env" "$INSTALL_DIR/.env"
    chmod 600 "$INSTALL_DIR/.env"
    echo "done"
else
    echo "skipped"
fi

# Restore cluster config
echo -n "  Restoring cluster config... "
if [ -f "$TEMP_DIR/$BACKUP_DIR/cluster-config.json" ]; then
    cp "$TEMP_DIR/$BACKUP_DIR/cluster-config.json" "$INSTALL_DIR/.finsavvyai/"
    echo "done"
else
    echo "skipped"
fi

# Restore tunnel credentials
echo -n "  Restoring tunnel credentials... "
if [ -d "$TEMP_DIR/$BACKUP_DIR/tunnel-credentials" ]; then
    mkdir -p "$INSTALL_DIR/cloudflare-tunnel/credentials"
    cp -r "$TEMP_DIR/$BACKUP_DIR/tunnel-credentials/"* "$INSTALL_DIR/cloudflare-tunnel/credentials/"
    chmod 600 "$INSTALL_DIR/cloudflare-tunnel/credentials/"*
    echo "done"
else
    echo "skipped"
fi

# Restore systemd services
echo -n "  Restoring systemd services... "
if [ -d "$TEMP_DIR/$BACKUP_DIR/systemd" ] && ls "$TEMP_DIR/$BACKUP_DIR/systemd/"*.service &>/dev/null; then
    sudo cp "$TEMP_DIR/$BACKUP_DIR/systemd/"*.service /etc/systemd/system/
    sudo systemctl daemon-reload
    echo "done"
else
    echo "skipped"
fi

# Fix ownership
echo -n "  Fixing permissions... "
if id finsavvyai &>/dev/null; then
    chown -R finsavvyai:finsavvyai "$INSTALL_DIR" 2>/dev/null || true
fi
echo "done"

# Cleanup
rm -rf "$TEMP_DIR"

# Start services
echo -n "  Starting services... "
sudo systemctl start finsavvyai-master
sleep 3
sudo systemctl start finsavvyai-gateway
sleep 2
sudo systemctl start finsavvyai-worker
echo "done"

# Verify
echo ""
echo -e "${GREEN}Restore complete!${NC}"
echo ""
echo "Verify services:"
echo "  sudo systemctl status finsavvyai-master"
echo "  sudo systemctl status finsavvyai-gateway"
echo "  sudo systemctl status finsavvyai-worker"
echo ""
echo "  curl http://localhost:8000/health"
echo "  curl http://localhost:8080/health"
