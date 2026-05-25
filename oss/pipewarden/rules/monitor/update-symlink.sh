#!/bin/bash
# Update symbolic link to latest JAR file

echo "=== Updating Symbolic Link ==="

DEPLOYMENT_DIR="/home/weblogic/bsl_monitor1/deployments"
MONITOR_HOME="/home/weblogic/bsl_monitor1"

# Find the latest JAR file
echo "Finding latest JAR file..."
JAR_FILES=$(ls -t "$DEPLOYMENT_DIR"/*.jar 2>/dev/null || true)

if [ -z "$JAR_FILES" ]; then
    echo "❌ No JAR files found in $DEPLOYMENT_DIR"
    exit 1
fi

LATEST_JAR=$(echo "$JAR_FILES" | head -1 | xargs basename)

if [ -z "$LATEST_JAR" ]; then
    echo "❌ Could not determine latest JAR file"
    exit 1
fi

echo "Latest JAR: $LATEST_JAR"

# Update symbolic link
echo "Updating symbolic link..."
cd "$MONITOR_HOME"
ln -sf "deployments/$LATEST_JAR" monitor.jar

echo "✅ Symbolic link updated"
echo "Current link:"
ls -la monitor.jar

echo ""
echo "🎉 Ready to start the monitor!"
echo "Run: ./start-monitor.sh"
