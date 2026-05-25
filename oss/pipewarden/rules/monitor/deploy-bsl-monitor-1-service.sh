#!/bin/bash

# BSL Monitor-1 Service Deployment Script
# This script creates a deployment service to avoid sudo issues

set -e

# Configuration
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BUILD_VERSION="1.0.0"
JAR_NAME="bsl-monitor-${BUILD_VERSION}-${TIMESTAMP}.jar"
DKTEST_SERVER="dktest"
DKTEST_DEPLOY_DIR="/home/scq9102@tcad.telia.se/bsl-monitor-1-deploy"
WEBLOGIC_USER="weblogic"
MONITOR_HOME="/home/weblogic/bsl-monitor-1"
MONITOR_DEPLOYMENTS="/home/weblogic/bsl-monitor-1/deployments"

echo "=== BSL Monitor-1 Service Deployment ==="
echo "JAR Name: $JAR_NAME"
echo ""

# Step 1: Build
echo "Building application..."
./gradlew clean bootJar -x test
echo "✅ Build completed"

# Step 2: Upload
echo "Uploading to server..."
scp build/libs/monitor-1.0.0-SNAPSHOT.jar "$DKTEST_SERVER:$DKTEST_DEPLOY_DIR/$JAR_NAME"
echo "✅ Upload completed"

# Step 3: Create deployment service
echo "Creating deployment service..."
ssh "$DKTEST_SERVER" "
    # Copy JAR to accessible location
    cp $DKTEST_DEPLOY_DIR/$JAR_NAME /tmp/
    chmod 644 /tmp/$JAR_NAME
    
    # Create a deployment service script
    cat > /tmp/bsl-deploy-service.sh << 'EOF'
#!/bin/bash
# BSL Monitor Deployment Service
# This script runs as weblogic user and handles deployments

JAR_NAME=\"$JAR_NAME\"
MONITOR_HOME=\"$MONITOR_HOME\"
MONITOR_DEPLOYMENTS=\"$MONITOR_DEPLOYMENTS\"

echo \"Starting deployment service...\"

# Source environment
cd /home/weblogic
source .test_env

# Create deployments directory
mkdir -p \$MONITOR_DEPLOYMENTS

# Copy JAR
cp /tmp/\$JAR_NAME \$MONITOR_DEPLOYMENTS/

# Navigate to monitor home
cd \$MONITOR_HOME

# Stop existing monitor
if [ -f monitor.pid ]; then
    PID=\$(cat monitor.pid)
    if kill -0 \$PID 2>/dev/null; then
        echo \"Stopping existing monitor...\"
        kill \$PID
        sleep 3
        rm -f monitor.pid
    fi
fi

# Create symbolic link
ln -sf deployments/\$JAR_NAME monitor.jar

# Start monitor
nohup java -Dspring.application.name=bsl-monitor-1 -jar deployments/\$JAR_NAME --spring.profiles.active=prod > run_bsl.out 2>&1 &
echo \$! > monitor.pid

echo \"✅ Monitor started with PID: \$(cat monitor.pid)\"

# Clean up
rm -f /tmp/\$JAR_NAME
EOF
    
    chmod +x /tmp/bsl-deploy-service.sh
    
    # Create a trigger file that weblogic can monitor
    echo \"$JAR_NAME\" > /tmp/bsl-deploy-trigger.txt
    chmod 666 /tmp/bsl-deploy-trigger.txt
    
    # Signal weblogic to run the deployment
    # This requires weblogic to have a monitoring script running
    echo \"Deployment trigger created. WebLogic user should run: /tmp/bsl-deploy-service.sh\"
"

echo "✅ Deployment service created"
echo "WebLogic user should run: /tmp/bsl-deploy-service.sh"
echo "Or set up a monitoring script to automatically detect the trigger file"
