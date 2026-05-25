#!/bin/bash

# BSL Monitor-1 Complete Deployment Script
# This script builds locally, uploads to dktest, and deploys automatically

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
            say "Starting deployment" 2>/dev/null || true
            ;;
        "complete")
            echo -e "\a\a\a"
            say "Deployment completed successfully" 2>/dev/null || true
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

# DKTEST server configuration
DKTEST_SERVER="dktest"
DKTEST_USER="scq9102"
DKTEST_DEPLOY_DIR="/home/scq9102@tcad.telia.se/bsl-monitor-1-deploy"
DKTEST_TEMP_DIR="/tmp/bsl-deployments"
WEBLOGIC_USER="weblogic"
WEBLOGIC_PASSWORD="Daniel0304##"
WEBLOGIC_HOME="/home/weblogic"
MONITOR_HOME="/home/weblogic/bsl-monitor-1"
MONITOR_DEPLOYMENTS="/home/weblogic/bsl-monitor-1/deployments"

# Start deployment with sound and vocal feedback
play_sound "start"
vocal_status "Starting BSL Monitor-1 deployment to dktest server"

echo "=== BSL Monitor-1 Complete Deployment ==="
echo "Timestamp: $TIMESTAMP"
echo "JAR Name: $JAR_NAME"
echo "Target Server: $DKTEST_SERVER"
echo "Target User: $DKTEST_USER"
echo "WebLogic User: $WEBLOGIC_USER"
echo "Monitor Home: $MONITOR_HOME"
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

# Find the built JAR
BUILT_JAR=$(find build/libs -name "*.jar" | head -1)
if [ -z "$BUILT_JAR" ]; then
    play_sound "error"
    vocal_status "No JAR file found"
    echo "❌ No JAR file found in build/libs/"
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

# Upload JAR file to scq9102 deploy directory
echo "Uploading JAR file to scq9102 deploy directory..."
scp "$DEPLOYMENT_DIR/$JAR_NAME" "$DKTEST_SERVER:$DKTEST_DEPLOY_DIR/"

play_sound "success"
vocal_status "JAR file uploaded successfully"
echo "✅ JAR uploaded to: $DKTEST_DEPLOY_DIR/$JAR_NAME"

# Step 4: Deploy on server
echo ""
vocal_status "Step 4: Deploying on server"
echo "Step 4: Deploying on server..."

# Create deployment script on server
echo "Copying JAR to temp directory for weblogic access..."
ssh "$DKTEST_SERVER" "
    # Create temp directory for weblogic access
    mkdir -p $DKTEST_TEMP_DIR
    
    # Copy JAR from scq9102 directory to temp directory
    if cp $DKTEST_DEPLOY_DIR/$JAR_NAME $DKTEST_TEMP_DIR/; then
        # Set proper permissions for weblogic access
        chmod 644 $DKTEST_TEMP_DIR/$JAR_NAME
        echo '✅ JAR copied to temp directory: $DKTEST_TEMP_DIR/$JAR_NAME'
        
        # Verify the copy worked
        if [ -f '$DKTEST_TEMP_DIR/$JAR_NAME' ]; then
            echo '✅ JAR file verified in temp directory'
        else
            echo '❌ JAR file not found in temp directory after copy'
            exit 1
        fi
    else
        echo '❌ Failed to copy JAR to temp directory'
        exit 1
    fi
    
    # Also copy to /tmp/ for easier weblogic access
    if cp $DKTEST_DEPLOY_DIR/$JAR_NAME /tmp/; then
        chmod 644 /tmp/$JAR_NAME
        echo '✅ JAR also copied to /tmp/ for weblogic access'
    else
        echo '⚠️  Failed to copy JAR to /tmp/, but temp directory copy succeeded'
    fi
"

# Check if the copy operation succeeded
if [ $? -ne 0 ]; then
    play_sound "error"
    vocal_status "Failed to copy JAR to temp directory"
    echo "❌ Failed to copy JAR to temp directory"
    exit 1
fi

# Step 5: Deploy as weblogic user
echo ""
vocal_status "Step 5: Deploying as weblogic user"
echo "Step 5: Deploying as weblogic user..."

# Deploy using weblogic user with password
echo "Attempting weblogic user deployment..."
WEBLOGIC_DEPLOY_SUCCESS=false

# Create a deployment script file on the server
ssh "$DKTEST_SERVER" "
    # Create deployment script for weblogic user
    cat > /tmp/deploy_weblogic.sh << 'DEPLOY_SCRIPT'
#!/bin/bash

