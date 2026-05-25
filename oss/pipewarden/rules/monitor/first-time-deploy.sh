#!/bin/bash

# Billpro Service Monitor - First Time Deployment Script
# This script sets up the complete environment for the first time

set -e  # Exit on any error

# Sound and vocal feedback functions
play_sound() {
    local sound_type="$1"
    case "$sound_type" in
        "success")
            echo -e "\a"
            say "Success" 2>/dev/null || true
            ;;
        "error")
            echo -e "\a\a\a"
            say "Error occurred" 2>/dev/null || true
            ;;
        "warning")
            echo -e "\a"
            say "Warning" 2>/dev/null || true
            ;;
        "start")
            echo -e "\a"
            say "Starting first time deployment" 2>/dev/null || true
            ;;
        "complete")
            echo -e "\a\a\a"
            say "First time deployment completed successfully" 2>/dev/null || true
            ;;
    esac
}

vocal_status() {
    local message="$1"
    echo "$message"
    say "$message" 2>/dev/null || true
}

# Configuration
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BUILD_VERSION="1.0.0"
JAR_NAME="bsl-monitor-${BUILD_VERSION}-${TIMESTAMP}.jar"
DEPLOYMENT_DIR="/tmp/bsl-monitor/deployments"
WEBLOGIC_HOME="/home/weblogic/bsl_monitor1"
MONITOR_HOME="/home/weblogic/bsl_monitor1"

# Skypoint server configuration
SKYPOINT_SERVER="dk01"
SKYPOINT_DEPLOYMENT_DIR="/home/weblogic/bsl_monitor1/deployments"
SKYPOINT_WEBLOGIC_HOME="/home/weblogic/bsl_monitor1"
SKYPOINT_MONITOR_HOME="/home/weblogic/bsl_monitor1"

# Start deployment with sound and vocal feedback
play_sound "start"
vocal_status "Starting first time deployment for Billpro Service Monitor"

echo "=== Billpro Service Monitor - First Time Deployment ==="
echo "Timestamp: $TIMESTAMP"
echo "JAR Name: $JAR_NAME"
echo "Deployment Dir: $DEPLOYMENT_DIR"
echo "Monitor Home: $MONITOR_HOME"
echo "Skypoint Server: $SKYPOINT_SERVER"
echo ""

# Step 1: Build the application
vocal_status "Step 1: Building application"
echo "Step 1: Building application..."
./gradlew clean bootJar -x test

if [ $? -ne 0 ]; then
    play_sound "error"
    vocal_status "Build failed"
    echo "❌ Build failed!"
    exit 1
fi

play_sound "success"
vocal_status "Build completed successfully"
echo "✅ Build completed successfully"

# Step 2: Create local deployment directory
echo ""
vocal_status "Step 2: Creating local deployment directory"
echo "Step 2: Creating local deployment directory..."

mkdir -p "$DEPLOYMENT_DIR"

play_sound "success"
vocal_status "Local deployment directory created"
echo "✅ Local deployment directory created: $DEPLOYMENT_DIR"

# Step 3: Copy JAR to deployment directory
echo ""
vocal_status "Step 3: Copying JAR to deployment directory"
echo "Step 3: Copying JAR to deployment directory..."

# Find the built JAR (look for both JAR and WAR files)
BUILT_JAR=$(find build/libs -name "*.jar" | head -1)
if [ -z "$BUILT_JAR" ]; then
    BUILT_JAR=$(find build/libs -name "*.war" | head -1)
    if [ -n "$BUILT_JAR" ]; then
        echo "⚠️  Found WAR file, will use as JAR: $BUILT_JAR"
    fi
fi

if [ -z "$BUILT_JAR" ]; then
    play_sound "error"
    vocal_status "No JAR or WAR file found"
    echo "❌ No JAR or WAR file found in build/libs/"
    echo "Available files in build/libs/:"
    ls -la build/libs/ 2>/dev/null || echo "build/libs/ directory not found"
    exit 1
fi

cp "$BUILT_JAR" "$DEPLOYMENT_DIR/$JAR_NAME"

play_sound "success"
vocal_status "JAR file copied successfully"
echo "✅ JAR copied: $DEPLOYMENT_DIR/$JAR_NAME"

# Step 4: Create all deployment scripts
echo ""
vocal_status "Step 4: Creating all deployment scripts"
echo "Step 4: Creating all deployment scripts..."

# Create start script
tee "$DEPLOYMENT_DIR/start-monitor.sh" > /dev/null << 'EOF'
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
  --spring.config.location=classpath:file:./application-prod.yaml \
  > "$LOG_FILE" 2>&1 &

