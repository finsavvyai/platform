#!/bin/bash

# Billpro Service Monitor - Permission Setup Script
# Run this script ONCE on the Skypoint server to set up proper permissions

set -e

echo "=== Billpro Service Monitor - Permission Setup ==="
echo "This script sets up proper permissions for the deployment"
echo ""

# Configuration
WEBLOGIC_HOME="/home/weblogic/bsl_monitor1"
DEPLOYMENT_DIR="/home/weblogic/bsl_monitor1/deployments"

echo "WebLogic Home: $WEBLOGIC_HOME"
echo "Deployment Directory: $DEPLOYMENT_DIR"
echo ""

# Check if we're running as root or have sudo access
if [ "$(id -u)" -eq 0 ]; then
    echo "✅ Running as root"
    SUDO_CMD=""
elif command -v sudo >/dev/null 2>&1; then
    echo "✅ Sudo available"
    SUDO_CMD="sudo"
else
    echo "❌ No sudo access available"
    echo "   Please run this script as root or with sudo access"
    exit 1
fi

echo ""
echo "Step 1: Setting up directory structure..."

# Ensure /home/weblogic has proper permissions
echo "Checking /home/weblogic permissions..."
$SUDO_CMD chmod 755 /home/weblogic
echo "✅ Set /home/weblogic permissions to 755"

# Create weblogic directory if it doesn't exist
if [ ! -d "$WEBLOGIC_HOME" ]; then
    echo "Creating weblogic directory: $WEBLOGIC_HOME"
    $SUDO_CMD mkdir -p "$WEBLOGIC_HOME"
else
    echo "✅ WebLogic directory exists: $WEBLOGIC_HOME"
fi

# Create deployment directory if it doesn't exist
if [ ! -d "$DEPLOYMENT_DIR" ]; then
    echo "Creating deployment directory: $DEPLOYMENT_DIR"
    $SUDO_CMD mkdir -p "$DEPLOYMENT_DIR"
else
    echo "✅ Deployment directory exists: $DEPLOYMENT_DIR"
fi

echo ""
echo "Step 2: Setting ownership..."

# Set ownership to weblogic user
$SUDO_CMD chown -R weblogic:weblogic "$WEBLOGIC_HOME"
echo "✅ Set ownership to weblogic:weblogic"

echo ""
echo "Step 3: Setting up group access..."

# Add scq9102 to weblogic group
$SUDO_CMD usermod -a -G weblogic scq9102 2>/dev/null || echo "User scq9102 already in weblogic group"
echo "✅ Added scq9102 to weblogic group"

echo ""
echo "Step 4: Setting directory permissions..."

# Set directory permissions
$SUDO_CMD chmod 775 "$WEBLOGIC_HOME"
$SUDO_CMD chmod 775 "$DEPLOYMENT_DIR"
echo "✅ Set directory permissions to 775"

# Fix ownership of any existing files in deployment directory
echo "Fixing ownership of existing files..."
$SUDO_CMD chown -R weblogic:weblogic "$DEPLOYMENT_DIR" 2>/dev/null || echo "No existing files to fix ownership"
echo "✅ Fixed ownership of existing files"

echo ""
echo "Step 5: Verifying setup..."

# Show current permissions (using sudo if needed)
echo "Current directory permissions:"
if [ -r "$WEBLOGIC_HOME" ]; then
    ls -ld "$WEBLOGIC_HOME"
else
    echo "Cannot read $WEBLOGIC_HOME directly, using sudo:"
    $SUDO_CMD ls -ld "$WEBLOGIC_HOME"
fi

if [ -r "$DEPLOYMENT_DIR" ]; then
    ls -ld "$DEPLOYMENT_DIR"
else
    echo "Cannot read $DEPLOYMENT_DIR directly, using sudo:"
    $SUDO_CMD ls -ld "$DEPLOYMENT_DIR"
fi

# Show group membership
echo ""
echo "Group membership:"
$SUDO_CMD groups scq9102

echo ""
echo "=== PERMISSION SETUP COMPLETE ==="
echo "✅ All permissions set up successfully"
echo ""
echo "Next Steps:"
echo "1. Run first-time-deploy.sh from your local machine"
echo "2. SSH to server: ssh dk01"
echo "3. Switch to weblogic user: sudo -iu weblogic"
echo "4. Run manual setup: bash $DEPLOYMENT_DIR/manual-setup.sh"
echo ""
echo "Directory structure:"
echo "- $WEBLOGIC_HOME/ (weblogic:weblogic, 775)"
echo "- $DEPLOYMENT_DIR/ (weblogic:weblogic, 775)"
echo ""
echo "User access:"
echo "- weblogic: Full access (owner)"
echo "- scq9102: Group access (can upload files)"
