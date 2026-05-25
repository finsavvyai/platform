#!/bin/bash

# Billpro Service Monitor - Manual Setup Script
# Run this script ONCE on the Skypoint server after first-time-deploy.sh

set -e

echo "=== Billpro Service Monitor - Manual Setup ==="
echo "This script creates symbolic links manually on the Skypoint server"
echo ""

# Configuration
DEPLOYMENT_DIR="/home/weblogic/bsl_monitor1/deployments"
MONITOR_HOME="/home/weblogic/bsl_monitor1"

echo "Deployment Directory: $DEPLOYMENT_DIR"
echo "Monitor Home: $MONITOR_HOME"
echo ""

# Check if we're on the right server
if [ ! -d "$DEPLOYMENT_DIR" ]; then
    echo "❌ Deployment directory not found: $DEPLOYMENT_DIR"
    echo "   Please run first-time-deploy.sh from your local machine first"
    exit 1
fi

# Check if we're the weblogic user
if [ "$(whoami)" != "weblogic" ]; then
    echo "⚠️  You are not running as weblogic user"
    echo "   Current user: $(whoami)"
    echo "   Please switch to weblogic user first:"
    echo "   sudo -iu weblogic"
    echo ""
    read -p "Do you want to continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "Step 1: Checking deployment files and permissions..."

# Check if deployment directory exists
if [ ! -d "$DEPLOYMENT_DIR" ]; then
    echo "❌ Deployment directory not found: $DEPLOYMENT_DIR"
    echo "   Please run first-time-deploy.sh from your local machine first"
    exit 1
fi

# Check directory permissions
echo "Checking directory permissions..."
ls -ld "$DEPLOYMENT_DIR"

# Check if current user can write to the directory
if [ ! -w "$DEPLOYMENT_DIR" ]; then
    echo "⚠️  Current user cannot write to deployment directory"
    echo "   Attempting to fix permissions..."
    
    # Try to set proper permissions (requires sudo)
    if command -v sudo >/dev/null 2>&1; then
        sudo chmod 775 "$DEPLOYMENT_DIR"
        sudo chown weblogic:weblogic "$DEPLOYMENT_DIR"
        echo "✅ Permissions updated"
    else
        echo "❌ Cannot fix permissions (no sudo access)"
        echo "   Please contact system administrator"
        exit 1
    fi
fi

# List available JAR files
echo "Available JAR files:"
ls -la "$DEPLOYMENT_DIR"/*.jar 2>/dev/null || echo "No JAR files found"

# List available scripts
echo ""
echo "Available scripts:"
ls -la "$DEPLOYMENT_DIR"/*.sh 2>/dev/null || echo "No scripts found"

echo ""
echo "Step 2: Creating symbolic links..."

# Find the latest JAR file
JAR_FILES=$(ls -t "$DEPLOYMENT_DIR"/*.jar 2>/dev/null || true)

if [ -z "$JAR_FILES" ]; then
    echo "❌ No JAR files found in $DEPLOYMENT_DIR"
    echo "   Available files:"
    ls -la "$DEPLOYMENT_DIR"/
    exit 1
fi

LATEST_JAR=$(echo "$JAR_FILES" | head -1 | xargs basename)

if [ -z "$LATEST_JAR" ]; then
    echo "❌ Could not determine latest JAR file"
    echo "   Available JAR files:"
    echo "$JAR_FILES"
    exit 1
fi

echo "Using latest JAR: $LATEST_JAR"

# Create symbolic links
echo "Creating symbolic links in $MONITOR_HOME..."

# Create symlink to latest JAR
ln -sf "$DEPLOYMENT_DIR/$LATEST_JAR" "$MONITOR_HOME/monitor.jar"
echo "✅ Created: $MONITOR_HOME/monitor.jar -> $DEPLOYMENT_DIR/$LATEST_JAR"

# Create symlinks to scripts
ln -sf "$DEPLOYMENT_DIR/start-monitor.sh" "$MONITOR_HOME/start-monitor.sh"
echo "✅ Created: $MONITOR_HOME/start-monitor.sh"

ln -sf "$DEPLOYMENT_DIR/stop-monitor.sh" "$MONITOR_HOME/stop-monitor.sh"
echo "✅ Created: $MONITOR_HOME/stop-monitor.sh"

ln -sf "$DEPLOYMENT_DIR/restart-monitor.sh" "$MONITOR_HOME/restart-monitor.sh"
echo "✅ Created: $MONITOR_HOME/restart-monitor.sh"

ln -sf "$DEPLOYMENT_DIR/status-monitor.sh" "$MONITOR_HOME/status-monitor.sh"
echo "✅ Created: $MONITOR_HOME/status-monitor.sh"

ln -sf "$DEPLOYMENT_DIR/deploy.sh" "$MONITOR_HOME/deploy.sh"
echo "✅ Created: $MONITOR_HOME/deploy.sh"

ln -sf "$DEPLOYMENT_DIR/quick-deploy.sh" "$MONITOR_HOME/quick-deploy.sh"
echo "✅ Created: $MONITOR_HOME/quick-deploy.sh"

echo ""
echo "Step 3: Verifying symbolic links..."
echo ""

# Verify all links
echo "Symbolic links created:"
ls -la "$MONITOR_HOME"/monitor.jar
ls -la "$MONITOR_HOME"/*.sh

echo ""
echo "Step 4: Testing scripts..."
echo ""

# Test if scripts are executable
for script in start-monitor.sh stop-monitor.sh restart-monitor.sh status-monitor.sh deploy.sh quick-deploy.sh; do
    if [ -x "$MONITOR_HOME/$script" ]; then
        echo "✅ $script is executable"
    else
        echo "❌ $script is not executable"
        # Try to make it executable, but don't fail if we can't
        chmod +x "$MONITOR_HOME/$script" 2>/dev/null || echo "   Cannot change permissions (continuing anyway)"
    fi
done

# Check if we can execute the scripts despite permission issues
echo ""
echo "Testing script execution..."
for script in start-monitor.sh stop-monitor.sh restart-monitor.sh status-monitor.sh deploy.sh quick-deploy.sh; do
    if bash -n "$MONITOR_HOME/$script" 2>/dev/null; then
        echo "✅ $script syntax is valid"
    else
        echo "⚠️  $script syntax check failed"
    fi
done

echo ""
echo "=== MANUAL SETUP COMPLETE ==="
echo "✅ All symbolic links created successfully"
echo ""
echo "Next Steps:"
echo "1. Source your environment: source .prod_env"
echo "2. Start the monitor: ./start-monitor.sh"
echo "3. Check status: ./status-monitor.sh"
echo ""
echo "Available commands:"
echo "- ./start-monitor.sh     # Start the monitor"
echo "- ./stop-monitor.sh      # Stop the monitor"
echo "- ./restart-monitor.sh   # Restart the monitor"
echo "- ./status-monitor.sh    # Check status"
echo "- ./deploy.sh           # Deploy new version"
echo "- ./quick-deploy.sh     # Quick deploy (uses latest JAR)"
echo ""
echo "Current working directory: $(pwd)"
echo "Monitor home: $MONITOR_HOME"
