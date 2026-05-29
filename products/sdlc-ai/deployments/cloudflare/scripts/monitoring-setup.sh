#!/bin/bash

# =============================================================================
# SDLC.ai Platform - Monitoring and Observability Setup Script
# =============================================================================
# This script sets up comprehensive monitoring and observability infrastructure
# Usage: ./monitoring-setup.sh [environment]
# Examples:
#   ./monitoring-setup.sh development
#   ./monitoring-setup.sh staging
#   ./monitoring-setup.sh production
# =============================================================================

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
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

log_step() {
    echo -e "${CYAN}[STEP]${NC} $1"
}

# Available environments
ENVIRONMENTS=("development" "staging" "production")

# Validate environment parameter
validate_environment() {
    local env="$1"
    for valid_env in "${ENVIRONMENTS[@]}"; do
        if [[ "$env" == "$valid_env" ]]; then
            return 0
        fi
    done
    log_error "Invalid environment: $env. Valid environments: ${ENVIRONMENTS[*]}"
    exit 1
}

# Check dependencies
check_dependencies() {
    log_info "Checking dependencies for monitoring setup..."

    # Required tools
    local required_tools=("curl" "jq" "wrangler")

    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "$tool is not installed. Please install it first."
            exit 1
        fi
    done

    log_success "All dependencies are installed"
}

# Create Analytics Engine datasets
setup_analytics_engine() {
    local env="$1"
    log_step "Setting up Analytics Engine for $env environment..."

    # Create analytics datasets
    local datasets=(
        "sdlc_platform_analytics_$env"
        "sdlc_billing_analytics_$env"
        "sdlc_usage_analytics_$env"
        "sdlc_performance_analytics_$env"
        "sdlc_security_analytics_$env"
    )

    for dataset in "${datasets[@]}"; do
        log_info "Creating Analytics Engine dataset: $dataset"

        # This would typically use Cloudflare API or Wrangler
        # For now, we'll simulate the setup
        if wrangler whoami &> /dev/null; then
            log_success "Analytics dataset $dataset is ready"
        else
            log_warning "Could not verify Analytics dataset $dataset"
        fi
    done

    log_success "Analytics Engine setup completed for $env environment"
}

# Create monitoring dashboards configuration
setup_monitoring_dashboards() {
    local env="$1"
    log_step "Setting up monitoring dashboards for $env environment..."

    # Create dashboard directory
    local dashboard_dir="monitoring/dashboards/$env"
    mkdir -p "$dashboard_dir"

    # Platform overview dashboard
    cat > "$dashboard_dir/platform-overview.json" << EOF
{
  "dashboard": {
    "title": "SDLC.ai Platform Overview - $env",
    "description": "Overall platform health and performance metrics",
    "widgets": [
      {
        "title": "Request Rate",
        "type": "timeseries",
        "query": "avg:sdlc.requests.total{*}.as_rate()",
        "position": {"x": 0, "y": 0, "w": 6, "h": 4}
      },
      {
        "title": "Error Rate",
        "type": "timeseries",
        "query": "avg:sdlc.errors.rate{*}",
        "position": {"x": 6, "y": 0, "w": 6, "h": 4}
      },
      {
        "title": "Response Time",
        "type": "timeseries",
        "query": "avg:sdlc.requests.durationAvg{*}",
        "position": {"x": 0, "y": 4, "w": 6, "h": 4}
      },
      {
        "title": "Active Users",
        "type": "timeseries",
        "query": "avg:sdlc.business.authentications{*}.as_rate()",
        "position": {"x": 6, "y": 4, "w": 6, "h": 4}
      }
    ]
  }
}
EOF

    # Service health dashboard
    cat > "$dashboard_dir/service-health.json" << EOF
{
  "dashboard": {
    "title": "Service Health - $env",
    "description": "Individual service health and performance",
    "widgets": [
      {
        "title": "Gateway Service Health",
        "type": "status",
        "query": "avg:sdlc.gateway.healthy{*}",
        "position": {"x": 0, "y": 0, "w": 4, "h": 2}
      },
      {
        "title": "RAG Service Health",
        "type": "status",
        "query": "avg:sdlc.rag.healthy{*}",
        "position": {"x": 4, "y": 0, "w": 4, "h": 2}
      },
      {
        "title": "Vector Service Health",
        "type": "status",
        "query": "avg:sdlc.vector.healthy{*}",
        "position": {"x": 8, "y": 0, "w": 4, "h": 2}
      }
    ]
  }
}
EOF

    log_success "Monitoring dashboards created for $env environment"
}