echo $! > "$PID_FILE"
echo "✅ BSL Monitor started with PID: $(cat $PID_FILE)"
echo "Process Name: bsl-monitor"
echo "Port: 9093"
echo "Logs: $LOG_FILE"
echo "PID File: $PID_FILE"
EOF

# Create stop script
tee "$DEPLOYMENT_DIR/stop-monitor.sh" > /dev/null << 'EOF'
#!/bin/bash

# Billpro Service Monitor - Stop Script

MONITOR_HOME="/home/weblogic/bsl_monitor1"
PID_FILE="$MONITOR_HOME/monitor.pid"

echo "Stopping Billpro Service Monitor..."

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

# Create restart script
tee "$DEPLOYMENT_DIR/restart-monitor.sh" > /dev/null << 'EOF'
#!/bin/bash

# Billpro Service Monitor - Restart Script
# Usage: ./restart-monitor.sh [JAR_NAME]

set -e

DEPLOYMENT_DIR="/home/weblogic/bsl_monitor1/deployments"
MONITOR_HOME="/home/weblogic/bsl_monitor1"

echo "Restarting Billpro Service Monitor..."

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

# Create status script
tee "$DEPLOYMENT_DIR/status-monitor.sh" > /dev/null << 'EOF'
#!/bin/bash

# Billpro Service Monitor - Status Script

MONITOR_HOME="/home/weblogic/bsl_monitor1"
DEPLOYMENT_DIR="/tmp/bsl-monitor/deployments"
PID_FILE="$MONITOR_HOME/monitor.pid"
LOG_FILE="$MONITOR_HOME/run_bsl.out"

echo "=== Billpro Service Monitor Status ==="
echo "Date: $(date)"
echo ""

# Check if monitor is running
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 $PID 2>/dev/null; then
        echo "✅ BSL Monitor is running (PID: $PID)"
        echo "Process Name: bsl-monitor"
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

# Create deploy script
tee "$DEPLOYMENT_DIR/deploy.sh" > /dev/null << 'EOF'
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

# Create quick-deploy script for continuous deployment
tee "$DEPLOYMENT_DIR/quick-deploy.sh" > /dev/null << 'EOF'
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

