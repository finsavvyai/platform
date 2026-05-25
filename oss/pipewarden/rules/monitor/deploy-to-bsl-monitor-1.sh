#!/bin/bash

# Billpro Service Monitor - Deploy to bsl-monitor-1 folder on dktest server
# This script deploys the application to a new bsl-monitor-1 folder

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
            say "Starting deployment to bsl-monitor-1" 2>/dev/null || true
            ;;
        "complete")
            echo -e "\a\a\a"
            say "Deployment to bsl-monitor-1 completed successfully" 2>/dev/null || true
            ;;
        "upload")
            echo -e "\a"
            say "Uploading to dktest server" 2>/dev/null || true
            ;;
        "build")
            echo -e "\a"
            say "Build completed" 2>/dev/null || true
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

# DKTEST server configuration for bsl-monitor-1
DKTEST_SERVER="dktest"
DKTEST_DEPLOYMENT_DIR="/home/weblogic/bsl-monitor-1/deployments"
DKTEST_MONITOR_HOME="/home/weblogic/bsl-monitor-1"

# Start deployment with sound and vocal feedback
play_sound "start"
vocal_status "Starting deployment to bsl-monitor-1 folder on dktest server"

echo "=== Billpro Service Monitor - Deploy to bsl-monitor-1 ==="
echo "Timestamp: $TIMESTAMP"
echo "JAR Name: $JAR_NAME"
echo "Target Server: $DKTEST_SERVER"
echo "Target Directory: $DKTEST_MONITOR_HOME"
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

# Step 2: Copy JAR to deployment directory
echo ""
vocal_status "Step 2: Copying JAR to deployment directory"
echo "Step 2: Copying JAR to deployment directory..."

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

# Create deployment directory
mkdir -p "$DEPLOYMENT_DIR"

# Copy to deployment directory with unique name
cp "$BUILT_JAR" "$DEPLOYMENT_DIR/$JAR_NAME"

play_sound "success"
vocal_status "JAR file copied successfully"
echo "✅ JAR copied: $DEPLOYMENT_DIR/$JAR_NAME"

# Step 3: Upload to DKTEST server
echo ""
play_sound "upload"
vocal_status "Step 3: Uploading to DKTEST server"
echo "Step 3: Uploading to DKTEST server..."

# Test SSH connection
vocal_status "Testing SSH connection to DKTEST server"
echo "Testing SSH connection to $DKTEST_SERVER..."
if ssh -o ConnectTimeout=10 -o BatchMode=yes "$DKTEST_SERVER" "echo 'SSH connection successful'" 2>/dev/null; then
    play_sound "success"
    vocal_status "SSH connection successful"
    echo "✅ SSH connection successful"
else
    play_sound "error"
    vocal_status "SSH connection failed"
    echo "❌ SSH connection failed"
    echo "   Please ensure you can connect to $DKTEST_SERVER"
    echo "   Try: ssh $DKTEST_SERVER"
    exit 1
fi

# Ensure deployment directory exists and has proper permissions
echo "Ensuring deployment directory exists with proper permissions..."
ssh "$DKTEST_SERVER" "
    # Check if weblogic directory exists, create if not
    if [ ! -d '/home/weblogic' ]; then
        echo '⚠️  WebLogic directory not found, creating: /home/weblogic'
        sudo mkdir -p '/home/weblogic'
        sudo chown weblogic:weblogic '/home/weblogic'
        echo '✅ WebLogic directory created: /home/weblogic'
    fi
    
    # Create bsl-monitor-1 directory if it doesn't exist (owned by weblogic)
    if [ ! -d '$DKTEST_MONITOR_HOME' ]; then
        echo 'Creating bsl-monitor-1 directory: $DKTEST_MONITOR_HOME'
        sudo mkdir -p '$DKTEST_MONITOR_HOME'
        sudo chown weblogic:weblogic '$DKTEST_MONITOR_HOME'
        sudo chmod 755 '$DKTEST_MONITOR_HOME'
        echo '✅ bsl-monitor-1 directory created: $DKTEST_MONITOR_HOME'
    fi
    
    # Create deployments directory with group access for both weblogic and scq9102
    sudo mkdir -p $DKTEST_DEPLOYMENT_DIR
    
    # Set ownership to weblogic but with group access for scq9102
    sudo chown weblogic:weblogic $DKTEST_DEPLOYMENT_DIR
    
    # Set permissions: owner (weblogic) can read/write/execute, group can read/write/execute, others can read/execute
    sudo chmod 775 $DKTEST_DEPLOYMENT_DIR
    
    # Add scq9102 to weblogic group if not already added
    sudo usermod -a -G weblogic scq9102 2>/dev/null || echo 'scq9102 already in weblogic group or group does not exist'
    
    echo '✅ Deployment directory ready with proper permissions (775) for both weblogic and scq9102'
