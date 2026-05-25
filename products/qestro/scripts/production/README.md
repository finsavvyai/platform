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