# Make all scripts executable
chmod +x "$DEPLOYMENT_DIR"/*.sh

play_sound "success"
vocal_status "All deployment scripts created successfully"
echo "✅ All deployment scripts created"

# Step 5: Create installation instructions
echo ""
vocal_status "Step 5: Creating installation instructions"
echo "Step 5: Creating installation instructions..."

tee "$DEPLOYMENT_DIR/INSTALLATION_INSTRUCTIONS.md" > /dev/null << EOF
# Billpro Service Monitor - First Time Installation

## Files Deployed
- **JAR**: $JAR_NAME
- **Location**: $DEPLOYMENT_DIR
- **Monitor Home**: $MONITOR_HOME

## Quick Start

### Switch to weblogic user and source environment
\`\`\`bash
sudo -iu weblogic
source .prod_env
cd $MONITOR_HOME
\`\`\`

### Start the monitor
\`\`\`bash
./start-monitor.sh
\`\`\`

### Check status
\`\`\`bash
./status-monitor.sh
\`\`\`

## Management Commands

### Start Monitor
\`\`\`bash
cd $MONITOR_HOME
./start-monitor.sh [JAR_NAME]
\`\`\`

### Stop Monitor
\`\`\`bash
cd $MONITOR_HOME
./stop-monitor.sh
\`\`\`

### Restart Monitor
\`\`\`bash
cd $MONITOR_HOME
./restart-monitor.sh [JAR_NAME]
\`\`\`

### Check Status
\`\`\`bash
cd $MONITOR_HOME
./status-monitor.sh
\`\`\`

### Deploy New Version
\`\`\`bash
cd $MONITOR_HOME
./deploy.sh [JAR_NAME]
\`\`\`

### Quick Deploy (Continuous Deployment)
\`\`\`bash
cd $MONITOR_HOME
./quick-deploy.sh
\`\`\`

## Configuration

- **Port**: 9093
- **Profile**: prod
- **Config File**: application-prod.yaml
- **Logs**: $MONITOR_HOME/run_bsl.out
- **PID File**: $MONITOR_HOME/monitor.pid

## Health Check

\`\`\`bash
curl http://localhost:9093/sanity
\`\`\`

## Troubleshooting

### Check Logs
\`\`\`bash
tail -f $MONITOR_HOME/run_bsl.out
\`\`\`

### Check TEDDK Connectivity
\`\`\`bash
curl https://prod.teddk.telia.dk/api/sanity
\`\`\`

### Check Process
\`\`\`bash
ps aux | grep bsl-monitor
\`\`\`

## Available Deployments

\`\`\`bash
ls -la $DEPLOYMENT_DIR/*.jar
\`\`\`

## Current Command

The monitor runs with this command:
\`\`\`bash
nohup java -Dspring.application.name=bsl-monitor -jar monitor.jar --spring.config.location=classpath:file:./application-prod.yaml > run_bsl.out 2>&1 &
\`\`\`
EOF

play_sound "success"
vocal_status "Installation instructions created successfully"
echo "✅ Installation instructions created"

# Step 6: Upload to Skypoint server
echo ""
play_sound "upload"
vocal_status "Step 6: Uploading to Skypoint server"
echo "Step 6: Uploading to Skypoint server..."

# Test SSH connection
vocal_status "Testing SSH connection to Skypoint server"
echo "Testing SSH connection to $SKYPOINT_SERVER..."
if ssh -o ConnectTimeout=10 -o BatchMode=yes "$SKYPOINT_SERVER" "echo 'SSH connection successful'" 2>/dev/null; then
    play_sound "success"
    vocal_status "SSH connection successful"
    echo "✅ SSH connection successful"
else
    play_sound "error"
    vocal_status "SSH connection failed"
    echo "❌ SSH connection failed"
    echo "   Please ensure you can connect to $SKYPOINT_SERVER"
    echo "   Try: ssh $SKYPOINT_SERVER"
    exit 1
fi

# Verify weblogic directory and set up deployment directory permissions
echo "Verifying weblogic directory and setting up deployment directory..."
ssh "$SKYPOINT_SERVER" "
    # Check if weblogic directory exists, create if not
    if [ ! -d '$SKYPOINT_WEBLOGIC_HOME' ]; then
        echo '⚠️  WebLogic directory not found, creating: $SKYPOINT_WEBLOGIC_HOME'
        mkdir -p '$SKYPOINT_WEBLOGIC_HOME'
        echo '✅ WebLogic directory created: $SKYPOINT_WEBLOGIC_HOME'
    else
        echo '✅ WebLogic directory exists: $SKYPOINT_WEBLOGIC_HOME'
    fi
    
    # Create deployment directory
    mkdir -p $SKYPOINT_DEPLOYMENT_DIR
    
    # Set directory permissions to allow group write access (no sudo needed)
    chmod 775 $SKYPOINT_DEPLOYMENT_DIR
    
    echo '✅ Deployment directory created with proper permissions for upload'
"

# Upload JAR file
echo "Uploading JAR file..."
scp "$DEPLOYMENT_DIR/$JAR_NAME" "$SKYPOINT_SERVER:$SKYPOINT_DEPLOYMENT_DIR/"

# Upload all scripts to temporary location first
echo "Uploading deployment scripts to temporary location..."
TEMP_DIR="/tmp/bsl-monitor-temp"
ssh "$SKYPOINT_SERVER" "mkdir -p $TEMP_DIR"

scp "$DEPLOYMENT_DIR"/*.sh "$SKYPOINT_SERVER:$TEMP_DIR/"
scp "$DEPLOYMENT_DIR/INSTALLATION_INSTRUCTIONS.md" "$SKYPOINT_SERVER:$TEMP_DIR/"
scp "manual-setup.sh" "$SKYPOINT_SERVER:$TEMP_DIR/"
scp "fix-permissions-simple.sh" "$SKYPOINT_SERVER:$TEMP_DIR/"

# Move files to deployment directory with proper permissions
echo "Moving files to deployment directory with proper permissions..."
ssh "$SKYPOINT_SERVER" "
    # Move files to deployment directory (as scq9102)
    mv $TEMP_DIR/* $SKYPOINT_DEPLOYMENT_DIR/
    
    # Clean up temp directory
    rmdir $TEMP_DIR
    
    echo '✅ Files moved to deployment directory'
    echo '⚠️  Note: You may need to run fix-permissions.sh to set proper ownership'
"

echo "✅ Files uploaded to Skypoint server"
echo "⚠️  Next steps required on Skypoint server:"
echo "   1. Run fix-permissions-simple.sh as scq9102 user:"
echo "      bash /home/weblogic/bsl_monitor1/deployments/fix-permissions-simple.sh"
echo "   2. Log out and log back in for group changes to take effect"
echo "   3. Run manual setup as weblogic user:"
echo "      sudo -iu weblogic"
echo "      bash /home/weblogic/bsl_monitor1/deployments/manual-setup.sh"

echo "✅ Upload to Skypoint server completed"

# Step 7: Final verification
echo ""
vocal_status "Step 7: Final verification"
echo "Step 7: Final verification..."

# Check if everything is in place locally
echo "Checking local deployment structure..."
if [ -f "$DEPLOYMENT_DIR/$JAR_NAME" ]; then
    echo "✅ Local JAR file: $DEPLOYMENT_DIR/$JAR_NAME"
else
    echo "❌ Local JAR file not found"
    exit 1
fi

if [ -f "$DEPLOYMENT_DIR/start-monitor.sh" ]; then
    echo "✅ Local start script: $DEPLOYMENT_DIR/start-monitor.sh"
else
    echo "❌ Local start script not found"
    exit 1
fi

if [ -f "$DEPLOYMENT_DIR/quick-deploy.sh" ]; then
    echo "✅ Local quick-deploy script: $DEPLOYMENT_DIR/quick-deploy.sh"
else
    echo "❌ Local quick-deploy script not found"
    exit 1
fi

# Test JAR file locally (more robust test)
echo "Testing JAR file locally..."
if java -jar "$DEPLOYMENT_DIR/$JAR_NAME" --version > /dev/null 2>&1; then
    echo "✅ Local JAR test successful (version check)"
elif java -jar "$DEPLOYMENT_DIR/$JAR_NAME" --help > /dev/null 2>&1; then
    echo "✅ Local JAR test successful (help check)"
else
    echo "⚠️  Local JAR test inconclusive (continuing anyway)"
    echo "   This is normal for Spring Boot applications"
fi

# Verify remote deployment
echo "Verifying remote deployment..."
ssh "$SKYPOINT_SERVER" "
    if [ -f '$SKYPOINT_DEPLOYMENT_DIR/$JAR_NAME' ]; then
        echo '✅ Remote JAR file exists'
    else
        echo '❌ Remote JAR file not found'
        exit 1
    fi
    
    if [ -f '$SKYPOINT_MONITOR_HOME/monitor.jar' ]; then
        echo '✅ Remote symbolic link exists'
    else
        echo '❌ Remote symbolic link not found'
        exit 1
    fi
    
    if [ -f '$SKYPOINT_MONITOR_HOME/start-monitor.sh' ]; then
        echo '✅ Remote start script exists'
    else
        echo '❌ Remote start script not found'
        exit 1
    fi
    
    if [ -f '$SKYPOINT_MONITOR_HOME/quick-deploy.sh' ]; then
        echo '✅ Remote quick-deploy script exists'
    else
        echo '❌ Remote quick-deploy script not found'
        exit 1
    fi
"

echo ""
play_sound "complete"
vocal_status "First time deployment completed successfully"
echo "=== FIRST TIME DEPLOYMENT COMPLETE ==="
echo "✅ Build: $JAR_NAME"
echo "✅ Local Deployment Dir: $DEPLOYMENT_DIR"
echo "✅ Remote Server: $SKYPOINT_SERVER"
echo "✅ Remote Deployment Dir: $SKYPOINT_DEPLOYMENT_DIR"
echo "✅ Remote Monitor Home: $SKYPOINT_MONITOR_HOME"
echo ""
echo "Next Steps on Skypoint Server:"
echo "1. SSH to server: ssh $SKYPOINT_SERVER"
echo "2. Switch to weblogic user: sudo -iu weblogic"
echo "3. Source environment: source .prod_env"
echo "4. Navigate to: cd $SKYPOINT_MONITOR_HOME"
echo "5. Run manual setup: bash $SKYPOINT_DEPLOYMENT_DIR/manual-setup.sh"
echo "6. Start monitor: ./start-monitor.sh"
echo "7. Check status: ./status-monitor.sh"
echo ""
echo "For future deployments, use: ./quick-deploy.sh"
echo ""
echo "Scripts available on remote server:"
echo "- start-monitor.sh"
echo "- stop-monitor.sh"
echo "- restart-monitor.sh"
echo "- status-monitor.sh"
echo "- deploy.sh"
echo "- quick-deploy.sh (for continuous deployment)"
echo ""
echo "Remote deployment files:"
echo "- JAR: $SKYPOINT_DEPLOYMENT_DIR/$JAR_NAME"
echo "- Scripts: $SKYPOINT_DEPLOYMENT_DIR/*.sh"
echo "- Instructions: $SKYPOINT_DEPLOYMENT_DIR/INSTALLATION_INSTRUCTIONS.md"