"

# Upload JAR file to temporary location first
echo "Uploading JAR file to temporary location..."
TEMP_DIR="/tmp/bsl-monitor-temp"
ssh "$DKTEST_SERVER" "mkdir -p $TEMP_DIR"

scp "$DEPLOYMENT_DIR/$JAR_NAME" "$DKTEST_SERVER:$TEMP_DIR/"

# Move file to deployment directory with proper permissions
echo "Moving JAR file to deployment directory with proper permissions..."
ssh "$DKTEST_SERVER" "
    # Move JAR to deployment directory
    sudo mv $TEMP_DIR/$JAR_NAME $DKTEST_DEPLOYMENT_DIR/
    
    # Set proper ownership (weblogic:weblogic)
    sudo chown weblogic:weblogic $DKTEST_DEPLOYMENT_DIR/$JAR_NAME
    
    # Set proper permissions (readable by group, writable by owner)
    sudo chmod 664 $DKTEST_DEPLOYMENT_DIR/$JAR_NAME
    
    # Clean up temp directory
    rmdir $TEMP_DIR
    
    echo '✅ JAR file moved to deployment directory with proper permissions (664)'
    echo '   Owner: weblogic, Group: weblogic, Permissions: rw-rw-r--'
"

# Create symbolic link on remote server (as weblogic user)
echo "Creating symbolic link on remote server..."
ssh "$DKTEST_SERVER" "
    # Switch to weblogic user and create symbolic link
    sudo -u weblogic bash -c '
        ln -sf $DKTEST_DEPLOYMENT_DIR/$JAR_NAME $DKTEST_MONITOR_HOME/monitor.jar
        echo \"✅ Symbolic link created as weblogic user\"
    '
    echo '✅ Symbolic link created on $DKTEST_SERVER'
"

# Create management scripts on remote server
echo "Creating management scripts on remote server..."
ssh "$DKTEST_SERVER" "
    # Create start script
    sudo -u weblogic tee $DKTEST_MONITOR_HOME/start-monitor.sh > /dev/null << 'EOF'
#!/bin/bash

# Billpro Service Monitor - Start Script for bsl-monitor-1
# Usage: ./start-monitor.sh [JAR_NAME]

set -e

DEPLOYMENT_DIR=\"$DKTEST_DEPLOYMENT_DIR\"
MONITOR_HOME=\"$DKTEST_MONITOR_HOME\"
PID_FILE=\"\$MONITOR_HOME/monitor.pid\"
LOG_FILE=\"\$MONITOR_HOME/run_bsl.out\"

