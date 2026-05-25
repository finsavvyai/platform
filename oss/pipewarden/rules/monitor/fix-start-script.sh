#!/bin/bash
# Fix the start-monitor.sh script on the server

echo "=== Fixing Start Script ==="

# Configuration
SKYPOINT_SERVER="dk01"
SKYPOINT_DEPLOYMENT_DIR="/home/weblogic/bsl_monitor1/deployments"
TEMP_DIR="/tmp/bsl-monitor-temp"

# Create fixed start script content
cat > /tmp/fixed-start-monitor.sh << 'EOF'
#!/bin/bash

# Billpro Service Monitor - Start Script
# Usage: ./start-monitor.sh [JAR_NAME]

set -e

DEPLOYMENT_DIR="/home/weblogic/bsl_monitor1/deployments"
MONITOR_HOME="/home/weblogic/bsl_monitor1"
PID_FILE="$MONITOR_HOME/monitor.pid"
LOG_FILE="$MONITOR_HOME/run_bsl.out"

# Use provided JAR name or find the latest one
if [ -n "$1" ]; then
    JAR_NAME="$1"
else
    # Find the latest JAR file more robustly
    JAR_FILES=$(ls -t "$DEPLOYMENT_DIR"/*.jar 2>/dev/null || true)
    
    if [ -z "$JAR_FILES" ]; then
        echo "❌ No JAR files found in $DEPLOYMENT_DIR"
        echo "Available files in $DEPLOYMENT_DIR:"
        ls -la "$DEPLOYMENT_DIR"/
        exit 1
    fi
    
    JAR_NAME=$(echo "$JAR_FILES" | head -1 | xargs basename)
    
    if [ -z "$JAR_NAME" ]; then
        echo "❌ Could not determine JAR file name"
        echo "Available JAR files:"
        echo "$JAR_FILES"
        exit 1
    fi
fi

if [ ! -f "$DEPLOYMENT_DIR/$JAR_NAME" ]; then
    echo "❌ JAR file not found: $DEPLOYMENT_DIR/$JAR_NAME"
    echo "Available files in $DEPLOYMENT_DIR:"
    ls -la "$DEPLOYMENT_DIR"/
    exit 1
fi

echo "Starting Billpro Service Monitor..."
echo "JAR: $JAR_NAME"
echo "Home: $MONITOR_HOME"

cd "$MONITOR_HOME"

# Source production environment if available
if [ -f ".prod_env" ]; then
    echo "Sourcing production environment..."
    source .prod_env
fi

# Check if already running
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 $PID 2>/dev/null; then
        echo "⚠️  Monitor is already running (PID: $PID)"
        echo "   Use ./stop-monitor.sh first, or ./restart-monitor.sh"
        exit 1
    else
        echo "Removing stale PID file..."
        rm -f "$PID_FILE"
    fi
fi

# Start the monitor with specific process name
nohup java -Dspring.application.name=bsl-monitor \
  -jar "$DEPLOYMENT_DIR/$JAR_NAME" \
  --spring.profiles.active=prod \
  > "$LOG_FILE" 2>&1 &

echo $! > "$PID_FILE"
echo "✅ BSL Monitor started with PID: $(cat $PID_FILE)"
echo "Process Name: bsl-monitor"
echo "Port: 9093"
echo "Logs: $LOG_FILE"
echo "PID File: $PID_FILE"
EOF

echo "✅ Fixed start script created locally"

# Upload to server
echo "Uploading fixed start script to server..."
ssh "$SKYPOINT_SERVER" "mkdir -p $TEMP_DIR"
scp /tmp/fixed-start-monitor.sh "$SKYPOINT_SERVER:$TEMP_DIR/"

# Move to deployment directory
echo "Moving script to deployment directory..."
ssh "$SKYPOINT_SERVER" "
    mv $TEMP_DIR/fixed-start-monitor.sh $SKYPOINT_DEPLOYMENT_DIR/start-monitor.sh
    chmod +x $SKYPOINT_DEPLOYMENT_DIR/start-monitor.sh
    rmdir $TEMP_DIR
    echo '✅ Fixed start script uploaded and made executable'
"

# Clean up local temp file
rm -f /tmp/fixed-start-monitor.sh

echo ""
echo "🎉 Start script fixed!"
echo "Now you can run: ./start-monitor.sh"

