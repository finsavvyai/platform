#!/bin/bash
# Billpro Service Monitor - Simple Fix Permissions Script
# Run this script on the Skypoint server to fix permission issues after upload

set -e

echo "=== Billpro Service Monitor - Fix Permissions ==="
echo "This script fixes permissions for uploaded files"
echo ""

# Configuration
WEBLOGIC_HOME="/home/weblogic/bsl_monitor1"
DEPLOYMENT_DIR="/home/weblogic/bsl_monitor1/deployments"

# Check if running as scq9102
if [ "$USER" != "scq9102" ]; then
    echo "❌ This script should be run as scq9102 user"
    echo "   Current user: $USER"
    exit 1
fi

echo "✅ Running as scq9102 user"

# Check if directories exist
if [ ! -d "$WEBLOGIC_HOME" ]; then
    echo "❌ WebLogic home directory not found: $WEBLOGIC_HOME"
    exit 1
fi

if [ ! -d "$DEPLOYMENT_DIR" ]; then
    echo "❌ Deployment directory not found: $DEPLOYMENT_DIR"
    exit 1
fi

echo "✅ Directories found"

# Check if we have sudo access
if ! sudo -n true 2>/dev/null; then
    echo "❌ No sudo access or password required"
    echo "   Please run: sudo -l"
    echo "   If you have sudo access, you may need to enter your password"
    exit 1
fi

echo "✅ Sudo access confirmed"

# Fix permissions
echo ""
echo "Step 1: Setting ownership to weblogic:weblogic..."
sudo chown -R weblogic:weblogic "$WEBLOGIC_HOME"

echo "Step 2: Setting directory permissions..."
sudo chmod 775 "$WEBLOGIC_HOME"
sudo chmod 775 "$DEPLOYMENT_DIR"

echo "Step 3: Setting file permissions..."
sudo chmod 755 "$DEPLOYMENT_DIR"/*.sh 2>/dev/null || echo "   No .sh files found"
sudo chmod 644 "$DEPLOYMENT_DIR"/*.jar 2>/dev/null || echo "   No .jar files found"
sudo chmod 644 "$DEPLOYMENT_DIR"/*.md 2>/dev/null || echo "   No .md files found"

echo "Step 4: Adding scq9102 to weblogic group..."
sudo usermod -a -G weblogic scq9102 2>/dev/null || echo "   User scq9102 already in weblogic group"

echo ""
echo "✅ Permissions fixed successfully!"
echo ""
echo "Step 5: Verification..."
echo "Directory permissions:"
ls -ld "$WEBLOGIC_HOME"
ls -ld "$DEPLOYMENT_DIR"

echo ""
echo "File permissions:"
ls -la "$DEPLOYMENT_DIR"/

echo ""
echo "Group membership:"
groups scq9102

echo ""
echo "🎉 Setup complete! You can now:"
echo "1. Log out and log back in for group changes to take effect"
echo "2. Run the manual setup script as weblogic user:"
echo "   sudo -iu weblogic"
echo "   bash /home/weblogic/bsl_monitor1/deployments/manual-setup.sh"
