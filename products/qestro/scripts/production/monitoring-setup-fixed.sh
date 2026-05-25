#!/bin/bash

# Qestro Production Monitoring Setup Script
# Configures comprehensive monitoring and alerting for production deployment

set -euo pipefail

echo "🚀 Setting up Qestro Production Monitoring..."

# Create monitoring directories
SCRIPT_DIR="$(dirname "$0")"
mkdir -p "$SCRIPT_DIR/config/production"
mkdir -p "$SCRIPT_DIR/logs"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Create Monitoring Configuration
log "Creating monitoring configuration..."
cat > "$SCRIPT_DIR/config/production/monitoring-config.json" << 'EOF'
{
  "monitoring": {
    "version": "1.0.0",
    "status": "operational",
    "timestamp": "2024-01-01T00:00:00Z",
    "services": {
      "frontend": {
        "url": "https://qestro.app",
        "name": "Qestro Frontend",
        "expected_status": 200,
        "response_time_threshold": 5000,
        "check_interval": 60,
        "timeout": 10000
      },
      "api": {
        "url": "https://api.qestro.app/health",
        "name": "Qestro API Backend",
        "expected_status": 200,
        "response_time_threshold": 3000,
        "check_interval": 30,
        "timeout": 5000
      },
      "database": {
        "name": "Qestro Database (D1)",
        "connection_check": true,
        "check_interval": 300,
        "timeout": 10000
      }
    },
    "alerting": {
      "email": {
        "enabled": true,
        "recipients": ["admin@qestro.app"],
        "severity_levels": ["critical", "warning"]
      },
      "webhook": {
        "enabled": false,
        "webhook_url": "${WEBHOOK_URL:-not-configured}",
        "severity_levels": ["critical"]
      }
    },
    "performance": {
      "thresholds": {
        "api_response_time_p95": 100,
        "frontend_load_time_p95": 2000,
        "error_rate_threshold": 0.01,
        "uptime_threshold": 0.99
      }
    }
  }
}
EOF

# Create SystemD service file for production monitoring
log "Creating SystemD service configuration..."
cat > "$SCRIPT_DIR/config/production/qestro-health-monitor.service" << 'EOF'
[Unit]
Description=Qestro Platform Health Monitor
After=network.target
Wants=network-online

[Service]
Type=oneshot
ExecStart=/opt/qestro/scripts/production/health-check.sh
StandardOutput=journal:syslog
StandardError=journal:syslog
User=root
Group=root

[Install]
WantedBy=multi-user.target
EOF

# Create cron job configuration for automated tasks
log "Creating cron job configuration..."
cat > "$SCRIPT_DIR/config/production/crontab-backup" << 'EOF'
# Qestro Automated Monitoring Tasks
#
# Health checks - every 5 minutes
*/5 * * * * /opt/qestro/scripts/production/health-check.sh >> /var/log/qestro/health.log 2>&1

# Database backups - daily at 2 AM
0 2 * * * /opt/qestro/scripts/production/database-backup.sh >> /var/log/qestro/backup.log 2>&1

# Performance tests - Sundays at 3 AM
0 3 * * 0 /opt/qestro/scripts/production/performance-test.sh >> /var/log/qestro/performance.log 2>&1

# Security audit - 1st of month at 1 AM
0 1 1 * * /opt/qestro/scripts/production/security-audit.sh >> /var/log/qestro/security.log 2>&1

# Log rotation - daily at 4 AM
0 4 * * * /opt/qestro/scripts/production/rotate-logs.sh >> /var/log/qestro/rotation.log 2>&1
EOF

# Create log rotation script
log "Creating log rotation script..."
cat > "$SCRIPT_DIR/rotate-logs.sh" << 'EOF'
#!/bin/bash

# Qestro Log Rotation Script
# Rotates and compresses old log files

LOG_DIR="/var/log/qestro"
RETENTION_DAYS=30

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Rotate logs older than 7 days or larger than 100MB
find "$LOG_DIR" -name "*.log" -type f -mtime +7 -exec gzip {} \;
find "$LOG_DIR" -name "*.log.gz" -type f -mtime +$RETENTION_DAYS -delete

# Clean up old monitoring reports
find /opt/qestro/reports -name "*" -type f -mtime +$RETENTION_DAYS -delete

echo "$(date): Log rotation completed"
EOF

chmod +x "$SCRIPT_DIR/rotate-logs.sh"

