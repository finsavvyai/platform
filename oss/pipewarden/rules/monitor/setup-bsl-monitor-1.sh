

#!/bin/bash

# Setup script for bsl-monitor-1 on dktest server
# This script creates the folder structure and all necessary scripts

set -e

echo "=== Setting up bsl-monitor-1 folder structure and scripts ==="
echo ""

# Configuration
DKTEST_SERVER="dktest"
DKTEST_MONITOR_HOME="/home/weblogic/bsl-monitor-1"
DKTEST_DEPLOYMENT_DIR="/home/weblogic/bsl-monitor-1/deployments"

echo "Target Server: $DKTEST_SERVER"
echo "Monitor Home: $DKTEST_MONITOR_HOME"
echo "Deployment Dir: $DKTEST_DEPLOYMENT_DIR"
echo ""

echo "=== STEP 1: Create folder structure ==="
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

echo "=== STEP 2: Create start-monitor.sh script ==="
echo "Run this command on the dktest server:"
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
    echo "Available files in $DEPLOYMENT_DIR:"
    ls -la "$DEPLOYMENT_DIR"/ 2>/dev/null || echo "Directory not found"
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
echo "=== STEP 3: Create stop-monitor.sh script ==="
echo "Run this command on the dktest server:"
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
echo "=== STEP 4: Create restart-monitor.sh script ==="
echo "Run this command on the dktest server:"
echo ""
echo "sudo -u weblogic tee $DKTEST_MONITOR_HOME/restart-monitor.sh > /dev/null << 'EOF'"
cat << 'EOF'
#!/bin/bash

# Billpro Service Monitor - Restart Script for bsl-monitor-1
# Usage: ./restart-monitor.sh [JAR_NAME]

set -e

MONITOR_HOME="/home/weblogic/bsl-monitor-1"

echo "Restarting Billpro Service Monitor (bsl-monitor-1)..."

# Stop existing monitor
./stop-monitor.sh

# Wait a moment
sleep 2

# Start with new JAR (if provided) or latest
if [ -n "$1" ]; then
    ./start-monitor.sh "$1"
else
    ./start-monitor.sh
fi

echo "✅ Monitor restarted"
echo "Check status: ./status-monitor.sh"
EOF

echo ""
echo "=== STEP 5: Create status-monitor.sh script ==="
echo "Run this command on the dktest server:"
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
echo "=== STEP 6: Create deploy.sh script ==="
echo "Run this command on the dktest server:"
echo ""
echo "sudo -u weblogic tee $DKTEST_MONITOR_HOME/deploy.sh > /dev/null << 'EOF'"
cat << 'EOF'
#!/bin/bash

# Billpro Service Monitor - Deploy Script for bsl-monitor-1
# Usage: ./deploy.sh [JAR_NAME]

set -e

DEPLOYMENT_DIR="/home/weblogic/bsl-monitor-1/deployments"
MONITOR_HOME="/home/weblogic/bsl-monitor-1"

# Use provided JAR name or find the latest one
if [ -n "$1" ]; then
    JAR_NAME="$1"
