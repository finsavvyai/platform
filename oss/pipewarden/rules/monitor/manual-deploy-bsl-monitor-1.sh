#!/bin/bash

# Manual deployment script for bsl-monitor-1 on dktest server
# This script provides step-by-step instructions for manual deployment

set -e

echo "=== Manual Deployment to bsl-monitor-1 on dktest server ==="
echo ""

# Configuration
JAR_NAME="bsl-monitor-1.0.0-20250908_133144.jar"
DKTEST_SERVER="dktest"
DKTEST_DEPLOYMENT_DIR="/home/weblogic/bsl-monitor-1/deployments"
DKTEST_MONITOR_HOME="/home/weblogic/bsl-monitor-1"

echo "JAR Name: $JAR_NAME"
echo "Target Server: $DKTEST_SERVER"
echo "Target Directory: $DKTEST_MONITOR_HOME"
echo ""

echo "=== STEP 1: SSH to the server and create directories ==="
echo "Run these commands on the dktest server:"
echo ""
echo "ssh $DKTEST_SERVER"
echo "sudo mkdir -p $DKTEST_MONITOR_HOME"
echo "sudo mkdir -p $DKTEST_DEPLOYMENT_DIR"
echo "sudo chown weblogic:weblogic $DKTEST_MONITOR_HOME"
echo "sudo chown weblogic:weblogic $DKTEST_DEPLOYMENT_DIR"
echo "sudo chmod 755 $DKTEST_MONITOR_HOME"
echo "sudo chmod 775 $DKTEST_DEPLOYMENT_DIR"
echo "sudo usermod -a -G weblogic scq9102"
echo ""

echo "=== STEP 2: Move JAR file from temp to deployment directory ==="
echo "Run these commands on the dktest server:"
echo ""
echo "sudo mv /tmp/bsl-monitor-temp/$JAR_NAME $DKTEST_DEPLOYMENT_DIR/"
echo "sudo chown weblogic:weblogic $DKTEST_DEPLOYMENT_DIR/$JAR_NAME"
echo "sudo chmod 664 $DKTEST_DEPLOYMENT_DIR/$JAR_NAME"
echo "sudo rm -rf /tmp/bsl-monitor-temp"
echo ""

echo "=== STEP 3: Create symbolic link as weblogic user ==="
echo "Run these commands on the dktest server:"
echo ""
echo "sudo -u weblogic ln -sf $DKTEST_DEPLOYMENT_DIR/$JAR_NAME $DKTEST_MONITOR_HOME/monitor.jar"
echo ""

echo "=== STEP 4: Create management scripts ==="
echo "Create the start script:"
echo ""
echo "sudo -u weblogic tee $DKTEST_MONITOR_HOME/start-monitor.sh > /dev/null << 'EOF'"
cat << 'EOF'
#!/bin/bash

# Billpro Service Monitor - Start Script for bsl-monitor-1
# Usage: ./start-monitor.sh [JAR_NAME]

set -e

DEPLOYMENT_DIR="/home/weblogic/bsl-monitor-1/deployments"
MONITOR_HOME="/home/weblogic/bsl-monitor-1"
PID_FILE="$MONITOR_HOME/monitor.pid"
LOG_FILE="$MONITOR_HOME/run_bsl.out"

# Use provided JAR name or find the latest one
if [ -n "$1" ]; then
    JAR_NAME="$1"