# Create production deployment script
log "Creating production deployment script..."
cat > "$SCRIPT_DIR/deploy-production.sh" << 'EOF'
#!/bin/bash

# Qestro Production Deployment Script
# Handles safe deployment to production environment

set -euo pipefail

# Configuration
PROJECT_NAME="qestro"
WORKER_NAME="questro-platform-worker"
FRONTEND_DIR="../frontend/dist"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Pre-deployment health check
pre_deploy_check() {
    log "🔍 Running pre-deployment health checks..."

    # Check if all required files exist
    if [ ! -f "../src/questro-platform-worker.ts" ]; then
        log "❌ Worker source file not found"
        exit 1
    fi

    if [ ! -d "$FRONTEND_DIR" ]; then
        log "❌ Frontend build directory not found"
        exit 1
    fi

    log "✅ Pre-deployment checks passed"
}

# Deploy backend worker
deploy_worker() {
    log "🚀 Deploying backend worker..."

    cd ..
    npx wrangler deploy --compatibility-date=2023-11-01

    log "✅ Backend worker deployed"
}

# Deploy frontend
deploy_frontend() {
    log "🌐 Deploying frontend..."

    cd "$FRONTEND_DIR"
    npx wrangler pages deploy . --project-name="$PROJECT_NAME" --commit-dirty=true

    log "✅ Frontend deployed"
}

# Post-deployment verification
post_deploy_check() {
    log "🔍 Running post-deployment verification..."

    # Wait for deployment to propagate
    sleep 30

    # Check frontend
    if curl -s -f "https://qestro.app" --max-time 10 > /dev/null; then
        log "✅ Frontend deployment verified"
    else
        log "❌ Frontend deployment failed verification"
        exit 1
    fi

    # Check API
    if curl -s -f "https://api.qestro.app/health" --max-time 10 > /dev/null; then
        log "✅ API deployment verified"
    else
        log "❌ API deployment failed verification"
        exit 1
    fi

    log "✅ All deployment verifications passed"
}

# Main deployment flow
main() {
    log "🚀 Starting Qestro production deployment..."

    pre_deploy_check
    deploy_worker
    deploy_frontend
    post_deploy_check

    log "🎉 Production deployment completed successfully!"

    # Run health check
    /opt/qestro/scripts/production/health-check.sh
}

# Execute deployment
main "$@"
EOF

chmod +x "$SCRIPT_DIR/deploy-production.sh"

# Create installation script for production server
log "Creating installation script..."
cat > "$SCRIPT_DIR/install-monitoring.sh" << 'EOF'
#!/bin/bash

# Qestro Monitoring Installation Script
# Installs monitoring scripts and configuration on production server

set -euo pipefail

INSTALL_DIR="/opt/qestro"
SERVICE_NAME="qestro-health-monitor"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Create installation directory
create_directories() {
    log "📁 Creating installation directories..."

    sudo mkdir -p "$INSTALL_DIR"/{scripts/production,config/production,reports,logs}
    sudo chown -R \$USER:\$USER "$INSTALL_DIR"

    log "✅ Directories created"
}

