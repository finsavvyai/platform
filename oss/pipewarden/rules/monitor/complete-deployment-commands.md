# Complete Deployment Commands (No Sudo TTY Issues)

## Current Status
✅ **JAR Built**: `bsl-monitor-1.0.0-20250908_144027.jar`  
✅ **JAR Uploaded**: `/home/scq9102@tcad.telia.se/bsl-monitor-1-deploy/`  
✅ **JAR in Temp**: `/tmp/bsl-deployments/bsl-monitor-1.0.0-20250908_144027.jar`  
❌ **WebLogic Deploy**: Failed due to sudo TTY restriction  

## Manual Deployment Steps

### Step 1: Copy JAR to weblogic accessible location
```bash
ssh dktest
# Copy JAR from temp to a location weblogic can access
cp /tmp/bsl-deployments/bsl-monitor-1.0.0-20250908_144027.jar /home/scq9102@tcad.telia.se/bsl-monitor-1-deploy/
```

### Step 2: Manual weblogic deployment
```bash
# SSH to dktest and switch to weblogic user manually
ssh dktest
sudo -iu weblogic
# Enter password: Daniel0304##

# Source test environment
cd /home/weblogic
source .test_env

# Create deployments directory
mkdir -p /home/weblogic/bsl-monitor-1/deployments

# Copy JAR from scq9102 directory
cp /home/scq9102@tcad.telia.se/bsl-monitor-1-deploy/bsl-monitor-1.0.0-20250908_144027.jar /home/weblogic/bsl-monitor-1/deployments/

# Navigate to monitor home
cd /home/weblogic/bsl-monitor-1

# Stop existing monitor if running
if [ -f "monitor.pid" ]; then
    PID=$(cat monitor.pid)
    if kill -0 $PID 2>/dev/null; then
        echo "Stopping existing monitor (PID: $PID)..."
        kill $PID
        sleep 3
        rm -f monitor.pid
    fi
fi

# Create symbolic link to new JAR
ln -sf deployments/bsl-monitor-1.0.0-20250908_144027.jar monitor.jar

# Start the monitor
nohup java -Dspring.application.name=bsl-monitor-1 \
  -jar deployments/bsl-monitor-1.0.0-20250908_144027.jar \
  --spring.profiles.active=prod \
  > run_bsl.out 2>&1 &

echo $! > monitor.pid
echo "✅ BSL Monitor-1 started with PID: $(cat monitor.pid)"

# Check status
sleep 5
if [ -f "monitor.pid" ]; then
    PID=$(cat monitor.pid)
    if kill -0 $PID 2>/dev/null; then
        echo "✅ Monitor is running (PID: $PID)"
        
        # Test health endpoint
        if curl -s http://localhost:9093/sanity > /dev/null; then
            echo "✅ Health check passed"
        else
            echo "⚠️  Health check failed (monitor may still be starting)"
        fi
    else
        echo "❌ Monitor failed to start"
        echo "Check logs: tail -f run_bsl.out"
    fi
fi
```

### Step 3: Verify deployment
```bash
# Check if everything is in place
ls -la /home/weblogic/bsl-monitor-1/
ls -la /home/weblogic/bsl-monitor-1/deployments/

# Check if monitor is running
ps aux | grep bsl-monitor-1

# Check port
lsof -i :9093

# Test health endpoint
curl http://localhost:9093/sanity
```

### Step 4: Monitor logs
```bash
# Watch logs in real-time
tail -f /home/weblogic/bsl-monitor-1/run_bsl.out
```

## Alternative: Create a deployment script for weblogic user

Create this script as weblogic user:

```bash
# Create deployment script
cat > /home/weblogic/deploy-new-version.sh << 'EOF'
#!/bin/bash

JAR_NAME="bsl-monitor-1.0.0-20250908_144027.jar"
SOURCE_DIR="/home/scq9102@tcad.telia.se/bsl-monitor-1-deploy"
TARGET_DIR="/home/weblogic/bsl-monitor-1/deployments"
MONITOR_HOME="/home/weblogic/bsl-monitor-1"

echo "Deploying $JAR_NAME..."

# Source environment
cd /home/weblogic
source .test_env

# Create deployments directory
mkdir -p $TARGET_DIR

# Copy JAR
cp $SOURCE_DIR/$JAR_NAME $TARGET_DIR/

# Navigate to monitor home
cd $MONITOR_HOME

# Stop existing monitor
if [ -f "monitor.pid" ]; then
    PID=$(cat monitor.pid)
    if kill -0 $PID 2>/dev/null; then
        echo "Stopping existing monitor..."
        kill $PID
        sleep 3
        rm -f monitor.pid
    fi
fi

# Create symbolic link
ln -sf deployments/$JAR_NAME monitor.jar

# Start monitor
nohup java -Dspring.application.name=bsl-monitor-1 \
  -jar deployments/$JAR_NAME \
  --spring.profiles.active=prod \
  > run_bsl.out 2>&1 &

echo $! > monitor.pid
echo "✅ Monitor started with PID: $(cat monitor.pid)"

# Check status
sleep 5
if kill -0 $(cat monitor.pid) 2>/dev/null; then
    echo "✅ Monitor is running"
    curl -s http://localhost:9093/sanity && echo "✅ Health check passed" || echo "⚠️  Health check failed"
else
    echo "❌ Monitor failed to start"
fi
EOF

chmod +x /home/weblogic/deploy-new-version.sh
```

Then run:
```bash
/home/weblogic/deploy-new-version.sh
```

## Summary

The automated deployment script worked perfectly for:
- ✅ Building the JAR
- ✅ Uploading to scq9102 directory  
- ✅ Copying to temp directory

The only issue was the sudo TTY restriction for the weblogic user deployment. The manual steps above will complete the deployment successfully.

**Next JAR Name**: `bsl-monitor-1.0.0-20250908_144027.jar`