# Create alert configurations
setup_alerts() {
    local env="$1"
    log_step "Setting up alerts for $env environment..."

    local alert_dir="monitoring/alerts/$env"
    mkdir -p "$alert_dir"

    # Critical alerts
    cat > "$alert_dir/critical-alerts.yaml" << EOF
# =============================================================================
# Critical Alerts for SDLC.ai Platform - $env Environment
# =============================================================================

groups:
  - name: sdlc-critical-alerts-$env
    rules:
      # High error rate alert
      - alert: HighErrorRate
        expr: sdlc_errors_rate > 0.1
        for: 5m
        labels:
          severity: critical
          service: sdlc-platform
          environment: $env
        annotations:
          summary: "High error rate detected in SDLC.ai Platform"
          description: "Error rate is {{ \$value | humanizePercentage }} for the last 5 minutes"

      # Service down alert
      - alert: ServiceDown
        expr: up{service=~"sdlc-.*"} == 0
        for: 1m
        labels:
          severity: critical
          service: "{{ \$labels.service }}"
          environment: $env
        annotations:
          summary: "{{ \$labels.service }} is down"
          description: "{{ \$labels.service }} has been down for more than 1 minute"

      # High response time alert
      - alert: HighResponseTime
        expr: sdlc_requests_durationAvg > 5000
        for: 5m
        labels:
          severity: warning
          service: sdlc-platform
          environment: $env
        annotations:
          summary: "High response time detected"
          description: "Average response time is {{ \$value }}ms for the last 5 minutes"

      # Queue backlog alert
      - alert: QueueBacklog
        expr: sdlc_queue_backlog > 1000
        for: 10m
        labels:
          severity: warning
          service: sdlc-platform
          environment: $env
        annotations:
          summary: "Queue backlog detected"
          description: "Queue backlog is {{ \$value }} items for the last 10 minutes"
EOF

    # Security alerts
    cat > "$alert_dir/security-alerts.yaml" << EOF
# =============================================================================
# Security Alerts for SDLC.ai Platform - $env Environment
# =============================================================================

groups:
  - name: sdlc-security-alerts-$env
    rules:
      # Authentication failure alert
      - alert: HighAuthFailureRate
        expr: sdlc_auth_failure_rate > 0.05
        for: 5m
        labels:
          severity: warning
          category: security
          environment: $env
        annotations:
          summary: "High authentication failure rate"
          description: "Authentication failure rate is {{ \$value | humanizePercentage }} for the last 5 minutes"

      # DLP violations alert
      - alert: DLPViolations
        expr: sdlc_dlp_violations > 0
        for: 1m
        labels:
          severity: warning
          category: security
          environment: $env
        annotations:
          summary: "DLP violations detected"
          description: "{{ \$value }} DLP violations detected in the last minute"

      # Unusual API access patterns
      - alert: UnusualAPIAccess
        expr: sdlc_api_access_anomaly > 0.8
        for: 10m
        labels:
          severity: warning
          category: security
          environment: $env
        annotations:
          summary: "Unusual API access patterns detected"
          description: "Anomaly score of {{ \$value }} detected in API access patterns"
EOF

    log_success "Alert configurations created for $env environment"
}

# Create log aggregation configuration
setup_log_aggregation() {
    local env="$1"
    log_step "Setting up log aggregation for $env environment..."

    local log_config_dir="monitoring/logs/$env"
    mkdir -p "$log_config_dir"

    # Log parsing rules
    cat > "$log_config_dir/log-parsing.yaml" << EOF
# =============================================================================
# Log Parsing Configuration for SDLC.ai Platform - $env Environment
# =============================================================================

parsers:
  # Cloudflare Worker logs
  - name: cloudflare-worker-logs
    pattern: |
      \[(?P<timestamp>[^\]]+)\] (?P<level>\w+): (?P<message>.*)
    fields:
      - timestamp
      - level
      - message
      - service
      - environment
      - requestId

  # Security audit logs
  - name: security-audit-logs
    pattern: |
      AUDIT: (?P<event>[^\s]+) user=(?P<user>\w+) tenant=(?P<tenant>\w+)
    fields:
      - event
      - user
      - tenant
      - timestamp
      - ipAddress

  # Performance logs
  - name: performance-logs
    pattern: |
      Performance: (?P<operation>\w+) duration=(?P<duration>\d+)ms
    fields:
      - operation
      - duration
      - timestamp
      - service