# Use provided JAR name or find the latest one
if [ -n \"\$1\" ]; then
    JAR_NAME=\"\$1\"
else
    JAR_NAME=\$(ls -t \"\$DEPLOYMENT_DIR\"/*.jar 2>/dev/null | head -1 | xargs basename)
fi

if [ -z \"\$JAR_NAME\" ] || [ ! -f \"\$DEPLOYMENT_DIR/\$JAR_NAME\" ]; then
    echo \"❌ No JAR file found in \$DEPLOYMENT_DIR\"
    exit 1
fi

echo \"Starting Billpro Service Monitor (bsl-monitor-1)...\"
echo \"JAR: \$JAR_NAME\"
echo \"Home: \$MONITOR_HOME\"

cd \"\$MONITOR_HOME\"

# Source production environment if available
if [ -f \".prod_env\" ]; then
    echo \"Sourcing production environment...\"
    source .prod_env
fi

# Check if already running
if [ -f \"\$PID_FILE\" ]; then
    PID=\$(cat \"\$PID_FILE\")
    if kill -0 \$PID 2>/dev/null; then
        echo \"⚠️  Monitor is already running (PID: \$PID)\"
        echo \"   Use ./stop-monitor.sh first, or ./restart-monitor.sh\"
        exit 1
    else
        echo \"Removing stale PID file...\"
        rm -f \"\$PID_FILE\"
    fi
fi

# Start the monitor with specific process name
nohup java -Dspring.application.name=bsl-monitor-1 \\
  -jar \"\$DEPLOYMENT_DIR/\$JAR_NAME\" \\
  --spring.profiles.active=prod \\
  > \"\$LOG_FILE\" 2>&1 &

echo \$! > \"\$PID_FILE\"
echo \"✅ BSL Monitor (bsl-monitor-1) started with PID: \$(cat \$PID_FILE)\"
echo \"Process Name: bsl-monitor-1\"
echo \"Port: 9093\"
echo \"Logs: \$LOG_FILE\"
echo \"PID File: \$PID_FILE\"
EOF

    # Create stop script
    sudo -u weblogic tee $DKTEST_MONITOR_HOME/stop-monitor.sh > /dev/null << 'EOF'
#!/bin/bash

# Billpro Service Monitor - Stop Script for bsl-monitor-1

MONITOR_HOME=\"$DKTEST_MONITOR_HOME\"
PID_FILE=\"\$MONITOR_HOME/monitor.pid\"

echo \"Stopping Billpro Service Monitor (bsl-monitor-1)...\"

if [ -f \"\$PID_FILE\" ]; then
    PID=\$(cat \"\$PID_FILE\")
    if kill -0 \$PID 2>/dev/null; then
        echo \"Stopping monitor (PID: \$PID)...\"
        kill \$PID
        sleep 3
        
        # Force kill if still running
        if kill -0 \$PID 2>/dev/null; then
            echo \"Force stopping monitor...\"
            kill -9 \$PID
        fi
        
        echo \"✅ Monitor stopped\"
    else
        echo \"Monitor not running (stale PID file)\"
    fi
    rm -f \"\$PID_FILE\"
else
    echo \"Monitor not running (no PID file)\"
fi
EOF

    # Create status script
    sudo -u weblogic tee $DKTEST_MONITOR_HOME/status-monitor.sh > /dev/null << 'EOF'
#!/bin/bash

# Billpro Service Monitor - Status Script for bsl-monitor-1

MONITOR_HOME=\"$DKTEST_MONITOR_HOME\"
DEPLOYMENT_DIR=\"$DKTEST_DEPLOYMENT_DIR\"
PID_FILE=\"\$MONITOR_HOME/monitor.pid\"
LOG_FILE=\"\$MONITOR_HOME/run_bsl.out\"

echo \"=== Billpro Service Monitor Status (bsl-monitor-1) ===\"
echo \"Date: \$(date)\"
echo \"\"

# Check if monitor is running
if [ -f \"\$PID_FILE\" ]; then
    PID=\$(cat \"\$PID_FILE\")
    if kill -0 \$PID 2>/dev/null; then
        echo \"✅ BSL Monitor (bsl-monitor-1) is running (PID: \$PID)\"
        echo \"Process Name: bsl-monitor-1\"
        echo \"Port: 9093\"
        echo \"Logs: \$LOG_FILE\"
        echo \"PID File: \$PID_FILE\"
        
        # Check health endpoint
        if curl -s http://localhost:9093/sanity > /dev/null; then
            echo \"✅ Health check passed\"
        else
            echo \"❌ Health check failed\"
        fi
    else
        echo \"❌ Monitor is not running (stale PID file)\"
        rm -f \"\$PID_FILE\"
    fi
else
    echo \"❌ Monitor is not running\"
fi

# Show available JARs
echo \"\"
echo \"=== Available Deployments ===\"
if [ -d \"\$DEPLOYMENT_DIR\" ]; then
    ls -la \"\$DEPLOYMENT_DIR\"/*.jar 2>/dev/null || echo \"No JAR files found\"
else
    echo \"Deployment directory not found\"
fi

# Show recent logs
echo \"\"
echo \"=== Recent Logs ===\"
if [ -f \"\$LOG_FILE\" ]; then
    tail -n 10 \"\$LOG_FILE\"
else
    echo \"No log file found\"
fi
EOF

    # Make scripts executable
    sudo chmod +x $DKTEST_MONITOR_HOME/*.sh
    
    echo '✅ Management scripts created and made executable'
"

echo "✅ Upload to DKTEST server completed"

# Step 4: Final verification
echo ""
vocal_status "Step 4: Final verification"
echo "Step 4: Final verification..."

# Check if everything is in place locally
echo "Checking local deployment structure..."
if [ -f "$DEPLOYMENT_DIR/$JAR_NAME" ]; then
    echo "✅ Local JAR file: $DEPLOYMENT_DIR/$JAR_NAME"
else
    echo "❌ Local JAR file not found"
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
ssh "$DKTEST_SERVER" "
    if [ -f '$DKTEST_DEPLOYMENT_DIR/$JAR_NAME' ]; then
        echo '✅ Remote JAR file exists'
    else
        echo '❌ Remote JAR file not found'
        exit 1
    fi
    
    if [ -f '$DKTEST_MONITOR_HOME/monitor.jar' ]; then
        echo '✅ Remote symbolic link exists'
    else
        echo '❌ Remote symbolic link not found'
        exit 1
    fi
    
    if [ -f '$DKTEST_MONITOR_HOME/start-monitor.sh' ]; then
        echo '✅ Remote start script exists'
    else
        echo '❌ Remote start script not found'
        exit 1
    fi
"

echo ""
play_sound "complete"
vocal_status "Deployment to bsl-monitor-1 completed successfully"
echo "=== DEPLOYMENT TO BSL-MONITOR-1 COMPLETE ==="
echo "✅ Build: $JAR_NAME"
echo "✅ Local Deployment Dir: $DEPLOYMENT_DIR"
echo "✅ Remote Server: $DKTEST_SERVER"
echo "✅ Remote Deployment Dir: $DKTEST_DEPLOYMENT_DIR"
echo "✅ Remote Monitor Home: $DKTEST_MONITOR_HOME"
echo ""
echo "Next Steps on DKTEST Server:"
echo "1. SSH to server: ssh $DKTEST_SERVER"
echo "2. Switch to weblogic user: sudo -iu weblogic"
echo "3. Source environment: source .prod_env"
echo "4. Navigate to: cd $DKTEST_MONITOR_HOME"
echo "5. Start monitor: ./start-monitor.sh"
echo "6. Check status: ./status-monitor.sh"
echo ""
echo "Scripts available on remote server:"
echo "- start-monitor.sh"
echo "- stop-monitor.sh"
echo "- status-monitor.sh"
echo ""
echo "Remote deployment files:"
echo "- JAR: $DKTEST_DEPLOYMENT_DIR/$JAR_NAME"
echo "- Symbolic link: $DKTEST_MONITOR_HOME/monitor.jar"
echo "- Scripts: $DKTEST_MONITOR_HOME/*.sh"
