# Billpro Service Monitor - Deployment Modes

## Overview

The Billpro Service Monitor now supports multiple deployment modes to help with testing and debugging while avoiding production alerts.

## Available Deployment Modes

### 1. Production Mode (Default)
- **Purpose**: Full production monitoring with all services
- **Alert Labels**: "Billpro Service Monitor alert"
- **Email Recipients**: Production support team
- **Configuration**: `application-prod.yaml`

### 2. Test Mode
- **Purpose**: Testing and debugging with reduced monitoring
- **Alert Labels**: "Billpro Service Monitor TEST alert"
- **Email Recipients**: Development team only
- **Configuration**: `application-test.yaml`

## Deployment Scripts

### Production Deployment
```bash
# First time setup
./first-time-deploy.sh

# Continuous deployment
./quick-deploy.sh

# Manual start (production mode)
./start-monitor.sh [JAR_NAME] prod
```

### Test Deployment
```bash
# Test deployment (build, upload, start in test mode)
./test-deploy.sh

# Manual start (test mode)
./start-monitor.sh [JAR_NAME] test
```

## Test Mode Features

### Alert Configuration
- **Subject**: "Billpro Service Monitor TEST alert"
- **From**: "Billpro Service Monitor TEST"
- **Recipients**: 
  - `shacharsol@gmail.com`
  - `shahar.solomon@billpro-software.com`
- **Environment**: TEST

### Reduced Monitoring
- **Services**: Only essential services (generic_prod1, mdwc_prod1, teddk_prod)
- **Database**: Same as production (for testing connectivity)
- **Timeouts**: Same as production
- **Scheduling**: Same as production

### Process Identification
- **Process Name**: `bsl-monitor-test`
- **Log File**: `run_bsl_test.out`
- **PID File**: `monitor.pid`

## Usage Examples

### Start in Test Mode
```bash
# Deploy and start in test mode
./test-deploy.sh

# Or manually start existing JAR in test mode
./start-monitor.sh bsl-monitor-1.0.0-20250828_120000.jar test
```

### Switch Between Modes
```bash
# Stop current monitor
./stop-monitor.sh

# Start in test mode
./start-monitor.sh [JAR_NAME] test

# Start in production mode
./start-monitor.sh [JAR_NAME] prod
```

### Check Status
```bash
# Check which mode is running
./status-monitor.sh

# Check test logs
tail -f run_bsl_test.out

# Check production logs
tail -f run_bsl.out
```

## Configuration Files

### Production Configuration (`application-prod.yaml`)
- Full service monitoring
- Production email recipients
- Production alert labels

### Test Configuration (`application-test.yaml`)
- Reduced service monitoring
- Test email recipients
- Test alert labels
- Same database connections (for testing)

## Benefits

1. **Safe Testing**: Test changes without sending production alerts
2. **Debugging**: Isolate issues without affecting production monitoring
3. **Development**: Work on new features with test alerts
4. **Validation**: Test configuration changes before production deployment

## Best Practices

1. **Use Test Mode** for:
   - Initial deployment testing
   - Configuration changes
   - New feature development
   - Debugging connectivity issues

2. **Use Production Mode** for:
   - Stable, tested configurations
   - Production monitoring
   - Live service monitoring

3. **Always Test First**:
   - Deploy in test mode first
   - Verify functionality
   - Check logs and alerts
   - Then deploy to production

## Troubleshooting

### Check Current Mode
```bash
# Check process name
ps aux | grep bsl-monitor

# Check logs
ls -la run_bsl*.out

# Check configuration
grep "spring.profiles.active" /proc/[PID]/cmdline
```

### Switch Modes
```bash
# Stop current monitor
./stop-monitor.sh

# Start in desired mode
./start-monitor.sh [JAR_NAME] [prod|test]
```

### Verify Configuration
```bash
# Check which profile is active
curl -s http://localhost:9098/sanity | grep -i "test\|prod"
```















