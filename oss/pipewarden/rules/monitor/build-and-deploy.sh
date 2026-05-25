#!/bin/bash

# Billpro Service Monitor - Build and Deploy Script
# This script builds the application with unique naming and deploys it for weblogic user

set -e  # Exit on any error

# Sound and vocal feedback functions
play_sound() {
    local sound_type="$1"
    case "$sound_type" in
        "success")
            # Success sound - bell
            echo -e "\a"
            say "Success" 2>/dev/null || true
            ;;
        "error")
            # Error sound - multiple bells
            echo -e "\a\a\a"
            say "Error occurred" 2>/dev/null || true
            ;;
        "warning")
            # Warning sound - single bell
            echo -e "\a"
            say "Warning" 2>/dev/null || true
            ;;
        "start")
            # Start sound
            echo -e "\a"
            say "Starting deployment" 2>/dev/null || true
            ;;
        "complete")
            # Complete sound - multiple bells
            echo -e "\a\a\a"
            say "Deployment completed successfully" 2>/dev/null || true
            ;;
        "upload")
            # Upload sound
            echo -e "\a"
            say "Uploading to server" 2>/dev/null || true
            ;;
        "build")
            # Build sound
            echo -e "\a"
            say "Build completed" 2>/dev/null || true
            ;;
    esac
}

# Vocal status updates
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
WEBLOGIC_USER="weblogic"
CURRENT_USER=$(whoami)

# Skypoint server configuration
SKYPOINT_SERVER="dk01"
SKYPOINT_DEPLOYMENT_DIR="/tmp/bsl-monitor/deployments"
SKYPOINT_WEBLOGIC_HOME="/home/weblogic/bsl_monitor1"
SKYPOINT_MONITOR_HOME="/home/weblogic/bsl_monitor1"

# SSH/SCP connection configuration
# Options: "ssh" or "scp" - use "ssh" for direct connection, "scp" for file transfer only
SSH_CONNECTION_METHOD="ssh"

# Start deployment with sound and vocal feedback
play_sound "start"
vocal_status "Starting Billpro Service Monitor deployment"

echo "=== Billpro Service Monitor - Build and Deploy ==="
echo "Timestamp: $TIMESTAMP"
echo "JAR Name: $JAR_NAME"
echo "Deployment Dir: $DEPLOYMENT_DIR"
echo "WebLogic Home: $WEBLOGIC_HOME"
echo "Current User: $CURRENT_USER"
echo "Skypoint Server: $SKYPOINT_SERVER"
echo "SSH Connection Method: $SSH_CONNECTION_METHOD"
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

play_sound "build"
vocal_status "Build completed successfully"
echo "✅ Build completed successfully"

# Step 2: Create deployment directory structure
echo ""
vocal_status "Step 2: Creating deployment directory structure"
echo "Step 2: Creating deployment directory structure..."

# Create deployment directory (user accessible)
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

# Copy to deployment directory with unique name
cp "$BUILT_JAR" "$DEPLOYMENT_DIR/$JAR_NAME"

play_sound "success"
vocal_status "JAR file copied successfully"
echo "✅ JAR copied: $DEPLOYMENT_DIR/$JAR_NAME"

# Step 4: Create deployment scripts
echo ""
vocal_status "Step 4: Creating deployment scripts"
echo "Step 4: Creating deployment scripts..."

# Create start script
tee "$DEPLOYMENT_DIR/start-monitor.sh" > /dev/null << 'EOF'
#!/bin/bash

# Billpro Service Monitor - Start Script
# Usage: ./start-monitor.sh [JAR_NAME]

set -e

DEPLOYMENT_DIR="/tmp/bsl-monitor/deployments"
WEBLOGIC_HOME="/home/weblogic/bsl_monitor1"
MONITOR_HOME="/home/weblogic/bsl_monitor1"
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

# Create stop script
tee "$DEPLOYMENT_DIR/stop-monitor.sh" > /dev/null << 'EOF'
#!/bin/bash

# Billpro Service Monitor - Stop Script

WEBLOGIC_HOME="/home/weblogic/bsl_monitor1"
PID_FILE="$WEBLOGIC_HOME/monitor.pid"

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