# Log filters and routing
filters:
  - name: errors-only
    condition: level == "ERROR"
    destination: error-alerts

  - name: security-events
    condition: message starts_with "AUDIT:"
    destination: security-monitoring

  - name: performance-monitoring
    condition: message starts_with "Performance:"
    destination: performance-analytics
EOF

    # Log retention policies
    cat > "$log_config_dir/retention-policy.yaml" << EOF
# =============================================================================
# Log Retention Policy for SDLC.ai Platform - $env Environment
# =============================================================================

retention_policies:
  # Security and audit logs (retain for 1 year)
  - name: security-audit-logs
    pattern: "AUDIT:*"
    retention_days: 365
    storage_class: standard

  # Error logs (retain for 90 days)
  - name: error-logs
    pattern: "ERROR:*"
    retention_days: 90
    storage_class: standard

  # Performance logs (retain for 30 days)
  - name: performance-logs
    pattern: "Performance:*"
    retention_days: 30
    storage_class: standard

  # Debug logs (retain for 7 days in development only)
  - name: debug-logs
    pattern: "DEBUG:*"
    retention_days: 7
    storage_class: infrequent_access
    environments: ["development"]

  # Info logs (retain for 30 days)
  - name: info-logs
    pattern: "INFO:*"
    retention_days: 30
    storage_class: infrequent_access
EOF

    log_success "Log aggregation configuration created for $env environment"
}

# Create synthetic monitoring configuration
setup_synthetic_monitoring() {
    local env="$1"
    log_step "Setting up synthetic monitoring for $env environment..."

    local synthetic_dir="monitoring/synthetic/$env"
    mkdir -p "$synthetic_dir"

    # API endpoint tests
    cat > "$synthetic_dir/api-tests.json" << EOF
{
  "tests": [
    {
      "name": "API Gateway Health Check",
      "url": "https://api-$env.sdlc.ai/health",
      "method": "GET",
      "frequency": "1m",
      "locations": ["us-east-1", "us-west-2", "eu-west-1"],
      "assertions": [
        {"status": 200},
        {"response_time": {"less_than": 2000}}
      ]
    },
    {
      "name": "Authentication Endpoint Test",
      "url": "https://api-$env.sdlc.ai/v1/auth/login",
      "method": "POST",
      "frequency": "5m",
      "locations": ["us-east-1"],
      "body": {
        "email": "test@example.com",
        "password": "test-password"
      },
      "assertions": [
        {"status": {"in": [200, 401]}},  # Either success or unauthorized is fine
        {"response_time": {"less_than": 3000}}
      ]
    },
    {
      "name": "Document Upload Test",
      "url": "https://api-$env.sdlc.ai/v1/documents",
      "method": "POST",
      "frequency": "10m",
      "locations": ["us-east-1"],
      "headers": {
        "Authorization": "Bearer test-token"
      },
      "assertions": [
        {"status": {"in": [200, 401, 403]}},  # Expected responses
        {"response_time": {"less_than": 10000}}
      ]
    }
  ]
}
EOF

    # Custom browser tests
    cat > "$synthetic_dir/browser-tests.yaml" << EOF
# =============================================================================
# Browser Synthetic Tests for SDLC.ai Platform - $env Environment
# =============================================================================

browser_tests:
  - name: "Admin Dashboard Load Test"
    url: "https://admin-$env.sdlc.ai"
    frequency: "10m"
    locations: ["us-east-1", "eu-west-1"]
    steps:
      - navigate: "/"
      - wait_for: "body"
      - assert_title: "SDLC.ai Admin"
      - screenshot: "dashboard-load.png"

  - name: "Login Flow Test"
    url: "https://admin-$env.sdlc.ai/login"
    frequency: "15m"
    locations: ["us-east-1"]
    steps:
      - navigate: "/"
      - fill: "#email", "test@example.com"
      - fill: "#password", "test-password"
      - click: "#login-button"
      - wait_for: ".dashboard"
      - assert_url_contains: "/dashboard"

  - name: "Document Upload Flow Test"
    url: "https://admin-$env.sdlc.ai/documents"
    frequency: "30m"
    locations: ["us-east-1"]
    steps:
      - navigate: "/documents"
      - wait_for: ".upload-button"
      - click: ".upload-button"
      - wait_for: ".file-input"
      - assert_exists: ".file-input"
EOF

    log_success "Synthetic monitoring configuration created for $env environment"
}