JAR_NAME=\"$JAR_NAME\"
WEBLOGIC_HOME=\"$WEBLOGIC_HOME\"
MONITOR_HOME=\"$MONITOR_HOME\"
MONITOR_DEPLOYMENTS=\"$MONITOR_DEPLOYMENTS\"
DKTEST_TEMP_DIR=\"$DKTEST_TEMP_DIR\"

echo \"Starting weblogic deployment...\"

# Source test environment
cd \$WEBLOGIC_HOME
if [ -f \".test_env\" ]; then
    echo \"Sourcing test environment...\"
    source .test_env
fi

# Create deployments directory if it doesn't exist
mkdir -p \$MONITOR_DEPLOYMENTS

# Copy JAR from temp to deployments directory
if cp \$DKTEST_TEMP_DIR/\$JAR_NAME \$MONITOR_DEPLOYMENTS/; then
    echo \"✅ JAR copied to deployments directory\"
    
    # Set proper ownership and permissions
    chmod 644 \$MONITOR_DEPLOYMENTS/\$JAR_NAME
    
    # Navigate to monitor home
    cd \$MONITOR_HOME
    
    # Stop existing monitor if running
    if [ -f \"monitor.pid\" ]; then
        PID=\$(cat monitor.pid)
        if kill -0 \$PID 2>/dev/null; then
            echo \"Stopping existing monitor (PID: \$PID)...\"
            kill \$PID
            sleep 3
            # Force kill if still running
            if kill -0 \$PID 2>/dev/null; then
                kill -9 \$PID
            fi
            rm -f monitor.pid
            echo \"✅ Existing monitor stopped\"
        fi
    fi
    
    # Create symbolic link to new JAR
    ln -sf deployments/\$JAR_NAME monitor.jar
    echo \"✅ Symbolic link created: monitor.jar -> deployments/\$JAR_NAME\"
    
    # Start the monitor
    echo \"Starting BSL Monitor-1...\"
    nohup java -Dspring.application.name=bsl-monitor-1 \\
      -jar deployments/\$JAR_NAME \\
      --spring.profiles.active=prod \\
      > run_bsl.out 2>&1 &
    
    echo \$! > monitor.pid
    echo \"✅ BSL Monitor-1 started with PID: \$(cat monitor.pid)\"
    echo \"Process Name: bsl-monitor-1\"
    echo \"Port: 9093\"
    echo \"Logs: \$MONITOR_HOME/run_bsl.out\"
    echo \"PID File: \$MONITOR_HOME/monitor.pid\"
    
    # Wait a moment for startup
    sleep 5
    
    # Check if monitor is running
    if [ -f \"monitor.pid\" ]; then
        PID=\$(cat monitor.pid)
        if kill -0 \$PID 2>/dev/null; then
            echo \"✅ Monitor is running (PID: \$PID)\"
            
            # Test health endpoint
            if curl -s http://localhost:9093/sanity > /dev/null; then
                echo \"✅ Health check passed\"
                exit 0  # Success
            else
                echo \"⚠️  Health check failed (monitor may still be starting)\"
                exit 1  # Partial failure
            fi
        else
            echo \"❌ Monitor failed to start\"
            echo \"Check logs: tail -f run_bsl.out\"
            exit 1  # Failure
        fi
    else
        echo \"❌ No PID file created\"
        exit 1  # Failure
    fi
else
    echo \"❌ Failed to copy JAR to deployments directory\"
    exit 1  # Failure
fi
DEPLOY_SCRIPT

    # Make script executable
    chmod +x /tmp/deploy_weblogic.sh
    
    # Try to run as weblogic user using sudo with TTY allocation
    if sudo -t -u $WEBLOGIC_USER /tmp/deploy_weblogic.sh; then
        echo 'WEBLOGIC_DEPLOY_SUCCESS=true'
    else
        echo 'WEBLOGIC_DEPLOY_SUCCESS=false'
        echo '❌ WebLogic user deployment failed'
    fi
    
    # Clean up temp files
    rm -f /tmp/deploy_weblogic.sh
    rm -f $DKTEST_TEMP_DIR/$JAR_NAME
    echo '✅ Temp files cleaned up'
" > /tmp/weblogic_deploy_result.txt

# Check the deployment result
if grep -q "WEBLOGIC_DEPLOY_SUCCESS=true" /tmp/weblogic_deploy_result.txt; then
    WEBLOGIC_DEPLOY_SUCCESS=true
    play_sound "success"
    vocal_status "WebLogic deployment successful"
    echo "✅ WebLogic user deployment successful"
else
    WEBLOGIC_DEPLOY_SUCCESS=false
    play_sound "error"
    vocal_status "WebLogic deployment failed"
    echo "❌ WebLogic user deployment failed"
    echo "Manual deployment required - see complete-deployment-commands.md"
fi

# Clean up result file
rm -f /tmp/weblogic_deploy_result.txt

# Step 6: Final verification
echo ""
vocal_status "Step 6: Final verification"
echo "Step 6: Final verification..."

# Verify deployment
VERIFICATION_SUCCESS=true
ssh "$DKTEST_SERVER" "
    # Check if JAR exists in deployments
    if [ -f '$MONITOR_DEPLOYMENTS/$JAR_NAME' ]; then
        echo '✅ JAR file exists in deployments directory'
    else
        echo '❌ JAR file not found in deployments directory'
        echo 'VERIFICATION_SUCCESS=false'
    fi
    
    # Check if symbolic link exists
    if [ -f '$MONITOR_HOME/monitor.jar' ]; then
        echo '✅ Symbolic link exists'
        echo '   Link points to: \$(readlink $MONITOR_HOME/monitor.jar)'
    else
        echo '❌ Symbolic link not found'
        echo 'VERIFICATION_SUCCESS=false'
    fi
    
    # Check if monitor is running
    if [ -f '$MONITOR_HOME/monitor.pid' ]; then
        PID=\$(cat '$MONITOR_HOME/monitor.pid')
        if kill -0 \$PID 2>/dev/null; then
            echo '✅ Monitor is running (PID: \$PID)'
        else
            echo '❌ Monitor is not running (stale PID file)'
            echo 'VERIFICATION_SUCCESS=false'
        fi
    else
        echo '❌ Monitor is not running (no PID file)'
        echo 'VERIFICATION_SUCCESS=false'
    fi
" > /tmp/verification_result.txt

# Check verification results
if grep -q "VERIFICATION_SUCCESS=false" /tmp/verification_result.txt; then
    VERIFICATION_SUCCESS=false
fi

# Clean up verification result file
rm -f /tmp/verification_result.txt

# Final status report
echo ""
if [ "$WEBLOGIC_DEPLOY_SUCCESS" = true ] && [ "$VERIFICATION_SUCCESS" = true ]; then
    play_sound "complete"
    vocal_status "BSL Monitor-1 deployment completed successfully"
    echo "=== DEPLOYMENT SUCCESS ==="
    echo "✅ Build: $JAR_NAME"
    echo "✅ Upload: $DKTEST_DEPLOY_DIR"
    echo "✅ Deploy: $MONITOR_DEPLOYMENTS"
    echo "✅ Monitor: bsl-monitor-1"
    echo "✅ Port: 9093"
    echo "✅ Process: Running"
    echo ""
    echo "Next Steps:"
    echo "1. Check status: ssh $DKTEST_SERVER 'sudo -u $WEBLOGIC_USER $MONITOR_HOME/status-monitor.sh'"
    echo "2. Check logs: ssh $DKTEST_SERVER 'sudo -u $WEBLOGIC_USER tail -f $MONITOR_HOME/run_bsl.out'"
    echo "3. Health check: ssh $DKTEST_SERVER 'curl http://localhost:9093/sanity'"
    echo ""
    echo "Management commands (as weblogic user):"
    echo "- Start: ./start-monitor.sh"
    echo "- Stop: ./stop-monitor.sh"
    echo "- Status: ./status-monitor.sh"
    echo "- Restart: ./restart-monitor.sh"
    echo "- Deploy: ./deploy.sh [JAR_NAME]"
else
    play_sound "error"
    vocal_status "BSL Monitor-1 deployment failed"
    echo "=== DEPLOYMENT FAILED ==="
    echo "❌ Build: $JAR_NAME (successful)"
    echo "❌ Upload: $DKTEST_DEPLOY_DIR (successful)"
    echo "❌ Deploy: $MONITOR_DEPLOYMENTS (failed)"
    echo "❌ Monitor: bsl-monitor-1 (not running)"
    echo "❌ Port: 9093 (not accessible)"
    echo "❌ Process: Not running"
    echo ""
    echo "Manual deployment required:"
    echo "1. SSH to server: ssh $DKTEST_SERVER"
    echo "2. Switch to weblogic: sudo -iu weblogic"
    echo "3. Follow manual steps in: complete-deployment-commands.md"
    echo ""
    echo "JAR file location: $DKTEST_DEPLOY_DIR/$JAR_NAME"
    echo "Temp location: /tmp/$JAR_NAME"
    exit 1
fi
