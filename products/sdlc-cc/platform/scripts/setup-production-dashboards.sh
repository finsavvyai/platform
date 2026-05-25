#!/bin/bash
# =============================================================================
# SDLC.ai Platform - Production Monitoring Dashboard Setup
# =============================================================================
# Configures all monitoring dashboards and alerting for production
# Run after initial deployment to set up comprehensive monitoring
# =============================================================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DASHBOARDS_DIR="${PROJECT_ROOT}/monitoring/dashboards"
ALERTS_DIR="${PROJECT_ROOT}/monitoring/alerts"
GRAFANA_URL="${GRAFANA_URL:-https://grafana.sdlc.cc}"
DATADOG_URL="${DATADOG_URL:-https://app.datadoghq.com}"
SENTRY_URL="${SENTRY_URL:-https://sentry.sdlc.cc}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create necessary directories
mkdir -p "$DASHBOARDS_DIR"
mkdir -p "$ALERTS_DIR"

# Function to create Grafana dashboard
create_grafana_dashboard() {
    local name="$1"
    local uid="$2"
    local json_file="$3"

    log "Creating Grafana dashboard: $name"

    # Create dashboard JSON
    cat > "$DASHBOARDS_DIR/${json_file}" <<EOF
{
  "dashboard": {
    "id": null,
    "title": "$name",
    "tags": ["sdlc", "production"],
    "timezone": "browser",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{endpoint}}"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}
      },
      {
        "title": "Error Rate",
        "type": "singlestat",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m]) / rate(http_requests_total[5m]) * 100",
            "legendFormat": "Error Rate %"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0}
      },
      {
        "title": "Response Time (95th percentile)",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "P95 Response Time"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 8}
      },
      {
        "title": "Active Users",
        "type": "singlestat",
        "targets": [
          {
            "expr": "active_users_total",
            "legendFormat": "Active Users"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 8}
      }
    ],
    "time": {"from": "now-1h", "to": "now"},
    "refresh": "30s"
  },
  "overwrite": true,
  "uid": "$uid"
}
EOF

    # Import dashboard to Grafana (if API is available)
    if command -v curl >/dev/null && [[ -n "${GRAFANA_API_KEY:-}" ]]; then
        curl -X POST \
            -H "Authorization: Bearer $GRAFANA_API_KEY" \
            -H "Content-Type: application/json" \
            -d @"$DASHBOARDS_DIR/${json_file}" \
            "${GRAFANA_URL}/api/dashboards/db" \
            && log_success "Dashboard imported to Grafana" \
            || log_warning "Failed to import dashboard to Grafana"
    fi
}

# Function to create DataDog dashboard
create_datadog_dashboard() {
    local name="$1"
    local dashboard_id="$2"

    log "Creating DataDog dashboard: $name"

    cat > "$DASHBOARDS_DIR/datadog-${dashboard_id}.json" <<EOF
{
  "title": "$name",
  "description": "SDLC.ai Platform Monitoring",
  "widgets": [
    {
      "definition": {
        "type": "timeseries",
        "requests": [
          {
            "q": "avg:api.sdlc.requests.count{*}.rollup(60)"
          }
        ],
        "title": "Request Rate"
      },
      "layout": {"x": 0, "y": 0, "w": 6, "h": 6}
    },
    {
      "definition": {
        "type": "timeseries",
        "requests": [
          {
            "q": "avg:api.sdlc.errors{*}.rollup(60) / avg:api.sdlc.requests.count{*}.rollup(60) * 100"
          }
        ],
        "title": "Error Rate %"
      },
      "layout": {"x": 6, "y": 0, "w": 6, "h": 6}
    },
    {
      "definition": {
        "type": "timeseries",
        "requests": [
          {
            "q": "avg:api.sdlc.response_time.p95{*}.rollup(60)"
          }
        ],
        "title": "P95 Response Time"
      },
      "layout": {"x": 0, "y": 6, "w": 6, "h": 6}
    },
    {
      "definition": {
        "type": "query_value",
        "requests": [
          {
            "q": "avg:api.sdlc.active_users{*}"
          }
        ],
        "title": "Active Users"
      },
      "layout": {"x": 6, "y": 6, "w": 6, "h": 6}
    }
  ],
  "template_variables": [],
  "layout_type": "ordered"
}
EOF

    # Import to DataDog (if API key is available)
    if command -v curl >/dev/null && [[ -n "${DATADOG_API_KEY:-}" && -n "${DATADOG_APP_KEY:-}" ]]; then
        curl -X POST \
            -H "DD-API-KEY: $DATADOG_API_KEY" \
            -H "DD-APPLICATION-KEY: $DATADOG_APP_KEY" \
            -H "Content-Type: application/json" \
            -d @"$DASHBOARDS_DIR/datadog-${dashboard_id}.json" \
            "https://api.datadoghq.com/api/v1/dashboard" \
            && log_success "Dashboard imported to DataDog" \
            || log_warning "Failed to import dashboard to DataDog"
    fi
}

