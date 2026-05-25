#!/bin/bash
# Fix ownership and permissions for deployment files

echo "=== Fixing Ownership and Permissions ==="

DEPLOYMENT_DIR="/home/weblogic/bsl_monitor1/deployments"

# Check if running as scq9102 user (who has sudo access)
if [ "$(whoami)" != "scq9102" ]; then
    echo "❌ This script should be run as scq9102 user"
    echo "   Current user: $(whoami)"
    echo "   Please switch to scq9102 user first:"
    echo "   exit  # if you're currently weblogic user"
    echo "   # then run this script as scq9102"
    exit 1
fi

echo "✅ Running as scq9102 user"

# Check if deployment directory exists
if [ ! -d "$DEPLOYMENT_DIR" ]; then
    echo "❌ Deployment directory not found: $DEPLOYMENT_DIR"
    exit 1
fi

echo "✅ Deployment directory found"

# Fix ownership and permissions with sudo
echo "Fixing ownership and permissions..."
sudo chown -R weblogic:weblogic "$DEPLOYMENT_DIR"
sudo chmod +x "$DEPLOYMENT_DIR"/*.sh
sudo chmod 644 "$DEPLOYMENT_DIR"/*.jar 2>/dev/null || true
sudo chmod 644 "$DEPLOYMENT_DIR"/*.md 2>/dev/null || true

echo "✅ Ownership and permissions fixed"

# Verify the changes
echo ""
echo "Updated file permissions:"
ls -la "$DEPLOYMENT_DIR"/

echo ""
echo "🎉 Files fixed!"
echo "Now switch to weblogic user and start the monitor:"
echo "   sudo -iu weblogic"
echo "   cd /home/weblogic/bsl_monitor1"
echo "   ./start-monitor.sh"