DEPLOYMENT_DIR="/tmp/bsl-monitor/deployments"
WEBLOGIC_HOME="/home/weblogic/bsl_monitor1"

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

WEBLOGIC_HOME="/home/weblogic/bsl_monitor1"
DEPLOYMENT_DIR="/tmp/bsl-monitor/deployments"
PID_FILE="$WEBLOGIC_HOME/monitor.pid"
LOG_FILE="$WEBLOGIC_HOME/run_bsl.out"

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

DEPLOYMENT_DIR="/tmp/bsl-monitor/deployments"
WEBLOGIC_HOME="/home/weblogic/bsl_monitor1"

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

echo "Deploying Billpro Service Monitor..."
echo "JAR: $JAR_NAME"

# Stop existing monitor
./stop-monitor.sh

# Start with new JAR
./start-monitor.sh "$JAR_NAME"

echo "✅ Deployment completed"
echo "Check status: ./status-monitor.sh"
EOF

# Make all scripts executable
chmod +x "$DEPLOYMENT_DIR"/*.sh

play_sound "success"
vocal_status "Deployment scripts created successfully"
echo "✅ Deployment scripts created"

# Step 5: Local deployment complete
echo ""
vocal_status "Step 5: Local deployment complete"
echo "Step 5: Local deployment complete"

play_sound "success"
vocal_status "Local deployment files ready for upload"
echo "✅ Local deployment files ready for upload"

# Step 6: Create installation instructions
echo ""
vocal_status "Step 6: Creating installation instructions"
echo "Step 6: Creating installation instructions..."

tee "$DEPLOYMENT_DIR/INSTALLATION_INSTRUCTIONS.md" > /dev/null << EOF
# Billpro Service Monitor - Installation Instructions

## Files Deployed
- **JAR**: $JAR_NAME
- **Location**: $DEPLOYMENT_DIR
- **WebLogic Home**: $WEBLOGIC_HOME

## Quick Start

### Switch to weblogic user and source environment
\`\`\`bash
sudo -iu weblogic
source .prod_env
cd $WEBLOGIC_HOME
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
cd $WEBLOGIC_HOME
./start-monitor.sh [JAR_NAME]
\`\`\`

### Stop Monitor
\`\`\`bash
cd $WEBLOGIC_HOME
./stop-monitor.sh
\`\`\`

### Restart Monitor
\`\`\`bash
cd $WEBLOGIC_HOME
./restart-monitor.sh [JAR_NAME]
\`\`\`

### Check Status
\`\`\`bash
cd $WEBLOGIC_HOME
./status-monitor.sh
\`\`\`

### Deploy New Version
\`\`\`bash
cd $WEBLOGIC_HOME
./deploy.sh [JAR_NAME]
\`\`\`

## Configuration

- **Port**: 9093
- **Profile**: prod
- **Config File**: application-prod.yaml
- **Logs**: $WEBLOGIC_HOME/run_bsl.out
- **PID File**: $WEBLOGIC_HOME/monitor.pid

## Health Check

\`\`\`bash
curl http://localhost:9093/sanity
\`\`\`

## Troubleshooting

### Check Logs
\`\`\`bash
tail -f $WEBLOGIC_HOME/run_bsl.out
\`\`\`

### Check TEDDK Connectivity
\`\`\`bash
curl https://prod.teddk.telia.dk/api/sanity
\`\`\`

### Check Process
\`\`\`bash
ps aux | grep monitor
\`\`\`

## Available Deployments

\`\`\`bash
ls -la $DEPLOYMENT_DIR/*.jar
\`\`\`

## Current Command

The monitor runs with this command:
\`\`\`bash
nohup java -jar monitor.jar --spring.profiles.active=prod > run_bsl.out 2>&1 &
\`\`\`
EOF

play_sound "success"
vocal_status "Installation instructions created successfully"
echo "✅ Installation instructions created"

# Step 7: Upload to Skypoint server
echo ""
play_sound "upload"
vocal_status "Step 7: Uploading to Skypoint server"
echo "Step 7: Uploading to Skypoint server..."

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

# Verify weblogic directory exists
vocal_status "Verifying weblogic directory exists"
echo "Verifying weblogic directory exists..."
ssh "$SKYPOINT_SERVER" "
    if [ ! -d '$SKYPOINT_WEBLOGIC_HOME' ]; then
        echo '❌ WebLogic directory not found: $SKYPOINT_WEBLOGIC_HOME'
        echo '   Please create the directory first'
        exit 1
    else
        echo '✅ WebLogic directory exists: $SKYPOINT_WEBLOGIC_HOME'
    fi
"

# Check for existing running process
vocal_status "Checking for existing running processes"
echo "Checking for existing running process..."
ssh "$SKYPOINT_SERVER" "
    PID_FILE='$SKYPOINT_WEBLOGIC_HOME/monitor.pid'
    
    # Check PID file first
    if [ -f \"\$PID_FILE\" ]; then
        PID=\$(cat \"\$PID_FILE\")
        if kill -0 \$PID 2>/dev/null; then
            echo '⚠️  Monitor is already running (PID: \$PID)'
            echo '   Stopping existing process...'
            kill \$PID
            sleep 3
            
            # Force kill if still running
            if kill -0 \$PID 2>/dev/null; then
                echo '   Force stopping process...'
                kill -9 \$PID
            fi
            
            rm -f \"\$PID_FILE\"
            echo '✅ Existing process stopped'
        else
            echo 'Removing stale PID file...'
            rm -f \"\$PID_FILE\"
        fi
    fi
    
    # Check for BSL Monitor processes running on port 9093
    PORT_PID=\$(lsof -ti:9093 2>/dev/null || echo '')
    if [ -n \"\$PORT_PID\" ]; then
        # Verify it's our BSL Monitor process
        PROCESS_CMD=\$(ps -p \$PORT_PID -o args= 2>/dev/null || echo '')
        if echo \"\$PROCESS_CMD\" | grep -q 'bsl-monitor\|monitor.jar\|application-prod.yaml'; then
            echo '⚠️  Found BSL Monitor process using port 9093 (PID: \$PORT_PID)'
            echo '   Stopping process...'
            kill \$PORT_PID
            sleep 2
            
            # Force kill if still running
            if kill -0 \$PORT_PID 2>/dev/null; then
                echo '   Force stopping process...'
                kill -9 \$PORT_PID
            fi
            
            echo '✅ BSL Monitor port 9093 process stopped'
        else
            echo '⚠️  Port 9093 is in use by another process (PID: \$PORT_PID)'
            echo '   Command: \$PROCESS_CMD'
            echo '   Skipping port 9093 process (not BSL Monitor)'
        fi
    fi
    
    # Check for BSL Monitor Java processes specifically
    JAVA_PIDS=\$(ps aux | grep -E 'java.*(bsl-monitor|monitor.jar|application-prod.yaml)' | grep -v grep | awk '{print \$2}' || echo '')
    if [ -n \"\$JAVA_PIDS\" ]; then
        echo '⚠️  Found BSL Monitor Java processes: \$JAVA_PIDS'
        echo '   Stopping processes...'
        for pid in \$JAVA_PIDS; do
            echo '   Stopping PID: \$pid'
            kill \$pid
        done
        sleep 2
        
        # Force kill if still running
        for pid in \$JAVA_PIDS; do
            if kill -0 \$pid 2>/dev/null; then
                echo '   Force stopping PID: \$pid...'
                kill -9 \$pid
            fi
        done
        
        echo '✅ BSL Monitor Java processes stopped'
    fi
    
    echo '✅ BSL Monitor process check completed'
"

# Create remote deployment directory
echo "Creating remote deployment directory..."
ssh "$SKYPOINT_SERVER" "mkdir -p $SKYPOINT_DEPLOYMENT_DIR"

# Upload JAR file
echo "Uploading JAR file..."
scp "$DEPLOYMENT_DIR/$JAR_NAME" "$SKYPOINT_SERVER:$SKYPOINT_DEPLOYMENT_DIR/"

# Upload all scripts
echo "Uploading deployment scripts..."
scp "$DEPLOYMENT_DIR"/*.sh "$SKYPOINT_SERVER:$SKYPOINT_DEPLOYMENT_DIR/"

# Upload installation instructions
echo "Uploading installation instructions..."
scp "$DEPLOYMENT_DIR/INSTALLATION_INSTRUCTIONS.md" "$SKYPOINT_SERVER:$SKYPOINT_DEPLOYMENT_DIR/"

# Create symbolic links on remote server
echo "Creating symbolic links on remote server..."
ssh "$SKYPOINT_SERVER" "
    # Create symlink to latest JAR
    ln -sf $SKYPOINT_DEPLOYMENT_DIR/$JAR_NAME $SKYPOINT_WEBLOGIC_HOME/monitor.jar
    
    # Create symlinks to scripts
    ln -sf $SKYPOINT_DEPLOYMENT_DIR/start-monitor.sh $SKYPOINT_WEBLOGIC_HOME/start-monitor.sh
    ln -sf $SKYPOINT_DEPLOYMENT_DIR/stop-monitor.sh $SKYPOINT_WEBLOGIC_HOME/stop-monitor.sh
    ln -sf $SKYPOINT_DEPLOYMENT_DIR/restart-monitor.sh $SKYPOINT_WEBLOGIC_HOME/restart-monitor.sh
    ln -sf $SKYPOINT_DEPLOYMENT_DIR/status-monitor.sh $SKYPOINT_WEBLOGIC_HOME/status-monitor.sh
    ln -sf $SKYPOINT_DEPLOYMENT_DIR/deploy.sh $SKYPOINT_WEBLOGIC_HOME/deploy.sh
    
    echo '✅ Remote deployment completed on $SKYPOINT_SERVER'
"

echo "✅ Upload to Skypoint server completed"

# Step 8: Final verification
echo ""
echo "Step 8: Final verification..."

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

# Test JAR file locally
echo "Testing JAR file locally..."
timeout 30 java -jar "$DEPLOYMENT_DIR/$JAR_NAME" --spring.profiles.active=prod --spring.main.web-application-type=none --help > /dev/null 2>&1 &
TEST_PID=$!
sleep 5
if kill -0 $TEST_PID 2>/dev/null; then
    echo "✅ Local JAR test successful"
    kill $TEST_PID
else
    echo "❌ Local JAR test failed"
    exit 1
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
    
    if [ -f '$SKYPOINT_WEBLOGIC_HOME/monitor.jar' ]; then
        echo '✅ Remote symbolic link exists'
    else
        echo '❌ Remote symbolic link not found'
        exit 1
    fi
    
    if [ -f '$SKYPOINT_WEBLOGIC_HOME/start-monitor.sh' ]; then
        echo '✅ Remote start script exists'
    else
        echo '❌ Remote start script not found'
        exit 1
    fi
"

echo ""
echo "=== DEPLOYMENT COMPLETE ==="
echo "✅ Build: $JAR_NAME"
echo "✅ Local Deployment Dir: $DEPLOYMENT_DIR"
echo "✅ Remote Server: $SKYPOINT_SERVER"
echo "✅ Remote Deployment Dir: $SKYPOINT_DEPLOYMENT_DIR"
echo "✅ Remote WebLogic Home: $SKYPOINT_WEBLOGIC_HOME"
echo ""
echo "Next Steps on Skypoint Server:"
echo "1. SSH to server: ssh $SKYPOINT_SERVER"
echo "2. Switch to weblogic user: sudo -iu weblogic"
echo "3. Source environment: source .prod_env"
echo "4. Navigate to: cd $SKYPOINT_WEBLOGIC_HOME"
echo "5. Start monitor: ./start-monitor.sh"
echo "6. Check status: ./status-monitor.sh"
echo "7. Stop monitor: ./stop-monitor.sh"
echo "8. Restart monitor: ./restart-monitor.sh"
echo ""
echo "Scripts available on remote server:"
echo "- start-monitor.sh"
echo "- stop-monitor.sh"
echo "- restart-monitor.sh"
echo "- status-monitor.sh"
echo "- deploy.sh"
echo ""
echo "Remote deployment files:"
echo "- JAR: $SKYPOINT_DEPLOYMENT_DIR/$JAR_NAME"
echo "- Scripts: $SKYPOINT_DEPLOYMENT_DIR/*.sh"
echo "- Instructions: $SKYPOINT_DEPLOYMENT_DIR/INSTALLATION_INSTRUCTIONS.md"
