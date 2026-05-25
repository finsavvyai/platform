#!/bin/bash
# FinSavvyAI Production Systemd Installation
# Installs and configures all services for production deployment on Linux
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

INSTALL_DIR="/opt/finsavvyai"
LOG_DIR="/var/log/finsavvyai"
SERVICE_USER="finsavvyai"
SERVICE_GROUP="finsavvyai"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SYSTEMD_DIR="$SCRIPT_DIR/systemd"

echo -e "${GREEN}FinSavvyAI Production Systemd Installation${NC}"
echo "============================================"
echo ""

# Must run as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}This script must be run as root (sudo)${NC}"
    exit 1
fi

# Step 1: Create service user
echo -e "${GREEN}[1/7] Creating service user...${NC}"
if ! id "$SERVICE_USER" &>/dev/null; then
    useradd --system --shell /usr/sbin/nologin --home-dir "$INSTALL_DIR" "$SERVICE_USER"
    echo "  Created user: $SERVICE_USER"
else
    echo "  User $SERVICE_USER already exists"
fi

# Step 2: Create directories
echo -e "${GREEN}[2/7] Creating directories...${NC}"
mkdir -p "$INSTALL_DIR"/{src,scripts,logs,models}
mkdir -p "$LOG_DIR"
mkdir -p "$INSTALL_DIR/.finsavvyai"

echo "  $INSTALL_DIR"
echo "  $LOG_DIR"

# Step 3: Copy application files
echo -e "${GREEN}[3/7] Deploying application files...${NC}"
cp -r "$PROJECT_DIR/src" "$INSTALL_DIR/"
cp -r "$PROJECT_DIR/scripts" "$INSTALL_DIR/"
cp "$PROJECT_DIR/requirements.txt" "$INSTALL_DIR/"
cp "$PROJECT_DIR/pyproject.toml" "$INSTALL_DIR/"

if [ -f "$PROJECT_DIR/main.py" ]; then
    cp "$PROJECT_DIR/main.py" "$INSTALL_DIR/"
fi
echo "  Copied source to $INSTALL_DIR"

# Step 4: Install Python dependencies
echo -e "${GREEN}[4/7] Installing dependencies...${NC}"
if [ -f "$INSTALL_DIR/requirements.txt" ]; then
    pip3 install --quiet -r "$INSTALL_DIR/requirements.txt"
    echo "  Dependencies installed"
else
    echo -e "${YELLOW}  requirements.txt not found, skipping${NC}"
fi

# Step 5: Set up production environment
echo -e "${GREEN}[5/7] Configuring environment...${NC}"
if [ ! -f "$INSTALL_DIR/.env" ]; then
    if [ -f "$PROJECT_DIR/scripts/config/production.env.example" ]; then
        cp "$PROJECT_DIR/scripts/config/production.env.example" "$INSTALL_DIR/.env"
        echo "  Copied production.env.example -> .env"
        echo -e "${YELLOW}  IMPORTANT: Edit $INSTALL_DIR/.env with production values${NC}"
    fi
else
    echo "  .env already exists, preserving"
fi

# Step 6: Set permissions
echo -e "${GREEN}[6/7] Setting permissions...${NC}"
chown -R "$SERVICE_USER:$SERVICE_GROUP" "$INSTALL_DIR"
chown -R "$SERVICE_USER:$SERVICE_GROUP" "$LOG_DIR"
chmod 750 "$INSTALL_DIR"
chmod 600 "$INSTALL_DIR/.env" 2>/dev/null || true
chmod 700 "$INSTALL_DIR/.finsavvyai"
echo "  Owner: $SERVICE_USER:$SERVICE_GROUP"

# Step 7: Install systemd services
echo -e "${GREEN}[7/7] Installing systemd services...${NC}"
for service_file in "$SYSTEMD_DIR"/finsavvyai-*.service; do
    if [ -f "$service_file" ]; then
        service_name=$(basename "$service_file")
        cp "$service_file" /etc/systemd/system/
        echo "  Installed $service_name"
    fi
done

systemctl daemon-reload
systemctl enable finsavvyai-master.service
systemctl enable finsavvyai-gateway.service
systemctl enable finsavvyai-worker.service
echo "  Services enabled for boot"

echo ""
echo -e "${GREEN}Installation complete!${NC}"
echo "============================================"
echo ""
echo "Before starting, edit the production config:"
echo "  sudo nano $INSTALL_DIR/.env"
echo ""
echo "Start services (in order):"
echo "  sudo systemctl start finsavvyai-master"
echo "  sudo systemctl start finsavvyai-gateway"
echo "  sudo systemctl start finsavvyai-worker"
echo ""
echo "Check status:"
echo "  sudo systemctl status finsavvyai-master"
echo "  sudo systemctl status finsavvyai-gateway"
echo "  sudo systemctl status finsavvyai-worker"
echo ""
echo "View logs:"
echo "  journalctl -u finsavvyai-master -f"
echo "  journalctl -u finsavvyai-gateway -f"
echo "  journalctl -u finsavvyai-worker -f"
echo ""
echo "Health checks:"
echo "  curl http://localhost:8000/health"
echo "  curl http://localhost:8080/health"
echo "  curl http://localhost:8001/health"
