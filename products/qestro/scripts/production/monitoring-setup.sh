#!/bin/bash

# Qestro Production Monitoring Setup Script
# Configures comprehensive monitoring and alerting for production deployment

echo "🚀 Setting up Qestro Production Monitoring..."

# Create monitoring configuration directory
mkdir -p "$(dirname "$0")/config/production"

# Monitoring Configuration
cat > "$(dirname "$0")/config/production/monitoring-config.json" << 'EOF'
{
  "monitoring": {
    "version": "1.0.0",
    "status": "operational",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
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
        "url": "https://qestro.broad-dew-49ad.workers.dev/health",
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
      "slack": {
        "enabled": false,
        "webhook_url": "${SLACK_WEBHOOK_URL:-not-configured}",
        "severity_levels": ["critical", "warning"]
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

# Health Check Script
cat > "$(dirname "$0")/scripts/production/health-check.sh" << 'EOF'
#!/bin/bash

# Qestro Production Health Check Script
# Monitors all platform services and reports status

FRONTEND_URL="https://qestro.app"
API_URL="https://qestro.broad-dew-49ad.workers.dev/health"
LOG_FILE="/var/log/qestro/health-check.log"

echo "$(date): Starting Qestro health check..." >> "$LOG_FILE"

# Check Frontend
echo "Checking frontend availability..."
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL")
if [ "$FRONTEND_STATUS" = "200" ]; then
    echo "✅ Frontend: HEALTHY (Status $FRONTEND_STATUS)"
else
    echo "❌ Frontend: UNHEALTHY (Status $FRONTEND_STATUS)"
fi

# Check API Backend
echo "Checking API backend availability..."
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL")
if [ "$API_STATUS" = "200" ]; then
    echo "✅ API: HEALTHY (Status $API_STATUS)"
else
    echo "❌ API: UNHEALTHY (Status $API_STATUS)"
fi

# Database Connectivity Check
echo "Checking database connectivity..."
DB_STATUS=$(npx wrangler d1 execute upm-plus-config --remote --command="SELECT COUNT(*) as user_count FROM users" 2>/dev/null | grep -o '[0-9]\+' | head -1)
if [ "$DB_STATUS" -gt "0" ]; then
    echo "✅ Database: CONNECTED ($DB_STATUS users)"
else
    echo "❌ Database: DISCONNECTED or empty"
fi

echo "$(date): Health check completed" >> "$LOG_FILE"
EOF

chmod +x "$(dirname "$0")/scripts/production/health-check.sh"

# Backup Script
cat > "$(dirname "$0")/scripts/production/database-backup.sh" << 'EOF'
#!/bin/bash

# Qestro Database Backup Script
# Creates automated backups of the production database

BACKUP_DIR="/backups/qestro"
DATABASE_NAME="upm-plus-config"
DATE_STAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="qestro_backup_$DATE_STAMP.sql"

echo "Creating database backup: $BACKUP_FILE"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Export database schema and data
npx wrangler d1 export "$DATABASE_NAME" --remote --output "$BACKUP_DIR/$BACKUP_FILE" 2>/dev/null

if [ -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
    echo "✅ Backup created: $BACKUP_DIR/$BACKUP_FILE"
    echo "📊 Backup size: $(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)"
else
    echo "❌ Backup failed"
fi

# Clean up old backups (keep last 7 days)
find "$BACKUP_DIR" -name "*.sql" -mtime +7 -delete 2>/dev/null
echo "🧹 Cleaned up old backups (kept last 7 days)"
EOF

chmod +x "$(dirname "$0")/scripts/production/database-backup.sh"

# Performance Test Script
cat > "$(dirname "$0")/scripts/production/performance-test.sh" << 'EOF'
#!/bin/bash

# Qestro Performance Test Script
# Tests API performance and load handling

API_URL="https://qestro.broad-dew-49ad.workers.dev"
RESULTS_FILE="/var/log/qestro/performance-test.log"

echo "$(date): Starting performance tests..." >> "$RESULTS_FILE"

# Test API response times
echo "Testing API response times..."
for i in {1..10}; do
    START_TIME=$(date +%s%N)
    RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$API_URL/health")
    END_TIME=$(date +%s%N)
    TOTAL_TIME=$((END_TIME - START_TIME))

    echo "Test $i: ${RESPONSE_TIME}s (Total: ${TOTAL_TIME}s)"

    if [ "$TOTAL_TIME" -gt 5 ]; then
        echo "⚠️  Slow response detected: ${TOTAL_TIME}s"
    else
        echo "✅  Fast response: ${TOTAL_TIME}s"
    fi
done

# Concurrent Load Test
echo "Testing concurrent load handling..."
echo "Starting 10 concurrent requests..."
START_TIME=$(date +%s%N)

for i in {1..10}; do
    curl -s "$API_URL/health" > /dev/null &
done

wait
END_TIME=$(date +%s%N)
TOTAL_LOAD_TIME=$((END_TIME - START_TIME))

echo "✅ Load test completed in ${TOTAL_LOAD_TIME}s"
echo "$(date): Performance tests completed" >> "$RESULTS_FILE"
EOF

chmod +x "$(dirname "$0")/scripts/production/performance-test.sh"

# Security Audit Script
cat > "$(dirname "$0")/scripts/production/security-audit.sh" << 'EOF'
#!/bin/bash

# Qestro Security Audit Script
# Performs security checks on the production environment

echo "🔒 Starting Qestro Security Audit..."

# Check SSL Certificate
echo "Checking SSL certificate..."
SSL_INFO=$(curl -s -I https://qestro.app 2>/dev/null | grep -E "(HTTP/2|subject=|issuer=)")
echo "$SSL_INFO"

# Test Security Headers
echo "Checking security headers..."
HEADERS=$(curl -s -I https://qestro.app 2>/dev/null)
echo "$HEADERS" | grep -E "(X-Frame-Options|X-Content-Type-Options|Strict-Transport-Security|Content-Security-Policy)"

# Test Authentication Security
echo "Testing authentication security..."
AUTH_TEST=$(curl -X POST https://qestro.broad-dew-49ad.workers.dev/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrongpassword"} \
  -s 2>/dev/null)

if echo "$AUTH_TEST" | grep -q "Invalid password"; then
    echo "✅ Authentication properly secured"
else
    echo "⚠️  Authentication may have issues"
fi

echo "🔒 Security audit completed"
EOF

chmod +x "$(dirname "$0")/scripts/production/security-audit.sh"

# Create SystemD service files for production monitoring
cat > "$(dirname "$0")/config/production/qestro-health-monitor.service" << 'EOF'
[Unit]
Description=Qestro Platform Health Monitor
After=network.target
Wants=network-online

[Service]
Type=oneshot
ExecStart=/opt/qestro/scripts/production/health-check.sh
StandardOutput=journal:syslog
StandardError=journal:syslog
EOF

# Create cron job for automated backups
cat > "$(dirname "$0")/config/production/crontab-backup" << 'EOF'
# Qestro Automated Database Backups
# Run daily at 2 AM
0 2 * * * /opt/qestro/scripts/production/database-backup.sh >> /var/log/qestro/backup.log

# Weekly performance tests (Sundays at 3 AM)
0 3 * * 0 /opt/qestro/scripts/production/performance-test.sh >> /var/log/qestro/performance.log

# Monthly security audit (1st of month at 1 AM)
0 1 1 * * /opt/qestro/scripts/production/security-audit.sh >> /var/log/qestro/security.log
EOF

echo "✅ Production monitoring setup completed!"
echo ""
echo "📊 Monitoring Services Configured:"
echo "  - Health checks: $(dirname "$0")/scripts/production/health-check.sh"
echo "  - Database backups: $(dirname "$0")/scripts/production/database-backup.sh"
echo "  - Performance testing: $(dirname "$0")/scripts/production/performance-test.sh"
echo "  - Security auditing: $(dirname "$0")/scripts/production/security-audit.sh"
echo ""
echo "🔗 Configuration Files:"
echo "  - Monitoring config: $(dirname "$0")/config/production/monitoring-config.json"
echo "  - Service file: $(dirname "$0")/config/production/qestro-health-monitor.service"
echo "  - Cron jobs: $(dirname "$0")/config/production/crontab-backup"
echo ""
echo "🚀 Next Steps:"
echo "1. Install monitoring configuration to production server"
echo "2. Set up automated alerts and notifications"
echo " 3. Configure log rotation and retention policies"
echo "4. Test all monitoring scripts in production environment"
EOF

chmod +x "$0"
echo "🎉 Qestro Production Monitoring Setup Complete!"