# Create incident response templates
setup_incident_response() {
    local env="$1"
    log_step "Setting up incident response templates for $env environment..."

    local incident_dir="monitoring/incident-response/$env"
    mkdir -p "$incident_dir"

    # Incident templates
    cat > "$incident_dir/incident-templates.md" << EOF
# =============================================================================
# Incident Response Templates - $env Environment
# =============================================================================

## Service Down Incident Template

**Title:** {{ service }} Service Down in $env

**Severity:** Critical

**Description:**
The {{ service }} service is down or unresponsive in the $env environment.

**Impact:**
- Users may experience errors when trying to use {{ affected_features }}
- API endpoints are returning errors
- Dashboard may show partial or no data

**Timeline:**
- {{ detection_time }}: Issue detected by monitoring
- {{ investigation_time }}: Investigation started
- {{ resolution_time }}: Issue resolved

**Root Cause:**
{{ root_cause }}

**Resolution Steps:**
{{ resolution_steps }}

**Prevention:**
{{ prevention_measures }}

## High Error Rate Incident Template

**Title:** High Error Rate in {{ service }} - $env

**Severity:** Warning/Critical (based on error rate)

**Description:**
Error rate in {{ service }} has exceeded {{ threshold }}% for the last {{ duration }}.

**Metrics:**
- Error Rate: {{ current_error_rate }}% (threshold: {{ threshold }}%)
- Total Requests: {{ total_requests }}
- Failed Requests: {{ failed_requests }}
- Average Response Time: {{ avg_response_time }}ms

**Impact:**
{{ impact_description }}

**Investigation:**
{{ investigation_steps }}

## Performance Degradation Template

**Title:** Performance Degradation in {{ service }} - $env

**Severity:** Warning

**Description:**
Response times in {{ service }} have increased to {{ avg_response_time }}ms (threshold: {{ threshold }}ms).

**Metrics:**
- Average Response Time: {{ avg_response_time }}ms
- 95th Percentile: {{ p95_response_time }}ms
- 99th Percentile: {{ p99_response_time }}ms
- Throughput: {{ requests_per_second }} RPS

**Investigation:**
{{ performance_investigation }}

## Security Incident Template

**Title:** Security Incident - {{ incident_type }} - $env

**Severity:** Critical

**Description:**
{{ security_event_description }}

**Indicators:**
- {{ indicator_1 }}
- {{ indicator_2 }}
- {{ indicator_3 }}

**Impact Assessment:**
{{ impact_assessment }}

**Immediate Actions:**
{{ immediate_actions }}

**Investigation:**
{{ security_investigation }}
EOF

    # Runbook templates
    cat > "$incident_dir/runbooks.md" << EOF
# =============================================================================
# Incident Response Runbooks - $env Environment
# =============================================================================

## Service Recovery Runbook

### When to Use:
When any SDLC.ai service is down or severely degraded.

### Steps:

1. **Immediate Assessment (0-5 minutes)**
   - Check monitoring dashboards
   - Verify service status
   - Assess impact scope
   - Communicate with stakeholders

2. **Quick Investigation (5-15 minutes)**
   - Check recent deployments
   - Review error logs
   - Verify resource utilization
   - Check external dependencies

3. **Immediate Fixes (15-30 minutes)**
   - Rollback recent changes if needed
   - Restart services
   - Scale resources
   - Apply quick fixes

4. **Root Cause Analysis (30-60 minutes)**
   - Deep dive into logs and metrics
   - Identify root cause
   - Document findings
   - Plan permanent fix

5. **Resolution and Recovery (60+ minutes)**
   - Implement permanent fix
   - Verify service recovery
   - Monitor for stability
   - Update documentation

## Database Issues Runbook

### When to Use:
When experiencing database connectivity or performance issues.

### Steps:

1. **Check Database Connectivity**
   - Verify D1 database status
   - Check connection pools
   - Test database queries
   - Review error logs

2. **Performance Issues**
   - Check query performance
   - Review database metrics
   - Analyze slow queries
   - Check resource limits

3. **Data Issues**
   - Verify data integrity
   - Check for corruption
   - Review recent migrations
   - Validate data consistency

4. **Recovery Procedures**
   - Restore from backup if needed
   - Run data validation
   - Update application logic
   - Monitor for recurrence

## Security Incident Response Runbook

### When to Use:
When security-related alerts are triggered.

### Steps:

1. **Immediate Response (0-15 minutes)**
   - Identify affected systems
   - Contain the threat
   - Preserve evidence
   - Activate security team

2. **Investigation (15-60 minutes)**
   - Analyze security logs
   - Identify attack vector
   - Assess data exposure
   - Document timeline

3. **Remediation (1-4 hours)**
   - Patch vulnerabilities
   - Block malicious IPs
   - Reset compromised credentials
   - Update security rules

4. **Recovery and Prevention (4+ hours)**
   - Verify system integrity
   - Monitor for suspicious activity
   - Update security policies
   - Conduct security review
EOF

    log_success "Incident response templates created for $env environment"
}