else
    JAR_NAME=$(ls -t "$DEPLOYMENT_DIR"/*.jar 2>/dev/null | head -1 | xargs basename)
fi

if [ -z "$JAR_NAME" ] || [ ! -f "$DEPLOYMENT_DIR/$JAR_NAME" ]; then
    echo "❌ No JAR file found in $DEPLOYMENT_DIR"
    echo "Available files in $DEPLOYMENT_DIR:"
    ls -la "$DEPLOYMENT_DIR"/ 2>/dev/null || echo "Directory not found"
    exit 1
fi

echo "Deploying Billpro Service Monitor (bsl-monitor-1)..."
echo "JAR: $JAR_NAME"

# Stop existing monitor
./stop-monitor.sh

# Create symbolic link to new JAR
ln -sf "$DEPLOYMENT_DIR/$JAR_NAME" "$MONITOR_HOME/monitor.jar"

# Start with new JAR
./start-monitor.sh "$JAR_NAME"

echo "✅ Deployment completed"
echo "Check status: ./status-monitor.sh"
EOF

echo ""
echo "=== STEP 7: Make scripts executable ==="
echo "Run this command on the dktest server:"
echo ""
echo "sudo chmod +x $DKTEST_MONITOR_HOME/*.sh"
echo ""

echo "=== STEP 8: Create README file ==="
echo "Run this command on the dktest server:"
echo ""
echo "sudo -u weblogic tee $DKTEST_MONITOR_HOME/README.md > /dev/null << 'EOF'"
cat << 'EOF'
# Billpro Service Monitor - bsl-monitor-1

## Overview
This is the bsl-monitor-1 instance of the Billpro Service Monitor running on dktest server.

## Directory Structure
```
/home/weblogic/bsl-monitor-1/
├── monitor.jar -> deployments/latest.jar  # Symbolic link to current JAR
├── start-monitor.sh                       # Start the monitor
├── stop-monitor.sh                        # Stop the monitor
├── restart-monitor.sh                     # Restart the monitor
├── status-monitor.sh                      # Check monitor status
├── deploy.sh                              # Deploy new JAR version
├── monitor.pid                            # Process ID file (created when running)
├── run_bsl.out                            # Log file (created when running)
└── README.md                              # This file

/home/weblogic/bsl-monitor-1/deployments/
└── bsl-monitor-*.jar                      # JAR files
```

## Usage

### Start Monitor
```bash
cd /home/weblogic/bsl-monitor-1
./start-monitor.sh [JAR_NAME]
```

### Stop Monitor
```bash
cd /home/weblogic/bsl-monitor-1
./stop-monitor.sh
```

### Restart Monitor
```bash
cd /home/weblogic/bsl-monitor-1
./restart-monitor.sh [JAR_NAME]
```

### Check Status
```bash
cd /home/weblogic/bsl-monitor-1
./status-monitor.sh
```

### Deploy New Version
```bash
cd /home/weblogic/bsl-monitor-1
./deploy.sh [JAR_NAME]
```

## Configuration
- **Process Name**: bsl-monitor-1
- **Port**: 9093
- **Profile**: prod
- **Config File**: application-prod.yaml
- **Logs**: run_bsl.out
- **PID File**: monitor.pid

## Health Check
```bash
curl http://localhost:9093/sanity
```

## Troubleshooting

### Check Logs
```bash
tail -f /home/weblogic/bsl-monitor-1/run_bsl.out
```

### Check Process
```bash
ps aux | grep bsl-monitor-1
```

### Check Port
```bash
lsof -i :9093
```

## Deployment Process
1. Upload new JAR to `/home/weblogic/bsl-monitor-1/deployments/`
2. Run `./deploy.sh [JAR_NAME]` to deploy and start
3. Check status with `./status-monitor.sh`
EOF

echo ""
echo "=== STEP 9: Set proper ownership ==="
echo "Run this command on the dktest server:"
echo ""
echo "sudo chown -R weblogic:weblogic $DKTEST_MONITOR_HOME"
echo ""

echo "=== Final Directory Structure ==="
echo "$DKTEST_MONITOR_HOME/"
echo "├── start-monitor.sh"
echo "├── stop-monitor.sh"
echo "├── restart-monitor.sh"
echo "├── status-monitor.sh"
echo "├── deploy.sh"
echo "├── README.md"
echo "├── monitor.jar (symbolic link - created when JAR is deployed)"
echo "├── monitor.pid (created when running)"
echo "└── run_bsl.out (created when running)"
echo ""
echo "$DKTEST_DEPLOYMENT_DIR/"
echo "└── bsl-monitor-*.jar (JAR files will be placed here)"
echo ""

echo "=== Summary ==="
echo "✅ Folder structure created"
echo "✅ All management scripts created"
echo "✅ README documentation created"
echo "✅ Proper permissions set"
echo ""
echo "Next steps:"
echo "1. Upload a JAR file to $DKTEST_DEPLOYMENT_DIR/"
echo "2. Run: ./deploy.sh [JAR_NAME]"
echo "3. Check status: ./status-monitor.sh"
echo ""
echo "All setup commands are ready to run on the dktest server!"
