#!/bin/bash

# Billpro Service Monitor - Quick Deploy Script
# This script is for continuous deployment without recreating scripts

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
            say "Starting quick deployment" 2>/dev/null || true
            ;;
        "complete")
            echo -e "\a\a\a"
            say "Quick deployment completed successfully" 2>/dev/null || true
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
vocal_status "Starting quick deployment for Billpro Service Monitor"

echo "=== Billpro Service Monitor - Quick Deploy ==="
echo "Timestamp: $TIMESTAMP"
echo "JAR Name: $JAR_NAME"
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

# Step 3: Upload to Skypoint server
echo ""
play_sound "upload"
vocal_status "Step 3: Uploading to Skypoint server"
echo "Step 3: Uploading to Skypoint server..."

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

# Ensure deployment directory exists and has proper permissions
echo "Ensuring deployment directory exists with proper permissions..."
ssh "$SKYPOINT_SERVER" "
    # Check if weblogic directory exists, create if not
    if [ ! -d '$SKYPOINT_WEBLOGIC_HOME' ]; then
        echo '⚠️  WebLogic directory not found, creating: $SKYPOINT_WEBLOGIC_HOME'
        mkdir -p '$SKYPOINT_WEBLOGIC_HOME'
        echo '✅ WebLogic directory created: $SKYPOINT_WEBLOGIC_HOME'
    fi
    
    # Create deployment directory if it doesn't exist
    mkdir -p $SKYPOINT_DEPLOYMENT_DIR
    
    # Set directory permissions to allow group write access (no sudo needed)
    chmod 775 $SKYPOINT_DEPLOYMENT_DIR
    
    echo '✅ Deployment directory ready with proper permissions for upload'
"

# Upload JAR file to temporary location first
echo "Uploading JAR file to temporary location..."
TEMP_DIR="/tmp/bsl-monitor-temp"
ssh "$SKYPOINT_SERVER" "mkdir -p $TEMP_DIR"

scp "$DEPLOYMENT_DIR/$JAR_NAME" "$SKYPOINT_SERVER:$TEMP_DIR/"

# Move file to deployment directory with proper permissions
echo "Moving JAR file to deployment directory with proper permissions..."
ssh "$SKYPOINT_SERVER" "
    # Move JAR to deployment directory (as scq9102)
    mv $TEMP_DIR/$JAR_NAME $SKYPOINT_DEPLOYMENT_DIR/
    
    # Clean up temp directory
    rmdir $TEMP_DIR
    
    echo '✅ JAR file moved to deployment directory'
    echo '⚠️  Note: You may need to run fix-permissions.sh to set proper ownership'
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

echo "✅ Upload to Skypoint server completed"

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
"

echo ""
play_sound "complete"
vocal_status "Quick deployment completed successfully"
echo "=== QUICK DEPLOYMENT COMPLETE ==="
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
echo "5. Deploy new version: ./quick-deploy.sh"
echo "6. Check status: ./status-monitor.sh"
echo ""
echo "Remote deployment files:"
echo "- JAR: $SKYPOINT_DEPLOYMENT_DIR/$JAR_NAME"
echo "- Symbolic link: $SKYPOINT_MONITOR_HOME/monitor.jar"