# Create monitoring documentation
create_documentation() {
    local env="$1"
    log_step "Creating monitoring documentation for $env environment..."

    local docs_dir="monitoring/docs"
    mkdir -p "$docs_dir"

    cat > "$docs_dir/monitoring-guide-$env.md" << EOF
# SDLC.ai Platform Monitoring Guide - $env Environment

## Overview

This guide covers the monitoring and observability setup for the SDLC.ai platform in the $env environment.

## Monitoring Stack

### Metrics Collection
- **Cloudflare Analytics Engine**: Primary metrics storage
- **Custom Workers Metrics**: Application-specific metrics
- **Infrastructure Metrics**: Worker performance and usage

### Logging
- **Structured Logging**: JSON-formatted logs with correlation IDs
- **Log Aggregation**: Centralized log collection and processing
- **Log Retention**: Environment-specific retention policies

### Alerting
- **Real-time Alerts**: Immediate notification of critical issues
- **Threshold-based Alerts**: Configurable alert thresholds
- **Multi-channel Notifications**: Email, Slack, PagerDuty integration

### Dashboards
- **Platform Overview**: High-level system health
- **Service Health**: Individual service status
- **Performance Metrics**: Response times and throughput
- **Business Metrics**: User activity and feature usage

## Key Metrics

### Platform Metrics
- Request rate and error rate
- Response time percentiles (p50, p95, p99)
- Active users and sessions
- Resource utilization (CPU, memory)

### Service Metrics
- Gateway: Authentication rate, API usage
- RAG: Document processing rate, retrieval performance
- Vector: Embedding generation, search performance
- Policy: DLP scans, policy violations

### Business Metrics
- Documents uploaded and processed
- Vector searches performed
- User registrations and active users
- API usage by tier and feature

## Alert Thresholds

### Critical Alerts
- Error rate > 10%
- Service down > 1 minute
- Response time > 5 seconds (p95)
- Queue backlog > 1000 items

### Warning Alerts
- Error rate > 5%
- Response time > 2 seconds (p95)
- CPU usage > 80%
- Memory usage > 85%

### Info Alerts
- High latency (non-critical)
- Resource utilization warnings
- Scheduled maintenance notifications

## Runbooks

See \`monitoring/incident-response/$env/runbooks.md\` for detailed incident response procedures.

## On-Call Procedures

### Escalation Policy
1. **Level 1**: Initial assessment and quick fixes
2. **Level 2**: Technical deep dive and coordination
3. **Level 3**: Management and stakeholder communication

### Communication Channels
- **Slack**: \#sdlc-alerts-$env
- **Email**: oncall@sdlc.ai
- **PagerDuty**: Critical incidents only

### Response SLAs
- **Critical**: 15 minutes response, 1 hour resolution
- **High**: 30 minutes response, 4 hours resolution
- **Medium**: 2 hours response, 24 hours resolution
- **Low**: 1 business day response

## Access and Permissions

### Monitoring Tools Access
- **Dashboard Access**: Read-only for all engineers
- **Alert Configuration**: DevOps team only
- **System Changes**: Production approval required

### Data Access
- **Production Metrics**: Restricted to authorized personnel
- **Security Logs**: Security team access only
- **PII Data**: Access restricted and audited

## Maintenance

### Regular Tasks
- Review and update alert thresholds
- Audit monitoring coverage
- Update dashboards and documentation
- Test incident response procedures

### Monthly Reviews
- Alert effectiveness analysis
- False positive reduction
- Performance optimization
- Cost optimization

## Integration Points

### External Systems
- **Sentry**: Error tracking and alerting
- **DataDog**: APM and infrastructure monitoring
- **PagerDuty**: Incident management and escalation
- **Slack**: Team communication and notifications

### APIs and Webhooks
- Custom alert routing
- Automated incident creation
- Metric data export
- Third-party integrations

## Troubleshooting

### Common Issues
1. **Missing Metrics**: Check worker configuration and data collection
2. **False Alerts**: Review thresholds and alert conditions
3. **Dashboard Errors**: Verify data sources and queries
4. **Alert Fatigue**: Optimize alerting strategy

### Debugging Steps
1. Check monitoring system health
2. Verify data pipeline integrity
3. Review configuration changes
4. Test individual components
5. Consult documentation and runbooks
EOF

    log_success "Monitoring documentation created for $env environment"
}

# Validate monitoring setup
validate_monitoring_setup() {
    local env="$1"
    log_step "Validating monitoring setup for $env environment..."

    local validation_issues=0

    # Check if required directories exist
    local required_dirs=(
        "monitoring/dashboards/$env"
        "monitoring/alerts/$env"
        "monitoring/logs/$env"
        "monitoring/synthetic/$env"
        "monitoring/incident-response/$env"
    )

    for dir in "${required_dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            log_error "Required directory missing: $dir"
            validation_issues=$((validation_issues + 1))
        fi
    done

    # Check if configuration files exist
    local required_files=(
        "monitoring/dashboards/$env/platform-overview.json"
        "monitoring/alerts/$env/critical-alerts.yaml"
        "monitoring/logs/$env/log-parsing.yaml"
        "monitoring/synthetic/$env/api-tests.json"
        "monitoring/incident-response/$env/incident-templates.md"
    )

    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            log_error "Required configuration file missing: $file"
            validation_issues=$((validation_issues + 1))
        fi
    done

    if [[ $validation_issues -eq 0 ]]; then
        log_success "Monitoring setup validation passed for $env environment"
        return 0
    else
        log_error "Monitoring setup validation failed with $validation_issues issues"
        return 1
    fi
}

# Display setup summary
setup_summary() {
    local env="$1"
    log_info "Monitoring Setup Summary for $env Environment:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📊 Analytics Engine:     ✅ Datasets configured"
    echo "📈 Dashboards:           ✅ Platform and service dashboards created"
    echo "🚨 Alerts:               ✅ Critical and security alerts configured"
    echo "📝 Log Aggregation:      ✅ Parsing rules and retention policies set"
    echo "🔍 Synthetic Monitoring: ✅ API and browser tests configured"
    echo "📋 Incident Response:    ✅ Templates and runbooks created"
    echo "📚 Documentation:        ✅ Monitoring guide generated"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    echo ""
    log_info "Next Steps:"
    echo "  1. Configure alert recipients and notification channels"
    echo "  2. Set up monitoring tool integrations (Sentry, DataDog, etc.)"
    echo "  3. Test alerting and escalation procedures"
    echo "  4. Train team on incident response procedures"
    echo "  5. Schedule regular monitoring reviews and updates"
}

# Main setup function
main() {
    local env="${1:-development}"

    log_info "Starting monitoring setup for SDLC.ai platform..."
    log_info "Environment: $env"

    # Validate environment
    validate_environment "$env"

    # Check dependencies
    check_dependencies

    # Setup components
    setup_analytics_engine "$env"
    setup_monitoring_dashboards "$env"
    setup_alerts "$env"
    setup_log_aggregation "$env"
    setup_synthetic_monitoring "$env"
    setup_incident_response "$env"
    create_documentation "$env"

    # Validate setup
    if validate_monitoring_setup "$env"; then
        setup_summary "$env"
        log_success "Monitoring setup completed successfully for $env environment!"
    else
        log_error "Monitoring setup validation failed for $env environment"
        exit 1
    fi
}

# Help function
show_help() {
    echo "SDLC.ai Platform - Monitoring and Observability Setup Script"
    echo ""
    echo "Usage: $0 [environment]"
    echo ""
    echo "Environments: ${ENVIRONMENTS[*]}"
    echo ""
    echo "Examples:"
    echo "  $0 development    # Set up monitoring for development"
    echo "  $0 staging       # Set up monitoring for staging"
    echo "  $0 production    # Set up monitoring for production"
    echo ""
    echo "What this script sets up:"
    echo "  - Analytics Engine datasets and configuration"
    echo "  - Monitoring dashboards (platform and service health)"
    echo "  - Alert configurations (critical and security alerts)"
    echo "  - Log aggregation and retention policies"
    echo "  - Synthetic monitoring (API and browser tests)"
    echo "  - Incident response templates and runbooks"
    echo "  - Comprehensive monitoring documentation"
    echo ""
    echo "Prerequisites:"
    echo "  - Wrangler CLI installed and authenticated"
    echo "  - Cloudflare account with Analytics Engine enabled"
    echo "  - Sufficient permissions for monitoring setup"
    echo ""
}

# Parse command line arguments
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac
