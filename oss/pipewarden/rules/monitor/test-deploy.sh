#!/bin/bash

# Billpro Service Monitor - Test Deploy Script
# This script deploys the application in TEST mode

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
            say "Starting test deployment" 2>/dev/null || true
            ;;
        "complete")
            echo -e "\a\a\a"
            say "Test deployment completed successfully" 2>/dev/null || true
            ;;
        "upload")
            echo -e "\a"
            say "Uploading to server" 2>/dev/null || true
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

# Skypoint server configuration
SKYPOINT_SERVER="dk01"
SKYPOINT_DEPLOYMENT_DIR="/home/weblogic/bsl_monitor1/deployments"
SKYPOINT_MONITOR_HOME="/home/weblogic/bsl_monitor1"

# Start deployment with sound and vocal feedback
play_sound "start"
vocal_status "Starting test deployment for Billpro Service Monitor"

echo "=== Billpro Service Monitor - Test Deploy ==="
echo "Timestamp: $TIMESTAMP"
echo "JAR Name: $JAR_NAME"
echo "Profile: TEST"
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
    vocal_status "No JAR file found"
    echo "❌ No JAR file found in build/libs/"
    exit 1
fi

# Create deployment directory
mkdir -p "$DEPLOYMENT_DIR"

# Copy JAR to deployment directory
cp "$BUILT_JAR" "$DEPLOYMENT_DIR/$JAR_NAME"

echo "JAR file copied successfully"
echo "✅ JAR copied: $DEPLOYMENT_DIR/$JAR_NAME"

# Step 3: Upload to Skypoint server
echo ""
vocal_status "Step 3: Uploading to Skypoint server"
echo "Step 3: Uploading to Skypoint server..."

# Test SSH connection
echo "Testing SSH connection to Skypoint server"
echo "Testing SSH connection to $SKYPOINT_SERVER..."
if ! ssh -o ConnectTimeout=10 "$SKYPOINT_SERVER" "echo 'SSH connection successful'" > /dev/null 2>&1; then
    play_sound "error"
    vocal_status "SSH connection failed"
    echo "❌ SSH connection to $SKYPOINT_SERVER failed"
    exit 1
fi

play_sound "upload"
vocal_status "SSH connection successful"
echo "✅ SSH connection successful"

# Upload JAR file to temporary location first
echo "Uploading JAR file to temporary location..."
TEMP_DIR="/tmp/bsl-monitor-temp"
ssh "$SKYPOINT_SERVER" "mkdir -p $TEMP_DIR"

scp "$DEPLOYMENT_DIR/$JAR_NAME" "$SKYPOINT_SERVER:$TEMP_DIR/"

# Move file to deployment directory with proper permissions
echo "Moving JAR file to deployment directory with proper permissions..."
ssh "$SKYPOINT_SERVER" "
    # Move JAR to deployment directory
    mv $TEMP_DIR/$JAR_NAME $SKYPOINT_DEPLOYMENT_DIR/
    
    # Set proper ownership
    sudo chown weblogic:weblogic $SKYPOINT_DEPLOYMENT_DIR/$JAR_NAME
    
    # Set proper permissions
    sudo chmod 644 $SKYPOINT_DEPLOYMENT_DIR/$JAR_NAME
    
    # Clean up temp directory
    sudo rmdir $TEMP_DIR
    
    echo '✅ JAR file moved and permissions set'
"

# Update symbolic link on remote server (as weblogic user)
echo "Updating symbolic link on remote server..."
ssh "$SKYPOINT_SERVER" "
    # Switch to weblogic user and update symbolic link
    sudo -u weblogic bash -c '
        ln -sf $SKYPOINT_DEPLOYMENT_DIR/$JAR_NAME $SKYPOINT_MONITOR_HOME/monitor.jar
        echo \"✅ Symbolic link updated as weblogic user\"
    '
    echo '✅ Symbolic link updated on $SKYPOINT_SERVER'
"

# Step 4: Start in test mode
echo ""
vocal_status "Step 4: Starting application in test mode"
echo "Step 4: Starting application in test mode..."

ssh "$SKYPOINT_SERVER" "
    # Switch to weblogic user and start in test mode
    sudo -u weblogic bash -c '
        cd $SKYPOINT_MONITOR_HOME
        
        # Stop existing monitor if running
        if [ -f monitor.pid ]; then
            PID=\$(cat monitor.pid)
            if kill -0 \$PID 2>/dev/null; then
                echo \"Stopping existing monitor (PID: \$PID)...\"
                kill \$PID
                sleep 3
            fi
            rm -f monitor.pid
        fi
        
        # Start with test profile
        echo \"Starting monitor in TEST mode...\"
        nohup java -Dspring.application.name=bsl-monitor-test \\
          -jar $SKYPOINT_DEPLOYMENT_DIR/$JAR_NAME \\
          --spring.profiles.active=test \\
          > run_bsl_test.out 2>&1 &
        
        echo \$! > monitor.pid
        echo \"✅ BSL Monitor started in TEST mode with PID: \$(cat monitor.pid)\"
        echo \"Process Name: bsl-monitor-test\"
        echo \"Profile: test\"
        echo \"Logs: run_bsl_test.out\"
    '
"

play_sound "complete"
vocal_status "Test deployment completed successfully"
echo "✅ Test deployment completed successfully"

echo ""
echo "=== TEST DEPLOYMENT COMPLETE ==="
echo "✅ Build: $JAR_NAME"
echo "✅ Profile: TEST"
echo "✅ Server: $SKYPOINT_SERVER"
echo "✅ Logs: run_bsl_test.out"
echo ""
echo "Test mode features:"
echo "- Alerts will be labeled as 'TEST'"
echo "- Email recipients: shacharsol@gmail.com, shahar.solomon@billpro-software.com"
echo "- Reduced service monitoring (essential services only)"
echo "- Test configuration loaded"
echo ""
echo "To check status:"
echo "  ssh $SKYPOINT_SERVER"
echo "  sudo -iu weblogic"
echo "  cd $SKYPOINT_MONITOR_HOME"
echo "  tail -f run_bsl_test.out"
echo ""
echo "To switch back to PROD mode:"
echo "  ./start-monitor.sh $JAR_NAME prod"















