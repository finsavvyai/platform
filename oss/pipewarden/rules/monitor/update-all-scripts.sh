#!/bin/bash
# Update all deployment scripts with correct Spring Boot configuration

echo "=== Updating All Deployment Scripts ==="

# Configuration
SKYPOINT_SERVER="dk01"
SKYPOINT_DEPLOYMENT_DIR="/home/weblogic/bsl_monitor1/deployments"
TEMP_DIR="/tmp/bsl-monitor-temp"

# Create updated scripts locally
echo "Creating updated scripts..."

# Create updated start script
cat > /tmp/start-monitor-fixed.sh << 'EOF'
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

# Create updated deploy script
cat > /tmp/deploy-fixed.sh << 'EOF'
#!/bin/bash

# Billpro Service Monitor - Deploy Script
# Usage: ./deploy.sh [JAR_NAME]

set -e

DEPLOYMENT_DIR="/home/weblogic/bsl_monitor1/deployments"
MONITOR_HOME="/home/weblogic/bsl_monitor1"

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

echo "Deploying Billpro Service Monitor..."
echo "JAR: $JAR_NAME"

# Stop existing monitor
./stop-monitor.sh

# Start with new JAR
./start-monitor.sh "$JAR_NAME"

echo "✅ Deployment completed"
echo "Check status: ./status-monitor.sh"
EOF

# Create updated quick-deploy script
cat > /tmp/quick-deploy-fixed.sh << 'EOF'
#!/bin/bash

# Billpro Service Monitor - Quick Deploy Script
# This script is for continuous deployment without recreating scripts

set -e

DEPLOYMENT_DIR="/home/weblogic/bsl_monitor1/deployments"
MONITOR_HOME="/home/weblogic/bsl_monitor1"

echo "Quick Deploy - Billpro Service Monitor"

# Find the latest JAR
JAR_FILES=$(ls -t "$DEPLOYMENT_DIR"/*.jar 2>/dev/null || true)

if [ -z "$JAR_FILES" ]; then
    echo "❌ No JAR files found in $DEPLOYMENT_DIR"
    echo "Available files in $DEPLOYMENT_DIR:"
    ls -la "$DEPLOYMENT_DIR"/
    exit 1
fi

LATEST_JAR=$(echo "$JAR_FILES" | head -1 | xargs basename)

if [ -z "$LATEST_JAR" ]; then
    echo "❌ Could not determine latest JAR file"
    echo "Available JAR files:"
    echo "$JAR_FILES"
    exit 1
fi

echo "Using latest JAR: $LATEST_JAR"

# Stop existing monitor
./stop-monitor.sh

# Start with latest JAR
./start-monitor.sh "$LATEST_JAR"

echo "✅ Quick deployment completed"
echo "Check status: ./status-monitor.sh"
EOF

echo "✅ Updated scripts created locally"

# Upload to server
echo "Uploading updated scripts to server..."
ssh "$SKYPOINT_SERVER" "mkdir -p $TEMP_DIR"
scp /tmp/start-monitor-fixed.sh "$SKYPOINT_SERVER:$TEMP_DIR/"
scp /tmp/deploy-fixed.sh "$SKYPOINT_SERVER:$TEMP_DIR/"
scp /tmp/quick-deploy-fixed.sh "$SKYPOINT_SERVER:$TEMP_DIR/"

# Move to deployment directory
echo "Moving scripts to deployment directory..."
ssh "$SKYPOINT_SERVER" "
    mv $TEMP_DIR/start-monitor-fixed.sh $SKYPOINT_DEPLOYMENT_DIR/start-monitor.sh
    mv $TEMP_DIR/deploy-fixed.sh $SKYPOINT_DEPLOYMENT_DIR/deploy.sh
    mv $TEMP_DIR/quick-deploy-fixed.sh $SKYPOINT_DEPLOYMENT_DIR/quick-deploy.sh
    chmod +x $SKYPOINT_DEPLOYMENT_DIR/*.sh
    rmdir $TEMP_DIR
    echo '✅ All scripts updated and made executable'
"

# Clean up local temp files
rm -f /tmp/start-monitor-fixed.sh /tmp/deploy-fixed.sh /tmp/quick-deploy-fixed.sh

echo ""
echo "🎉 All deployment scripts updated!"
echo "Now you can run: ./start-monitor.sh"

