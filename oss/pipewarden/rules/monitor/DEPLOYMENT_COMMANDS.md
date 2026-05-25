# BSL Monitor-1 Deployment Commands (No Sudo Required)

## Current Status
- **JAR File**: `bsl-monitor-bsl-monitor-1.0.0-20250908_134106.jar` 
- **Location**: `/home/scq9102@tcad.telia.se/bsl-monitor-1-deploy/`
- **User**: scq9102 (no sudo access)

## Step 1: Create Scripts on dktest Server

SSH to dktest server and run these commands:

```bash
ssh dktest
cd bsl-monitor-1-deploy
```

### Create start-monitor.sh
```bash
cat > start-monitor.sh << 'EOF'
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
```

### Create stop-monitor.sh
```bash
cat > stop-monitor.sh << 'EOF'
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
```

### Create status-monitor.sh
```bash
cat > status-monitor.sh << 'EOF'
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
```

### Create deploy.sh
```bash
cat > deploy.sh << 'EOF'
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
```

### Create README.md
```bash
cat > README.md << 'EOF'
# Billpro Service Monitor - bsl-monitor-1

## Overview
This is the bsl-monitor-1 instance of the Billpro Service Monitor.

## Files
- bsl-monitor-bsl-monitor-1.0.0-20250908_134106.jar - Application JAR
- start-monitor.sh - Start the monitor
- stop-monitor.sh - Stop the monitor
- status-monitor.sh - Check status
- deploy.sh - Deploy new version

## Usage
```bash
# Start monitor
./start-monitor.sh

# Stop monitor
./stop-monitor.sh

# Check status
./status-monitor.sh

# Deploy new version
./deploy.sh [JAR_NAME]
```

## Configuration
- Process Name: bsl-monitor-1
- Port: 9093
- Profile: prod
- Logs: /home/weblogic/bsl-monitor-1/run_bsl.out

## Health Check
```bash
curl http://localhost:9093/sanity
```
EOF
```

### Make scripts executable
```bash
chmod +x *.sh
```

### Verify files created
```bash
ls -la
```

## Step 2: Instructions for weblogic User

Provide these instructions to the weblogic user to complete the deployment:

### Create directories (weblogic user)
```bash
sudo -iu weblogic
mkdir -p /home/weblogic/bsl-monitor-1/deployments
```

### Copy files from scq9102 home (weblogic user)
```bash
# Copy JAR file
cp /home/scq9102@tcad.telia.se/bsl-monitor-1-deploy/bsl-monitor-bsl-monitor-1.0.0-20250908_134106.jar /home/weblogic/bsl-monitor-1/deployments/

# Copy scripts
cp /home/scq9102@tcad.telia.se/bsl-monitor-1-deploy/*.sh /home/weblogic/bsl-monitor-1/
chmod +x /home/weblogic/bsl-monitor-1/*.sh
```

### Create symbolic link (weblogic user)
```bash
cd /home/weblogic/bsl-monitor-1
ln -sf deployments/bsl-monitor-bsl-monitor-1.0.0-20250908_134106.jar monitor.jar
```

### Start the monitor (weblogic user)
```bash
cd /home/weblogic/bsl-monitor-1
source .prod_env  # if available
./start-monitor.sh
./status-monitor.sh
```

## Step 3: Verify Deployment

### Check if monitor is running
```bash
curl http://localhost:9093/sanity
```

### Check logs
```bash
tail -f /home/weblogic/bsl-monitor-1/run_bsl.out
```

### Check process
```bash
ps aux | grep bsl-monitor-1
```

## Directory Structure After Deployment

```
/home/weblogic/bsl-monitor-1/
├── monitor.jar -> deployments/bsl-monitor-bsl-monitor-1.0.0-20250908_134106.jar
├── start-monitor.sh
├── stop-monitor.sh
├── status-monitor.sh
├── deploy.sh
├── monitor.pid (created when running)
└── run_bsl.out (created when running)

/home/weblogic/bsl-monitor-1/deployments/
└── bsl-monitor-bsl-monitor-1.0.0-20250908_134106.jar
```

## Summary

✅ **JAR File**: `bsl-monitor-bsl-monitor-1.0.0-20250908_134106.jar`  
✅ **Location**: `/home/scq9102@tcad.telia.se/bsl-monitor-1-deploy/`  
✅ **Scripts**: All management scripts created  
✅ **Ready for**: weblogic user to copy and deploy  

**Next Step**: Have weblogic user run the commands in Step 2 to complete the deployment.
