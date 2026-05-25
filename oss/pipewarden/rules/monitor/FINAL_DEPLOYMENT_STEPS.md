# Final Deployment Steps for weblogic User

## Current Status
✅ **Files Copied**: All scripts and JAR file copied to `/home/weblogic/bsl-monitor-1/`  
✅ **Ready for**: Final deployment and startup  

## Step 1: Create Symbolic Link

As weblogic user, run:
```bash
sudo -iu weblogic
cd /home/weblogic/bsl-monitor-1
ln -sf deployments/bsl-monitor-bsl-monitor-1.0.0-20250908_134106.jar monitor.jar
```

## Step 2: Source Environment (if available)

```bash
# If .prod_env exists, source it
source .test_env
```

## Step 3: Start the Monitor

```bash
./start-monitor.sh
```

## Step 4: Check Status

```bash
./status-monitor.sh
```

## Step 5: Verify Health

```bash
curl http://localhost:9093/sanity
```

## Step 6: Monitor Logs

```bash
tail -f run_bsl.out
```

## Expected Output

### Start Command Output:
```
Starting Billpro Service Monitor (bsl-monitor-1)...
JAR: bsl-monitor-bsl-monitor-1.0.0-20250908_134106.jar
Home: /home/weblogic/bsl-monitor-1
✅ BSL Monitor (bsl-monitor-1) started with PID: [PID_NUMBER]
Process Name: bsl-monitor-1
Port: 9093
Logs: /home/weblogic/bsl-monitor-1/run_bsl.out
PID File: /home/weblogic/bsl-monitor-1/monitor.pid
```

### Status Command Output:
```
=== Billpro Service Monitor Status (bsl-monitor-1) ===
Date: [CURRENT_DATE]

✅ BSL Monitor (bsl-monitor-1) is running (PID: [PID_NUMBER])
Process Name: bsl-monitor-1
Port: 9093
Logs: /home/weblogic/bsl-monitor-1/run_bsl.out
PID File: /home/weblogic/bsl-monitor-1/monitor.pid
✅ Health check passed

=== Available Deployments ===
-rw-rw-r-- 1 weblogic weblogic 50713977 Sep  8 13:41 bsl-monitor-bsl-monitor-1.0.0-20250908_134106.jar

=== Recent Logs ===
[Recent log entries]
```

## Troubleshooting

### If Monitor Fails to Start:
```bash
# Check logs for errors
tail -20 run_bsl.out

# Check if port 9093 is already in use
lsof -i :9093

# Check Java process
ps aux | grep bsl-monitor-1
```

### If Health Check Fails:
```bash
# Wait a moment for startup
sleep 10
curl http://localhost:9093/sanity

# Check if application is still starting
tail -f run_bsl.out
```

## Management Commands

### Stop Monitor:
```bash
./stop-monitor.sh
```

### Restart Monitor:
```bash
./restart-monitor.sh
```

### Deploy New Version:
```bash
./deploy.sh [NEW_JAR_NAME]
```

## Final Directory Structure

```
/home/weblogic/bsl-monitor-1/
├── monitor.jar -> deployments/bsl-monitor-bsl-monitor-1.0.0-20250908_134106.jar
├── start-monitor.sh
├── stop-monitor.sh
├── status-monitor.sh
├── deploy.sh
├── README.md
├── monitor.pid (created when running)
└── run_bsl.out (created when running)

/home/weblogic/bsl-monitor-1/deployments/
└── bsl-monitor-bsl-monitor-1.0.0-20250908_134106.jar
```

## Success Indicators

✅ **Monitor Started**: PID file created  
✅ **Process Running**: `ps aux | grep bsl-monitor-1` shows process  
✅ **Port Listening**: `lsof -i :9093` shows port in use  
✅ **Health Check**: `curl http://localhost:9093/sanity` returns success  
✅ **Logs Active**: `tail -f run_bsl.out` shows application logs  

## Next Steps After Successful Deployment

1. **Test the monitor** by checking various endpoints
2. **Monitor logs** for any errors or warnings
3. **Set up monitoring** for the process
4. **Document the deployment** for future reference

The bsl-monitor-1 should now be running successfully on port 9093!