# Function to set up Cloudflare analytics monitoring
setup_cloudflare_monitoring() {
    log "Setting up Cloudflare analytics monitoring"

    cat > "${DASHBOARDS_DIR}/cloudflare-analytics.yaml" <<EOF
# Cloudflare Analytics Dashboard Configuration
analytics:
  datasets:
    - name: "http_requests"
      query: |
        SELECT
          count(*) as requests,
          histogram(response.status_code) as status_distribution
        FROM http_requests
        WHERE timestamp >= NOW() - 1 HOUR
        GROUP BY endpoint

    - name: "worker_performance"
      query: |
        SELECT
          avg(worker.cpuTime) as avg_cpu_time,
          max(worker.cpuTime) as max_cpu_time,
          histogram(worker.cpuTime) as cpu_distribution
        FROM worker_events
        WHERE timestamp >= NOW() - 1 HOUR

    - name: "edge_functions"
      query: |
        SELECT
          functionName,
          count(*) as invocations,
          avg(duration) as avg_duration,
          histogram(status) as status_distribution
        FROM edge_functions
        WHERE timestamp >= NOW() - 1 HOUR
        GROUP BY functionName

alerts:
  - name: "high_error_rate"
    type: "threshold"
    metric: "error_rate"
    condition: "> 5%"
    duration: "5m"

  - name: "high_response_time"
    type: "threshold"
    metric: "p95_response_time"
    condition: "> 1000ms"
    duration: "5m"
EOF

    log_success "Cloudflare monitoring configuration created"
}

# Function to create alert rules
create_alert_rules() {
    log "Creating production alert rules"

    # PagerDuty alerts
    cat > "${ALERTS_DIR}/pagerduty-alerts.json" <<EOF
{
  "alerts": [
    {
      "name": "Service Down",
      "condition": "up == 0",
      "severity": "critical",
      "notification": {
        "type": "pagerduty",
        "service_key": "\${PAGERDUTY_SERVICE_KEY}",
        "escalation_policy": "production"
      }
    },
    {
      "name": "High Error Rate",
      "condition": "rate(http_requests_total{status=~\"5..\"}[5m]) / rate(http_requests_total[5m]) > 0.05",
      "severity": "critical",
      "for": "2m",
      "notification": {
        "type": "pagerduty",
        "service_key": "\${PAGERDUTY_SERVICE_KEY}",
        "escalation_policy": "production"
      }
    },
    {
      "name": "High Response Time",
      "condition": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 5",
      "severity": "warning",
      "for": "5m",
      "notification": {
        "type": "pagerduty",
        "service_key": "\${PAGERDUTY_SERVICE_KEY}",
        "escalation_policy": "standard"
      }
    }
  ]
}
EOF

    # Slack alerts
    cat > "${ALERTS_DIR}/slack-alerts.json" <<EOF
{
  "alerts": [
    {
      "name": "Deployment Started",
      "condition": "deployment_status == 'started'",
      "severity": "info",
      "notification": {
        "type": "slack",
        "webhook": "\${SLACK_WEBHOOK_URL}",
        "channel": "#deployments",
        "message": "Deployment started: \${deployment_id}"
      }
    },
    {
      "name": "Deployment Completed",
      "condition": "deployment_status == 'completed'",
      "severity": "info",
      "notification": {
        "type": "slack",
        "webhook": "\${SLACK_WEBHOOK_URL}",
        "channel": "#deployments",
        "message": "Deployment completed successfully: \${deployment_id}"
      }
    },
    {
      "name": "Performance Warning",
      "condition": "avg_response_time > 500",
      "severity": "warning",
      "notification": {
        "type": "slack",
        "webhook": "\${SLACK_WEBHOOK_URL}",
        "channel": "#performance",
        "message": "Performance degradation detected: \${avg_response_time}ms"
      }
    }
  ]
}
EOF

    log_success "Alert rules created"
}