else
    JAR_NAME=$(ls -t "$DEPLOYMENT_DIR"/*.jar 2>/dev/null | head -1 | xargs basename)
fi

if [ -z "$JAR_NAME" ] || [ ! -f "$DEPLOYMENT_DIR/$JAR_NAME" ]; then
    echo "❌ No JAR file found in $DEPLOYMENT_DIR"
    exit 1
fi

echo "Starting Billpro Service Monitor (bsl-monitor-1)..."
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
nohup java -Dspring.application.name=bsl-monitor-1 \
  -jar "$DEPLOYMENT_DIR/$JAR_NAME" \
  --spring.profiles.active=prod \
  > "$LOG_FILE" 2>&1 &

echo $! > "$PID_FILE"
echo "✅ BSL Monitor (bsl-monitor-1) started with PID: $(cat $PID_FILE)"
echo "Process Name: bsl-monitor-1"
echo "Port: 9093"
echo "Logs: $LOG_FILE"
echo "PID File: $PID_FILE"
EOF

echo ""
echo "Create the stop script:"
echo ""
echo "sudo -u weblogic tee $DKTEST_MONITOR_HOME/stop-monitor.sh > /dev/null << 'EOF'"
cat << 'EOF'
#!/bin/bash

# Billpro Service Monitor - Stop Script for bsl-monitor-1

MONITOR_HOME="/home/weblogic/bsl-monitor-1"
PID_FILE="$MONITOR_HOME/monitor.pid"

echo "Stopping Billpro Service Monitor (bsl-monitor-1)..."

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 $PID 2>/dev/null; then
        echo "Stopping monitor (PID: $PID)..."
        kill $PID
        sleep 3
        
        # Force kill if still running
        if kill -0 $PID 2>/dev/null; then
            echo "Force stopping monitor..."
            kill -9 $PID
        fi
        
        echo "✅ Monitor stopped"
    else
        echo "Monitor not running (stale PID file)"
    fi
    rm -f "$PID_FILE"
else
    echo "Monitor not running (no PID file)"
fi
EOF

echo ""
echo "Create the status script:"
echo ""
echo "sudo -u weblogic tee $DKTEST_MONITOR_HOME/status-monitor.sh > /dev/null << 'EOF'"
cat << 'EOF'
#!/bin/bash

# Billpro Service Monitor - Status Script for bsl-monitor-1

MONITOR_HOME="/home/weblogic/bsl-monitor-1"
DEPLOYMENT_DIR="/home/weblogic/bsl-monitor-1/deployments"
PID_FILE="$MONITOR_HOME/monitor.pid"
LOG_FILE="$MONITOR_HOME/run_bsl.out"

echo "=== Billpro Service Monitor Status (bsl-monitor-1) ==="
echo "Date: $(date)"
echo ""

# Check if monitor is running
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 $PID 2>/dev/null; then
        echo "✅ BSL Monitor (bsl-monitor-1) is running (PID: $PID)"
        echo "Process Name: bsl-monitor-1"
        echo "Port: 9093"
        echo "Logs: $LOG_FILE"
        echo "PID File: $PID_FILE"
        
        # Check health endpoint
        if curl -s http://localhost:9093/sanity > /dev/null; then
            echo "✅ Health check passed"
        else
            echo "❌ Health check failed"
        fi
    else
        echo "❌ Monitor is not running (stale PID file)"
        rm -f "$PID_FILE"
    fi
else
    echo "❌ Monitor is not running"
fi

# Show available JARs
echo ""
echo "=== Available Deployments ==="
if [ -d "$DEPLOYMENT_DIR" ]; then
    ls -la "$DEPLOYMENT_DIR"/*.jar 2>/dev/null || echo "No JAR files found"
else
    echo "Deployment directory not found"
fi

# Show recent logs
echo ""
echo "=== Recent Logs ==="
if [ -f "$LOG_FILE" ]; then
    tail -n 10 "$LOG_FILE"
else
    echo "No log file found"
fi
EOF

echo ""
echo "Make scripts executable:"
echo ""
echo "sudo chmod +x $DKTEST_MONITOR_HOME/*.sh"
echo ""

echo "=== STEP 5: Start the monitor ==="
echo "Run these commands on the dktest server:"
echo ""
echo "sudo -iu weblogic"
echo "cd $DKTEST_MONITOR_HOME"
echo "source .prod_env  # if available"
echo "./start-monitor.sh"
echo "./status-monitor.sh"
echo ""

echo "=== STEP 6: Verify deployment ==="
echo "Check that everything is working:"
echo ""
echo "curl http://localhost:9093/sanity"
echo "tail -f $DKTEST_MONITOR_HOME/run_bsl.out"
echo ""

echo "=== Directory Structure ==="
echo "$DKTEST_MONITOR_HOME/"
echo "├── monitor.jar -> $DKTEST_DEPLOYMENT_DIR/$JAR_NAME"
echo "├── start-monitor.sh"
echo "├── stop-monitor.sh"
echo "├── status-monitor.sh"
echo "├── monitor.pid (created when running)"
echo "└── run_bsl.out (created when running)"
echo ""
echo "$DKTEST_DEPLOYMENT_DIR/"
echo "└── $JAR_NAME"
echo ""

echo "=== Summary ==="
echo "✅ JAR file: $JAR_NAME"
echo "✅ Server: $DKTEST_SERVER"
echo "✅ Monitor Home: $DKTEST_MONITOR_HOME"
echo "✅ Deployment Dir: $DKTEST_DEPLOYMENT_DIR"
echo "✅ Process Name: bsl-monitor-1"
echo "✅ Port: 9093"
echo "✅ Profile: prod"
echo ""
echo "Follow the steps above to complete the manual deployment."
