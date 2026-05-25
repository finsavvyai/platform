#!/bin/bash
# Fix permissions for deployment scripts

echo "=== Fixing Script Permissions ==="

DEPLOYMENT_DIR="/home/weblogic/bsl_monitor1/deployments"

# Check if running as weblogic user
if [ "$(whoami)" != "weblogic" ]; then
    echo "❌ This script should be run as weblogic user"
    echo "   Current user: $(whoami)"
    echo "   Please switch to weblogic user first:"
    echo "   sudo -iu weblogic"
    exit 1
fi

echo "✅ Running as weblogic user"

# Check if deployment directory exists
if [ ! -d "$DEPLOYMENT_DIR" ]; then
    echo "❌ Deployment directory not found: $DEPLOYMENT_DIR"
    exit 1
fi

echo "✅ Deployment directory found"

# Make all scripts executable
echo "Making scripts executable..."
chmod +x "$DEPLOYMENT_DIR"/*.sh

echo "✅ Scripts made executable"

# Verify permissions
echo ""
echo "Script permissions:"
ls -la "$DEPLOYMENT_DIR"/*.sh

echo ""
echo "🎉 Permissions fixed!"
echo "Now you can run: ./start-monitor.sh"