# Function to create health check endpoints documentation
create_health_check_docs() {
    log "Creating health check endpoints documentation"

    cat > "${PROJECT_ROOT}/docs/health-checks.md" <<EOF
# SDLC.ai Health Check Endpoints

This document describes all health check endpoints available for monitoring the SDLC.ai platform.

## Public Health Endpoints

### `/health`
- **Method:** GET
- **Description:** Basic health check
- **Response:**
  \`\`\`json
  {
    "status": "healthy",
    "timestamp": "2025-11-04T12:00:00Z",
    "version": "1.0.0"
  }
  \`\`\`

### `/api/v1/status`
- **Method:** GET
- **Description:** Detailed system status
- **Response:**
  \`\`\`json
  {
    "status": "healthy",
    "services": {
      "api": "healthy",
      "database": "healthy",
      "cache": "healthy",
      "vector_search": "healthy",
      "ai_service": "healthy"
    },
    "metrics": {
      "uptime": 86400,
      "requests_per_second": 1500,
      "error_rate": 0.001
    }
  }
  \`\`\`

## Internal Health Endpoints

### `/api/v1/health/database`
- **Method:** GET
- **Description:** Database connectivity check
- **Authentication:** Required
- **Response:** Database status and connection metrics

### `/api/v1/health/cache`
- **Method:** GET
- **Description:** Cache connectivity check
- **Authentication:** Required
- **Response:** Cache status and hit rates

### `/api/v1/health/vector`
- **Method:** POST
- **Description:** Vector search health check
- **Authentication:** Required
- **Request Body:**
  \`\`\`json
  {
    "test": "health_check",
    "vector": [0.1, 0.2, 0.3]
  }
  \`\`\`

## Synthetic Transactions

### User Login Flow Test
- **Endpoint:** `/api/v1/auth/login`
- **Frequency:** Every 5 minutes
- **Success Criteria:** HTTP 200, token returned

### Document Upload Test
- **Endpoint:** `/api/v1/documents/upload`
- **Frequency:** Every 10 minutes
- **Success Criteria:** HTTP 200, document ID returned

### AI Generation Test
- **Endpoint:** `/api/v1/ai/completions`
- **Frequency:** Every 15 minutes
- **Success Criteria:** HTTP 200, response generated

## Monitoring Integration

### Prometheus Metrics
Available at `/metrics` (internal access only):
- \`http_requests_total\`
- \`http_request_duration_seconds\`
- \`active_users_total\`
- \`documents_processed_total\`
- \`ai_tokens_total\`

### Cloudflare Analytics
- Real-time analytics via Cloudflare dashboard
- Custom analytics datasets configured
- Export to external monitoring tools

## Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Error Rate | > 1% | > 5% |
| P95 Response Time | > 500ms | > 1000ms |
| Database Connections | > 15 | > 18 |
| Cache Hit Rate | < 80% | < 70% |
| CPU Usage | > 70% | > 90% |
| Memory Usage | > 80% | > 95% |

## Runbooks

### Service Down Alert
1. Check service logs in Cloudflare Workers
2. Verify recent deployments
3. Check for configuration changes
4. Restart service if necessary
5. Escalate if not resolved in 5 minutes

### High Error Rate Alert
1. Check error logs for patterns
2. Identify affected endpoints
3. Check recent code changes
4. Rollback if necessary
5. Notify on-call engineer

### Performance Degradation Alert
1. Check resource utilization
2. Analyze slow queries/endpoints
3. Check cache hit rates
4. Scale resources if needed
5. Optimize bottlenecks
EOF

    log_success "Health check documentation created"
}

# Function to create monitoring runbook
create_monitoring_runbook() {
    log "Creating monitoring runbook"

    cat > "${PROJECT_ROOT}/docs/monitoring-runbook.md" <<EOF
# SDLC.ai Monitoring Runbook

## On-Call Procedures

### When You Get Paged

1. **Acknowledge the alert within 5 minutes**
   - PagerDuty: Acknowledge the incident
   - Slack: Post in #incidents channel
   - Zoom: Join incident bridge if already created

2. **Assess the situation (2 minutes)**
   - Check dashboard for the specific service
   - Identify the scope of the issue
   - Determine if it's a P0 (critical) incident

3. **Investigate (5-10 minutes)**
   - Check recent deployments
   - Review error logs
   - Correlate with other alerts

4. **Mitigate**
   - Apply immediate fix if known
   - Rollback recent changes
   - Scale resources
   - Implement temporary workaround

5. **Communicate**
   - Update Slack channel with status
   - Notify stakeholders if P0
   - Send status page updates

6. **Resolve**
   - Verify the fix is working
   - Monitor for 15 minutes
   - Resolve the incident
   - Complete post-mortem

### Common Incidents

#### High CPU/Memory Usage
**Symptoms:**
- Slow response times
- Timeouts
- Service degradation

**Steps:**
1. Check which worker/service is affected
2. Look for memory leaks in logs
3. Scale up the service temporarily
4. Identify root cause (recent changes, traffic spike)
5. Implement permanent fix

#### Database Connection Issues
**Symptoms:**
- Database connection errors
- Slow queries
- Service timeouts

**Steps:**
1. Check database pool status
2. Verify database is healthy
3. Check for long-running queries
4. Increase pool size if needed
5. Kill problematic queries

#### Cache Failures
**Symptoms:**
- Low cache hit rates
- Increased database load
- Slower response times

**Steps:**
1. Check cache service status
2. Verify cache connectivity
3. Clear corrupted cache
4. Restart cache service
5. Monitor recovery

#### Authentication Failures
**Symptoms:**
- Users unable to login
- Auth service errors
- JWT token issues

**Steps:**
1. Check auth service health
2. Verify JWT secrets
3. Check auth provider status
4. Restart auth service
5. Report auth provider issues

### Daily Checks

### Morning (9:00 AM)
- [ ] Review overnight alerts
- [ ] Check system dashboard
- [ ] Verify backup completion
- [ ] Review error rates
- [ ] Check resource utilization

### Evening (5:00 PM)
- [ ] Review daily metrics
- [ ] Check for pending deployments
- [ ] Update handover notes
- [ ] Verify monitoring coverage

### Weekly Tasks

### Monday
- Review weekly performance trends
- Check alert effectiveness
- Update monitoring dashboards
- Review on-call schedule

### Wednesday
- Check backup test results
- Review security scan results
- Update runbooks
- Team knowledge sharing

### Friday
- Weekly metrics review
- Incident retrospective
- Update documentation
- Plan weekend maintenance

## Monitoring Tools Access

### Grafana
- URL: https://grafana.sdlc.cc
- Login: SSO via Google
- Key Dashboards:
  - Platform Overview
  - Performance Metrics
  - Business Metrics
  - Security Dashboard

### DataDog
- URL: https://app.datadoghq.com
- Login: SSO via SAML
- Key Monitors:
  - Host Metrics
  - APM Traces
  - Log Management
  - Synthetic Tests

### Sentry
- URL: https://sentry.sdlc.cc
- Login: SSO via GitHub
- Key Projects:
  - API Gateway
  - Web App
  - Workers
  - Background Jobs

### Cloudflare
- URL: https://dash.cloudflare.com
- Analytics: Real-time metrics
- Workers: Function logs
- DNS: Record management
- Security: WAF rules

## Escalation Policy

### Level 1: On-Call Engineer
- Response time: < 5 minutes
- Resolution time: < 30 minutes
- Escalate after: 15 minutes without progress

### Level 2: Team Lead
- Response time: < 10 minutes
- Resolution time: < 1 hour
- Escalate after: 30 minutes without progress

### Level 3: Engineering Manager
- Response time: < 15 minutes
- Resolution time: < 2 hours
- Escalate after: 1 hour without progress

### Level 4: CTO
- Response time: < 30 minutes
- Resolution time: As needed
- Business impact assessment required

## Communication Templates

### P0 Incident Initial Message
```
🚨 **P0 INCIDENT DECLARED** 🚨

Service: [Service Name]
Impact: [Description of impact]
Started: [Time]
Current Status: [Status]

Investigating: [On-call engineer]
Next Update: [Time + 15 min]

Incident Bridge: [Zoom link]
Status Page: https://status.sdlc.cc
```

### Incident Resolution Message
```
✅ **INCIDENT RESOLVED**

Service: [Service Name]
Duration: [Duration]
Root Cause: [Brief description]
Resolution: [What was fixed]

Follow-up actions:
- [ ] Post-mortem scheduled
- [ ] PR created for fix
- [ ] Monitoring updated

Thank you for your patience!
```

## Maintenance Windows

### Weekly Maintenance
- **When:** Sunday 2:00 AM - 4:00 AM UTC
- **Duration:** Up to 2 hours
- **Impact:** Potential brief interruptions
- **Notice:** 48 hours advance notice

### Monthly Maintenance
- **When:** First Sunday of month
- **Duration:** Up to 4 hours
- **Impact:** Possible service restarts
- **Notice:** 1 week advance notice

### Emergency Maintenance
- **When:** As needed
- **Duration:** As needed
- **Impact:** Service interruption
- **Notice:** Best effort (may not be possible)

## Performance Baselines

### API Endpoints
- GET /health: < 10ms
- GET /api/v1/status: < 50ms
- POST /api/v1/auth/login: < 200ms
- GET /api/v1/documents: < 100ms
- POST /api/v1/documents/upload: < 5000ms
- POST /api/v1/ai/completions: < 10000ms

### System Metrics
- CPU Usage: < 50% average
- Memory Usage: < 70% average
- Disk Usage: < 80%
- Network: < 1 Gbps sustained
- Database: < 100ms query time
- Cache: > 90% hit rate

## SLA Targets

### Availability
- API Uptime: 99.9% (8.76 hours/month downtime)
- Web App Uptime: 99.9%
- Background Jobs: 99.5%
- Data Loss: 0%

### Performance
- P50 Response Time: < 200ms
- P95 Response Time: < 500ms
- P99 Response Time: < 1000ms
- Throughput: 1000 RPS sustained

### Support
- P0 Response: < 15 minutes
- P1 Response: < 1 hour
- P2 Response: < 4 hours
- P3 Response: < 24 hours
EOF

    log_success "Monitoring runbook created"
}

# Main execution
main() {
    log "Setting up production monitoring dashboards and alerts"
    log "====================================================="

    # Create Grafana dashboards
    create_grafana_dashboard "SDLC Platform Overview" "sdlc-platform-overview" "platform-overview.json"
    create_grafana_dashboard "SDLC Performance Metrics" "sdlc-performance" "performance-metrics.json"
    create_grafana_dashboard "SDLC Business Metrics" "sdlc-business" "business-metrics.json"
    create_grafana_dashboard "SDLC Security Dashboard" "sdlc-security" "security-dashboard.json"

    # Create DataDog dashboards
    create_datadog_dashboard "SDLC Production Overview" "prod-overview"
    create_datadog_dashboard "SDLC Performance Metrics" "perf-metrics"

    # Set up Cloudflare monitoring
    setup_cloudflare_monitoring

    # Create alert rules
    create_alert_rules

    # Create documentation
    create_health_check_docs
    create_monitoring_runbook

    # Create a summary dashboard index
    cat > "${DASHBOARDS_DIR/README.md}" <<EOF
# SDLC.ai Monitoring Dashboards

## Grafana Dashboards
- [Platform Overview](${GRAFANA_URL}/d/sdlc-platform-overview)
- [Performance Metrics](${GRAFANA_URL}/d/sdlc-performance)
- [Business Metrics](${GRAFANA_URL}/d/sdlc-business)
- [Security Dashboard](${GRAFANA_URL}/d/sdlc-security)

## DataDog Dashboards
- [Production Overview](${DATADOG_URL}/dash/prod-overview)
- [Performance Metrics](${DATADOG_URL}/dash/perf-metrics)

## Sentry Projects
- [API Gateway](${SENTRY_URL}/organizations/sdlc/projects/api-gateway/)
- [Web Application](${SENTRY_URL}/organizations/sdlc/projects/web-app/)
- [Workers](${SENTRY_URL}/organizations/sdlc/projects/workers/)

## Health Check Endpoints
- API Health: ${API_BASE_URL:-https://api.sdlc.cc}/health
- System Status: ${API_BASE_URL:-https://api.sdlc.cc}/api/v1/status

## Alert Configuration
- PagerDuty: Production service configured
- Slack: #alerts-production channel
- Email: alerts@sdlc.cc distribution list

## Documentation
- [Health Checks Documentation](../docs/health-checks.md)
- [Monitoring Runbook](../docs/monitoring-runbook.md)
- [Incident Response Plan](../docs/incident-response.md)
EOF

    log "====================================================="
    log_success "Production monitoring setup complete!"
    log ""
    log "Next steps:"
    log "1. Review dashboard configurations"
    log "2. Test alert notifications"
    log "3. Fine-tune alert thresholds"
    log "4. Train team on monitoring tools"
    log "5. Schedule regular monitoring reviews"
    log ""
    log "Dashboards created in: ${DASHBOARDS_DIR}"
    log "Alert rules created in: ${ALERTS_DIR}"
    log "Documentation created in: ${PROJECT_ROOT}/docs/"
}

# Execute main function
main "$@"
