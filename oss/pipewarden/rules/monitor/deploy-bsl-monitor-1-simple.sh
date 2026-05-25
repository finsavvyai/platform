#!/bin/bash

# BSL Monitor-1 Simple Deployment Script
# This script uses a different approach to avoid sudo TTY issues

set -e

# Configuration
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BUILD_VERSION="1.0.0"
JAR_NAME="bsl-monitor-${BUILD_VERSION}-${TIMESTAMP}.jar"
DKTEST_SERVER="dktest"
DKTEST_DEPLOY_DIR="/home/scq9102@tcad.telia.se/bsl-monitor-1-deploy"
WEBLOGIC_USER="weblogic"
WEBLOGIC_PASSWORD="Daniel0304##"
MONITOR_HOME="/home/weblogic/bsl-monitor-1"
MONITOR_DEPLOYMENTS="/home/weblogic/bsl-monitor-1/deployments"

echo "=== BSL Monitor-1 Simple Deployment ==="
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

# Step 3: Deploy using expect to handle password
echo "Deploying as weblogic user..."
ssh "$DKTEST_SERVER" "
    # Copy JAR to accessible location
    cp $DKTEST_DEPLOY_DIR/$JAR_NAME /tmp/
    chmod 644 /tmp/$JAR_NAME
    
    # Create deployment commands
    cat > /tmp/deploy_commands.sh << 'EOF'
#!/bin/bash
cd /home/weblogic
source .test_env
mkdir -p $MONITOR_DEPLOYMENTS
cp /tmp/$JAR_NAME $MONITOR_DEPLOYMENTS/
cd $MONITOR_HOME
if [ -f monitor.pid ]; then
    PID=\$(cat monitor.pid)
    if kill -0 \$PID 2>/dev/null; then
        kill \$PID
        sleep 3
        rm -f monitor.pid
    fi
fi
ln -sf deployments/$JAR_NAME monitor.jar
nohup java -Dspring.application.name=bsl-monitor-1 -jar deployments/$JAR_NAME --spring.profiles.active=prod > run_bsl.out 2>&1 &
echo \$! > monitor.pid
echo \"✅ Monitor started with PID: \$(cat monitor.pid)\"
EOF
    
    chmod +x /tmp/deploy_commands.sh
    
    # Use expect to handle sudo password
    expect << 'EXPECT_SCRIPT'
set timeout 30
spawn sudo -u weblogic /tmp/deploy_commands.sh
expect "password for weblogic:"
send "Daniel0304##\r"
expect eof
EXPECT_SCRIPT
    
    # Clean up
    rm -f /tmp/deploy_commands.sh /tmp/$JAR_NAME
"

echo "✅ Deployment completed"
echo "Check status: ssh $DKTEST_SERVER 'sudo -u $WEBLOGIC_USER $MONITOR_HOME/status-monitor.sh'"