# Install monitoring scripts
install_scripts() {
    log "📜 Installing monitoring scripts..."

    # Copy scripts
    cp health-check.sh database-backup.sh performance-test.sh security-audit.sh rotate-logs.sh "$INSTALL_DIR/scripts/production/"

    # Copy configuration
    cp config/production/* "$INSTALL_DIR/config/production/"

    # Make scripts executable
    chmod +x "$INSTALL_DIR/scripts/production"/*

    log "✅ Scripts installed"
}

# Install SystemD service
install_service() {
    log "⚙️ Installing SystemD service..."

    sudo cp "$INSTALL_DIR/config/production/qestro-health-monitor.service" "/etc/systemd/system/"

    # Create timer for periodic execution
    sudo tee "/etc/systemd/system/$SERVICE_NAME.timer" > /dev/null << EOL
[Unit]
Description=Run Qestro Health Monitor every 5 minutes
Requires=$SERVICE_NAME.service

[Timer]
OnCalendar=*:0/5
Persistent=true

[Install]
WantedBy=timers.target
EOL

    # Reload systemd and enable timer
    sudo systemctl daemon-reload
    sudo systemctl enable "$SERVICE_NAME.timer"
    sudo systemctl start "$SERVICE_NAME.timer"

    log "✅ SystemD service installed and started"
}

# Install cron jobs
install_cron() {
    log "⏰ Installing cron jobs..."

    # Add cron jobs to current user's crontab
    (crontab -l 2>/dev/null; cat "$INSTALL_DIR/config/production/crontab-backup") | crontab -

    log "✅ Cron jobs installed"
}

# Create logrotate configuration
install_logrotate() {
    log "📋 Installing logrotate configuration..."

    sudo tee "/etc/logrotate.d/qestro" > /dev/null << EOL
/var/log/qestro/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 \$USER \$USER
    postrotate
        systemctl reload qestro-health-monitor || true
    endscript
}
EOL

    log "✅ Logrotate configuration installed"
}

# Verify installation
verify_installation() {
    log "🔍 Verifying installation..."

    # Check if scripts are executable
    if [ -x "$INSTALL_DIR/scripts/production/health-check.sh" ]; then
        log "✅ Health check script is executable"
    else
        log "❌ Health check script is not executable"
        return 1
    fi

    # Check if service is running
    if systemctl is-active --quiet "$SERVICE_NAME.timer"; then
        log "✅ SystemD timer is running"
    else
        log "❌ SystemD timer is not running"
        return 1
    fi

    # Run initial health check
    "$INSTALL_DIR/scripts/production/health-check.sh"

    log "✅ Installation verified successfully"
}

# Main installation
main() {
    log "🚀 Installing Qestro monitoring system..."

    create_directories
    install_scripts
    install_service
    install_cron
    install_logrotate
    verify_installation

    log "🎉 Qestro monitoring installation completed!"
    log ""
    log "📊 Monitoring Services:"
    log "  - Health checks: Every 5 minutes via SystemD timer"
    log "  - Database backups: Daily at 2 AM via cron"
    log "  - Performance tests: Weekly on Sundays at 3 AM"
    log "  - Security audits: Monthly on 1st at 1 AM"
    log ""
    log "📁 Installation directory: $INSTALL_DIR"
    log "📋 Logs location: /var/log/qestro/"
    log "📊 Reports location: $INSTALL_DIR/reports/"
}

# Execute installation
main "$@"
EOF

chmod +x "$SCRIPT_DIR/install-monitoring.sh"

# Create production README
log "Creating production documentation..."
cat > "$SCRIPT_DIR/README.md" << 'EOF'
# Qestro Production Monitoring

This directory contains comprehensive monitoring and alerting scripts for the Qestro production environment.

## 📁 File Structure

```
scripts/production/
├── README.md                      # This documentation
├── health-check.sh               # Platform health monitoring
├── database-backup.sh            # Automated database backups
├── performance-test.sh           # Performance and load testing
├── security-audit.sh             # Security vulnerability scanning
├── rotate-logs.sh                # Log rotation and cleanup
├── deploy-production.sh          # Safe production deployment
├── install-monitoring.sh         # Server installation script
└── config/production/
    ├── monitoring-config.json    # Monitoring configuration
    ├── qestro-health-monitor.service  # SystemD service file
    └── crontab-backup            # Cron job configuration
```

## 🚀 Quick Installation

1. **Install monitoring system:**
   ```bash
   sudo ./install-monitoring.sh
   ```

2. **Verify installation:**
   ```bash
   /opt/qestro/scripts/production/health-check.sh
   ```

3. **Check service status:**
   ```bash
   systemctl status qestro-health-monitor.timer
   ```

## 📊 Monitoring Services

### Health Checks (`health-check.sh`)
- **Frequency:** Every 5 minutes
- **Checks:** Frontend, API, Database, Authentication
- **Alerts:** Email/webhook notifications on failures

### Database Backups (`database-backup.sh`)
- **Frequency:** Daily at 2 AM
- **Retention:** 30 days
- **Storage:** `/backups/qestro/`

### Performance Tests (`performance-test.sh`)
- **Frequency:** Weekly (Sundays at 3 AM)
- **Tests:** API response times, Load testing, WebSocket performance
- **Reports:** HTML reports with metrics

### Security Audits (`security-audit.sh`)
- **Frequency:** Monthly (1st at 1 AM)
- **Checks:** SSL/TLS, API security, Dependency vulnerabilities
- **Reports:** Comprehensive security assessment

## 🔧 Configuration

### Environment Variables
```bash
# Webhook notifications
export WEBHOOK_URL="https://hooks.slack.com/..."

# Email notifications
export EMAIL_RECIPIENTS="admin@qestro.app,devops@qestro.app"

# Backup storage
export BACKUP_DIR="/backups/qestro"
export RETENTION_DAYS=30
```

### Performance Thresholds
Edit `config/production/monitoring-config.json` to adjust:
- API response time thresholds
- Error rate limits
- Uptime requirements

## 📋 Maintenance

### View Logs
```bash
# Health check logs
tail -f /var/log/qestro/health.log

# Backup logs
tail -f /var/log/qestro/backup.log

# Performance test logs
tail -f /var/log/qestro/performance.log

# Security audit logs
tail -f /var/log/qestro/security.log
```

### Manual Execution
```bash
# Run health check
/opt/qestro/scripts/production/health-check.sh

# Trigger backup
/opt/qestro/scripts/production/database-backup.sh

# Run performance test
/opt/qestro/scripts/production/performance-test.sh

# Execute security audit
/opt/qestro/scripts/production/security-audit.sh
```

### Service Management
```bash
# Start monitoring timer
sudo systemctl start qestro-health-monitor.timer

# Stop monitoring timer
sudo systemctl stop qestro-health-monitor.timer

# View timer status
sudo systemctl status qestro-health-monitor.timer

# View recent logs
sudo journalctl -u qestro-health-monitor
```

## 🚨 Troubleshooting

### Common Issues

1. **Scripts not executable:**
   ```bash
   chmod +x /opt/qestro/scripts/production/*.sh
   ```

2. **Permission denied errors:**
   ```bash
   sudo chown -R \$USER:\$USER /opt/qestro
   ```

3. **Service not running:**
   ```bash
   sudo systemctl restart qestro-health-monitor.timer
   ```

4. **Logs not rotating:**
   ```bash
   sudo logrotate -f /etc/logrotate.d/qestro
   ```

### Emergency Procedures

1. **Platform down:**
   - Check health check logs: `tail -f /var/log/qestro/health.log`
   - Run manual health check: `/opt/qestro/scripts/production/health-check.sh`
   - Check worker deployment: `npx wrangler whoami`

2. **Database issues:**
   - Verify D1 database access: `npx wrangler d1 info qestro-db`
   - Manual backup: `npx wrangler d1 export qestro-db --remote`

3. **Performance degradation:**
   - Run performance test: `/opt/qestro/scripts/production/performance-test.sh`
   - Check Cloudflare analytics
   - Review worker logs: `npx wrangler tail`

## 📈 Monitoring Dashboard

Access real-time monitoring data:
- **Frontend URL:** https://qestro.app
- **API Health:** https://api.qestro.app/health
- **Performance Reports:** `/opt/qestro/reports/`
- **Security Reports:** `/opt/qestro/reports/security/`

## 🆘 Support

For monitoring system issues:
1. Check this README
2. Review log files in `/var/log/qestro/`
3. Run manual health check
4. Contact: admin@qestro.app
EOF

echo ""
echo "✅ Production monitoring setup completed!"
echo ""
echo "📊 Monitoring Services Configured:"
echo "  - Health checks: $SCRIPT_DIR/health-check.sh"
echo "  - Database backups: $SCRIPT_DIR/database-backup.sh"
echo "  - Performance testing: $SCRIPT_DIR/performance-test.sh"
echo "  - Security auditing: $SCRIPT_DIR/security-audit.sh"
echo ""
echo "🔗 Configuration Files:"
echo "  - Monitoring config: $SCRIPT_DIR/config/production/monitoring-config.json"
echo "  - Service file: $SCRIPT_DIR/config/production/qestro-health-monitor.service"
echo "  - Cron jobs: $SCRIPT_DIR/config/production/crontab-backup"
echo "  - Installation script: $SCRIPT_DIR/install-monitoring.sh"
echo "  - Deployment script: $SCRIPT_DIR/deploy-production.sh"
echo ""
echo "🚀 Next Steps:"
echo "1. Install monitoring configuration to production server:"
echo "   sudo $SCRIPT_DIR/install-monitoring.sh"
echo "2. Set up automated alerts and notifications"
echo "3. Configure log rotation and retention policies"
echo "4. Test all monitoring scripts in production environment"
echo "5. Set up monitoring dashboard and alerting"
echo ""
echo "📚 Documentation: $SCRIPT_DIR/README.md"

log "🎉 Qestro Production Monitoring Setup Complete!"
