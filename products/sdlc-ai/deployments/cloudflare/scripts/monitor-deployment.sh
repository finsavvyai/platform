#!/bin/bash

# =============================================================================
# SDLC.ai Platform - Production Deployment Monitoring
# =============================================================================
# Comprehensive monitoring system for production deployments
# Features:
    - Real-time metrics collection
    - Intelligent alerting
    - Performance monitoring
    - Error detection and analysis
    - Automated response system
    - Dashboard integration
    - Reporting and analytics
# =============================================================================

set -euo pipefail

# Configuration
readonly PLATFORM_NAME="sdlc-platform"
readonly PRODUCTION_DOMAIN="sdlc.ai"
readonly API_DOMAIN="api.sdlc.ai"
readonly ADMIN_DOMAIN="admin.sdlc.ai"
readonly MONITORING_INTERVAL=30
readonly ALERT_COOLDOWN=300
readonly METRICS_RETENTION_HOURS=24
readonly LOG_LEVEL="${LOG_LEVEL:-info}"

# Directories
readonly MONITORING_DIR="monitoring"
readonly METRICS_DIR="$MONITORING_DIR/metrics"
readonly ALERTS_DIR="$MONITORING_DIR/alerts"
readonly REPORTS_DIR="$MONITORING_DIR/reports"
readonly LOGS_DIR="$MONITORING_DIR/logs"

# Create directories
mkdir -p "$METRICS_DIR" "$ALERTS_DIR" "$REPORTS_DIR" "$LOGS_DIR"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Global state
MONITORING_ACTIVE=false
MONITORING_PID=""
LAST_ALERT_TIME=0
METRICS_FILE=""
ALERT_CONFIG_FILE="$MONITORING_DIR/alert-config.json"

# Logging functions
log_monitoring() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    case $level in
        "ERROR") echo -e "${RED}[ERROR]${NC} $timestamp - $message" | tee -a "$LOGS_DIR/monitoring.log" ;;
        "WARN")  echo -e "${YELLOW}[WARN]${NC} $timestamp - $message" | tee -a "$LOGS_DIR/monitoring.log" ;;
        "INFO")  echo -e "${BLUE}[INFO]${NC} $timestamp - $message" | tee -a "$LOGS_DIR/monitoring.log" ;;
        "DEBUG") [[ "$LOG_LEVEL" = "debug" ]] && echo -e "${CYAN}[DEBUG]${NC} $timestamp - $message" | tee -a "$LOGS_DIR/monitoring.log" ;;
    esac
}

# Initialize monitoring
initialize_monitoring() {
    log_monitoring "INFO" "Initializing production monitoring system..."

    # Generate metrics file with timestamp
    METRICS_FILE="$METRICS_DIR/metrics-$(date +%Y%m%d-%H%M%S).json"

    # Create metrics file structure
    cat > "$METRICS_FILE" << EOF
{
    "metadata": {
        "platform": "$PLATFORM_NAME",
        "domain": "$PRODUCTION_DOMAIN",
        "start_time": "$(date -Iseconds)",
        "monitoring_version": "1.0.0"
    },
    "metrics": [],
    "alerts": [],
    "summary": {
        "total_requests": 0,
        "error_count": 0,
        "avg_response_time": 0,
        "peak_response_time": 0,
        "uptime_percentage": 100
    }
}
EOF

    # Create alert configuration if not exists
    if [[ ! -f "$ALERT_CONFIG_FILE" ]]; then
        create_default_alert_config
    fi

    # Test connections
    test_api_connectivity

    log_monitoring "INFO" "Monitoring initialized. Metrics file: $METRICS_FILE"
}

# Create default alert configuration
create_default_alert_config() {
    cat > "$ALERT_CONFIG_FILE" << EOF
{
    "alerts": {
        "error_rate": {
            "enabled": true,
            "threshold": 10,
            "window_minutes": 5,
            "severity": "critical",
            "cooldown_seconds": 300
        },
        "response_time": {
            "enabled": true,
            "threshold_ms": 2000,
            "percentile": 95,
            "window_minutes": 5,
            "severity": "warning",
            "cooldown_seconds": 300
        },
        "availability": {
            "enabled": true,
            "threshold_percentage": 99,
            "window_minutes": 10,
            "severity": "critical",
            "cooldown_seconds": 600
        },
        "rate_limit": {
            "enabled": true,
            "threshold_percentage": 80,
            "window_minutes": 5,
            "severity": "warning",
            "cooldown_seconds": 300
        },
        "memory_usage": {
            "enabled": true,
            "threshold_percentage": 85,
            "window_minutes": 5,
            "severity": "warning",
            "cooldown_seconds": 300
        },
        "cpu_usage": {
            "enabled": true,
            "threshold_percentage": 80,
            "window_minutes": 5,
            "severity": "warning",
            "cooldown_seconds": 300
        }
    },
    "notifications": {
        "webhook_url": "${WEBHOOK_URL:-}",
        "slack_webhook": "${SLACK_WEBHOOK_URL:-}",
        "email_recipients": "${ALERT_EMAIL:-}",
        "pagerduty_key": "${PAGERDUTY_KEY:-}"
    }
}
EOF

    log_monitoring "INFO" "Created default alert configuration"
}

# Test API connectivity
test_api_connectivity() {
    log_monitoring "DEBUG" "Testing API connectivity..."

    local endpoints=(
        "https://$API_DOMAIN/health"
        "https://$API_DOMAIN/api/v1/status"
        "https://$ADMIN_DOMAIN/health"
    )

    local all_connected=true

    for endpoint in "${endpoints[@]}"; do
        if curl -f -s -m 5 "$endpoint" > /dev/null 2>&1; then
            log_monitoring "DEBUG" "✓ $endpoint - Connected"
        else
            log_monitoring "WARN" "✗ $endpoint - Connection failed"
            all_connected=false
        fi
    done

    if [[ "$all_connected" = true ]]; then
        log_monitoring "INFO" "All endpoints reachable"
    else
        log_monitoring "WARN" "Some endpoints are not reachable"
    fi
}

# Collect Cloudflare metrics
collect_cloudflare_metrics() {
    local timestamp=$(date -Iseconds)

    log_monitoring "DEBUG" "Collecting Cloudflare metrics..."

    # Get analytics data
    local analytics_data
    analytics_data=$(wrangler analytics --since 5m --format json 2>/dev/null || echo '{"data": []}')

    # Get request counts
    local total_requests
    total_requests=$(echo "$analytics_data" | jq -r '.data[0].requests // 0' 2>/dev/null || echo "0")

    # Get error rates
    local error_rate
    error_rate=$(echo "$analytics_data" | jq -r '.data[0].error_rate // 0' 2>/dev/null || echo "0")

    # Get response times
    local avg_response_time
    avg_response_time=$(echo "$analytics_data" | jq -r '.data[0].avg_response_time // 0' 2>/dev/null || echo "0")

    local p95_response_time
    p95_response_time=$(echo "$analytics_data" | jq -r '.data[0].p95_response_time // 0' 2>/dev/null || echo "0")

    # Get bandwidth
    local bandwidth_egress
    bandwidth_egress=$(echo "$analytics_data" | jq -r '.data[0].bandwidth_egress // 0' 2>/dev/null || echo "0")

    local bandwidth_ingress
    bandwidth_ingress=$(echo "$analytics_data" | jq -r '.data[0].bandwidth_ingress // 0' 2>/dev/null || echo "0")

    # Get unique visitors
    local unique_visitors
    unique_visitors=$(echo "$analytics_data" | jq -r '.data[0].unique_visitors // 0' 2>/dev/null || echo "0")

    # Create metrics entry
    local metrics_entry
    metrics_entry=$(jq -n \
        --arg timestamp "$timestamp" \
        --argjson requests "$total_requests" \
        --argjson error_rate "$error_rate" \
        --argjson avg_response_time "$avg_response_time" \
        --argjson p95_response_time "$p95_response_time" \
        --argjson bandwidth_egress "$bandwidth_egress" \
        --argjson bandwidth_ingress "$bandwidth_ingress" \
        --argjson unique_visitors "$unique_visitors" \
        '{
            timestamp: $timestamp,
            cloudflare: {
                requests: $requests,
                error_rate: $error_rate,
                avg_response_time: $avg_response_time,
                p95_response_time: $p95_response_time,
                bandwidth_egress: $bandwidth_egress,
                bandwidth_ingress: $bandwidth_ingress,
                unique_visitors: $unique_visitors
            }
        }')

    echo "$metrics_entry"
}

# Collect application metrics
collect_application_metrics() {
    local timestamp=$(date -Iseconds)

    log_monitoring "DEBUG" "Collecting application metrics..."

    # Health check metrics
    local health_status=0
    local health_response_time=0

    local start_time=$(date +%s%3N)
    if curl -f -s -m 5 "https://$API_DOMAIN/health" > /dev/null 2>&1; then
        health_status=1
    fi
    local end_time=$(date +%s%3N)
    health_response_time=$((end_time - start_time))

    # API endpoint metrics
    local api_endpoints=(
        "/api/v1/status"
        "/api/v1/metrics"
        "/api/v1/health/database"
        "/api/v1/health/cache"
    )

    local endpoint_metrics=""
    for endpoint in "${api_endpoints[@]}"; do
        local url="https://$API_DOMAIN$endpoint"
        local status_code=0
        local response_time=0

        start_time=$(date +%s%3N)
        status_code=$(curl -s -o /dev/null -w "%{http_code}" -m 5 "$url" 2>/dev/null || echo "000")
        end_time=$(date +%s%3N)
        response_time=$((end_time - start_time))

        endpoint_metrics+=$(jq -n \
            --arg endpoint "$endpoint" \
            --argjson status_code "$status_code" \
            --argjson response_time "$response_time" \
            '{
                endpoint: $endpoint,
                status_code: $status_code,
                response_time: $response_time,
                healthy: ($status_code >= 200 and $status_code < 300)
            }')
    done

    # Create application metrics entry
    local app_metrics
    app_metrics=$(jq -n \
        --arg timestamp "$timestamp" \
        --argjson health_status "$health_status" \
        --argjson health_response_time "$health_response_time" \
        --argjson endpoints "[$endpoint_metrics]" \
        '{
            timestamp: $timestamp,
            application: {
                health_status: $health_status,
                health_response_time: $health_response_time,
                endpoints: $endpoints
            }
        }')

    echo "$app_metrics"
}

# Collect infrastructure metrics
collect_infrastructure_metrics() {
    local timestamp=$(date -Iseconds)

    log_monitoring "DEBUG" "Collecting infrastructure metrics..."

    # Worker metrics (simulated - would need real integration)
    local worker_cpu_usage=0
    local worker_memory_usage=0

    # Database metrics
    local db_status=0
    local db_connections=0
    local db_response_time=0

    # Test database connectivity
    local start_time=$(date +%s%3N)
    if curl -f -s -m 5 "https://$API_DOMAIN/api/v1/health/database" > /dev/null 2>&1; then
        db_status=1
    fi
    local end_time=$(date +%s%3N)
    db_response_time=$((end_time - start_time))

    # Cache metrics
    local cache_status=0
    local cache_hit_rate=0

    # Test cache connectivity
    if curl -f -s -m 5 "https://$API_DOMAIN/api/v1/health/cache" > /dev/null 2>&1; then
        cache_status=1
    fi

    # Create infrastructure metrics entry
    local infra_metrics
    infra_metrics=$(jq -n \
        --arg timestamp "$timestamp" \
        --argjson worker_cpu "$worker_cpu_usage" \
        --argjson worker_memory "$worker_memory_usage" \
        --argjson db_status "$db_status" \
        --argjson db_connections "$db_connections" \
        --argjson db_response_time "$db_response_time" \
        --argjson cache_status "$cache_status" \
        --argjson cache_hit_rate "$cache_hit_rate" \
        '{
            timestamp: $timestamp,
            infrastructure: {
                worker: {
                    cpu_usage: $worker_cpu,
                    memory_usage: $worker_memory
                },
                database: {
                    status: $db_status,
                    connections: $db_connections,
                    response_time: $db_response_time
                },
                cache: {
                    status: $cache_status,
                    hit_rate: $cache_hit_rate
                }
            }
        }')

    echo "$infra_metrics"
}

# Update metrics file
update_metrics() {
    local cf_metrics
    local app_metrics
    local infra_metrics

    # Collect all metrics
    cf_metrics=$(collect_cloudflare_metrics)
    app_metrics=$(collect_application_metrics)
    infra_metrics=$(collect_infrastructure_metrics)

    # Merge metrics
    local combined_metrics
    combined_metrics=$(jq -n \
        --argjson cf "$cf_metrics" \
        --argjson app "$app_metrics" \
        --argjson infra "$infra_metrics" \
        '$cf * $app * $infra')

    # Update metrics file
    local temp_file="${METRICS_FILE}.tmp"
    jq --argjson new_metrics "$combined_metrics" \
       '.metrics += [$new_metrics]' \
       "$METRICS_FILE" > "$temp_file" && mv "$temp_file" "$METRICS_FILE"

    # Update summary
    update_metrics_summary

    log_monitoring "DEBUG" "Metrics updated"
}

# Update metrics summary
update_metrics_summary() {
    local summary
    summary=$(jq -r '
        .summary = {
            total_requests: (.metrics | map(.cloudflare.requests) | add // 0),
            error_count: (.metrics | map(.cloudflare.requests * .cloudflare.error_rate / 100) | add // 0),
            avg_response_time: (.metrics | map(.cloudflare.avg_response_time) | add / length | round),
            peak_response_time: (.metrics | map(.cloudflare.p95_response_time) | max // 0),
            uptime_percentage: (.metrics | map(.application.health_status) | add / length * 100 | round)
        }
    ' "$METRICS_FILE")

    echo "$summary" > "${METRICS_FILE}.tmp" && mv "${METRICS_FILE}.tmp" "$METRICS_FILE"
}

# Check alerts
check_alerts() {
    local current_time=$(date +%s)

    # Check cooldown
    if [[ $((current_time - LAST_ALERT_TIME)) -lt $ALERT_COOLDOWN ]]; then
        return 0
    fi

    log_monitoring "DEBUG" "Checking alert conditions..."

    # Get current metrics
    local current_metrics
    current_metrics=$(jq -r '.metrics[-1]' "$METRICS_FILE" 2>/dev/null || echo "{}")

    # Check error rate
    local error_rate
    error_rate=$(echo "$current_metrics" | jq -r '.cloudflare.error_rate // 0')
    local error_threshold
    error_threshold=$(jq -r '.alerts.error_rate.threshold' "$ALERT_CONFIG_FILE")

    if (( $(echo "$error_rate > $error_threshold" | bc -l) )); then
        trigger_alert "error_rate" "High error rate: ${error_rate}%" "critical"
        return 0
    fi

    # Check response time
    local response_time
    response_time=$(echo "$current_metrics" | jq -r '.cloudflare.avg_response_time // 0')
    local response_threshold
    response_threshold=$(jq -r '.alerts.response_time.threshold_ms' "$ALERT_CONFIG_FILE")

    if [[ $response_time -gt $response_threshold ]]; then
        trigger_alert "response_time" "High response time: ${response_time}ms" "warning"
        return 0
    fi

    # Check availability
    local health_status
    health_status=$(echo "$current_metrics" | jq -r '.application.health_status // 0')

    if [[ "$health_status" -eq 0 ]]; then
        trigger_alert "availability" "Service unavailable" "critical"
        return 0
    fi

    # Check database status
    local db_status
    db_status=$(echo "$current_metrics" | jq -r '.infrastructure.database.status // 0')

    if [[ "$db_status" -eq 0 ]]; then
        trigger_alert "database" "Database unavailable" "critical"
        return 0
    fi

    log_monitoring "DEBUG" "All alert checks passed"
}

# Trigger alert
trigger_alert() {
    local alert_type="$1"
    local message="$2"
    local severity="$3"
    local timestamp=$(date -Iseconds)
    local current_time=$(date +%s)

    LAST_ALERT_TIME=$current_time

    log_monitoring "WARN" "ALERT: $message"

    # Create alert entry
    local alert_entry
    alert_entry=$(jq -n \
        --arg type "$alert_type" \
        --arg message "$message" \
        --arg severity "$severity" \
        --arg timestamp "$timestamp" \
        '{
            type: $type,
            message: $message,
            severity: $severity,
            timestamp: $timestamp,
            resolved: false
        }')

    # Update metrics file with alert
    local temp_file="${METRICS_FILE}.tmp"
    jq --argjson alert "$alert_entry" \
       '.alerts += [$alert]' \
       "$METRICS_FILE" > "$temp_file" && mv "$temp_file" "$METRICS_FILE"

    # Send notifications
    send_alert_notification "$alert_type" "$message" "$severity"

    # Log to alerts file
    local alert_file="$ALERTS_DIR/alerts-$(date +%Y%m%d).json"
    if [[ ! -f "$alert_file" ]]; then
        echo '{"alerts": []}' > "$alert_file"
    fi

    jq --argjson alert "$alert_entry" \
       '.alerts += [$alert]' \
       "$alert_file" > "${alert_file}.tmp" && mv "${alert_file}.tmp" "$alert_file"
}

# Send alert notifications
send_alert_notification() {
    local alert_type="$1"
    local message="$2"
    local severity="$3"

    # Get notification config
    local webhook_url
    webhook_url=$(jq -r '.notifications.webhook_url' "$ALERT_CONFIG_FILE")

    local slack_webhook
    slack_webhook=$(jq -r '.notifications.slack_webhook' "$ALERT_CONFIG_FILE")

    # Create notification payload
    local payload
    payload=$(jq -n \
        --arg type "$alert_type" \
        --arg message "$message" \
        --arg severity "$severity" \
        --arg platform "$PLATFORM_NAME" \
        --arg domain "$PRODUCTION_DOMAIN" \
        --arg timestamp "$(date -Iseconds)" \
        '{
            alert_type: $type,
            message: $message,
            severity: $severity,
            platform: $platform,
            domain: $domain,
            timestamp: $timestamp
        }')

    # Send webhook notification
    if [[ -n "$webhook_url" && "$webhook_url" != "null" ]]; then
        curl -s -X POST "$webhook_url" \
            -H "Content-Type: application/json" \
            -d "$payload" &>/dev/null || true
        log_monitoring "DEBUG" "Webhook notification sent"
    fi

    # Send Slack notification
    if [[ -n "$slack_webhook" && "$slack_webhook" != "null" ]]; then
        local slack_color="warning"
        case $severity in
            "critical") slack_color="danger" ;;
            "warning") slack_color="warning" ;;
            "info") slack_color="good" ;;
        esac

        local slack_payload
        slack_payload=$(jq -n \
            --arg text "🚨 Alert: $message" \
            --arg color "$slack_color" \
            --arg platform "$PLATFORM_NAME" \
            --arg severity "$severity" \
            --arg timestamp "$(date)" \
            '{
                text: $text,
                attachments: [{
                    color: $color,
                    fields: [
                        {title: "Platform", value: $platform, short: true},
                        {title: "Severity", value: $severity, short: true},
                        {title: "Alert", value: $message, short: false},
                        {title: "Time", value: $timestamp, short: true}
                    ]
                }]
            }')

        curl -s -X POST "$slack_webhook" \
            -H "Content-Type: application/json" \
            -d "$slack_payload" &>/dev/null || true
        log_monitoring "DEBUG" "Slack notification sent"
    fi

    # Send email notification (if configured)
    local email_recipients
    email_recipients=$(jq -r '.notifications.email_recipients' "$ALERT_CONFIG_FILE")

    if [[ -n "$email_recipients" && "$email_recipients" != "null" ]]; then
        local email_subject="SDLC Alert [$severity]: $message"
        local email_body="Alert Details:\n\nType: $alert_type\nMessage: $message\nSeverity: $severity\nPlatform: $PLATFORM_NAME\nTimestamp: $(date)\n\nPlease check the monitoring dashboard for more details."

        echo "$email_body" | mail -s "$email_subject" "$email_recipients" 2>/dev/null || true
        log_monitoring "DEBUG" "Email notification sent"
    fi
}

# Generate monitoring report
generate_report() {
    local report_type="${1:-summary}"
    local report_file="$REPORTS_DIR/monitoring-report-$(date +%Y%m%d-%H%M%S).md"

    log_monitoring "INFO" "Generating $report_type report: $report_file"

    local summary
    summary=$(jq -r '.summary' "$METRICS_FILE" 2>/dev/null || echo "{}")

    local total_requests
    total_requests=$(echo "$summary" | jq -r '.total_requests // 0')

    local avg_response_time
    avg_response_time=$(echo "$summary" | jq -r '.avg_response_time // 0')

    local uptime_percentage
    uptime_percentage=$(echo "$summary" | jq -r '.uptime_percentage // 0')

    cat > "$report_file" << EOF
# SDLC.ai Platform Monitoring Report

**Generated:** $(date)
**Report Type:** $report_type
**Platform:** $PLATFORM_NAME
**Domain:** $PRODUCTION_DOMAIN

## Executive Summary

- **Total Requests:** $total_requests
- **Average Response Time:** ${avg_response_time}ms
- **Uptime:** ${uptime_percentage}%
- **Monitoring Period:** Since $(jq -r '.metadata.start_time' "$METRICS_FILE")

## Performance Metrics

### Cloudflare Analytics
- Total Requests: $total_requests
- Average Response Time: ${avg_response_time}ms
- Error Rate: $(jq -r '.summary.error_count' "$METRICS_FILE") errors

### Application Health
- API Health: $(jq -r '.metrics[-1].application.health_status // "Unknown"')
- Health Check Response: $(jq -r '.metrics[-1].application.health_response_time // 0')ms

### Infrastructure Status
- Database: $(jq -r '.metrics[-1].infrastructure.database.status // "Unknown"')
- Cache: $(jq -r '.metrics[-1].infrastructure.cache.status // "Unknown"')

## Recent Alerts

$(jq -r '.alerts[-5:] | reverse | .[] | "- \(.timestamp | strftime("%Y-%m-%d %H:%M:%S")) - \(.severity): \(.message)"' "$METRICS_FILE" 2>/dev/null || echo "No recent alerts")

## Recommendations

1. Monitor error rates closely if above 5%
2. Investigate response times exceeding 1000ms
3. Ensure database connections remain healthy
4. Review alert patterns for optimization needs

---

*Report generated by SDLC Monitoring System v1.0*
EOF

    log_monitoring "INFO" "Report generated: $report_file"

    # Send report if configured
    if [[ -n "${REPORT_EMAIL:-}" ]]; then
        mail -s "SDLC Monitoring Report - $(date)" "$REPORT_EMAIL" < "$report_file" 2>/dev/null || true
    fi
}

# Start monitoring daemon
start_monitoring() {
    if [[ "$MONITORING_ACTIVE" = true ]]; then
        log_monitoring "WARN" "Monitoring is already active"
        return 1
    fi

    log_monitoring "INFO" "Starting monitoring daemon..."

    # Initialize monitoring
    initialize_monitoring

    MONITORING_ACTIVE=true

    # Start monitoring loop
    (
        while [[ "$MONITORING_ACTIVE" = true ]]; do
            update_metrics
            check_alerts
            sleep $MONITORING_INTERVAL
        done
    ) &

    MONITORING_PID=$!

    log_monitoring "INFO" "Monitoring started (PID: $MONITORING_PID)"
    log_monitoring "INFO" "Monitoring interval: ${MONITORING_INTERVAL}s"

    # Setup signal handlers
    trap 'stop_monitoring; exit 0' INT TERM
}

# Stop monitoring daemon
stop_monitoring() {
    if [[ "$MONITORING_ACTIVE" = false ]]; then
        log_monitoring "WARN" "Monitoring is not active"
        return 1
    fi

    log_monitoring "INFO" "Stopping monitoring daemon..."

    MONITORING_ACTIVE=false

    if [[ -n "$MONITORING_PID" ]]; then
        kill "$MONITORING_PID" 2>/dev/null || true
        wait "$MONITORING_PID" 2>/dev/null || true
    fi

    log_monitoring "INFO" "Monitoring stopped"

    # Generate final report
    generate_report "final"
}

# Show monitoring status
show_status() {
    if [[ "$MONITORING_ACTIVE" = true ]]; then
        log_monitoring "INFO" "Status: ACTIVE (PID: $MONITORING_PID)"
        log_monitoring "INFO" "Metrics file: $METRICS_FILE"
        log_monitoring "INFO" "Monitoring interval: ${MONITORING_INTERVAL}s"

        # Show latest metrics
        if [[ -f "$METRICS_FILE" ]]; then
            local latest_metrics
            latest_metrics=$(jq -r '.metrics[-1]' "$METRICS_FILE" 2>/dev/null || echo "{}")

            echo ""
            echo "Latest Metrics:"
            echo "- Requests: $(echo "$latest_metrics" | jq -r '.cloudflare.requests // 0')"
            echo "- Error Rate: $(echo "$latest_metrics" | jq -r '.cloudflare.error_rate // 0')%"
            echo "- Response Time: $(echo "$latest_metrics" | jq -r '.cloudflare.avg_response_time // 0')ms"
            echo "- Health Status: $(echo "$latest_metrics" | jq -r '.application.health_status // "Unknown"')"
        fi
    else
        log_monitoring "INFO" "Status: INACTIVE"
    fi
}

# Cleanup old metrics
cleanup_old_metrics() {
    log_monitoring "INFO" "Cleaning up old metrics files..."

    # Remove metrics files older than retention period
    find "$METRICS_DIR" -name "metrics-*.json" -mtime +$((METRICS_RETENTION_HOURS / 24)) -delete 2>/dev/null || true

    # Remove old alert files
    find "$ALERTS_DIR" -name "alerts-*.json" -mtime +7 -delete 2>/dev/null || true

    # Remove old log files
    find "$LOGS_DIR" -name "*.log" -mtime +7 -delete 2>/dev/null || true

    log_monitoring "INFO" "Cleanup completed"
}

# Main function
main() {
    local command="${1:-help}"

    case $command in
        "start")
            start_monitoring
            log_monitoring "INFO" "Monitoring active. Press Ctrl+C to stop."
            sleep infinity
            ;;
        "stop")
            stop_monitoring
            ;;
        "status")
            show_status
            ;;
        "report")
            generate_report "${2:-summary}"
            ;;
        "metrics")
            if [[ -f "$METRICS_FILE" ]]; then
                jq '.' "$METRICS_FILE"
            else
                log_monitoring "WARN" "No metrics file found"
            fi
            ;;
        "alerts")
            if [[ -f "$ALERT_CONFIG_FILE" ]]; then
                jq '.' "$ALERT_CONFIG_FILE"
            else
                log_monitoring "WARN" "No alert configuration found"
            fi
            ;;
        "cleanup")
            cleanup_old_metrics
            ;;
        "help"|"-h"|"--help")
            cat << EOF
SDLC.ai Platform Production Monitoring System

Usage: $0 COMMAND [OPTIONS]

Commands:
    start                  Start monitoring daemon
    stop                   Stop monitoring daemon
    status                 Show monitoring status
    report [TYPE]          Generate report (summary, detailed)
    metrics                Show current metrics
    alerts                 Show alert configuration
    cleanup                Clean up old metrics files
    help                   Show this help

Examples:
    $0 start               # Start monitoring
    $0 status              # Show current status
    $0 report detailed     # Generate detailed report

Environment Variables:
    LOG_LEVEL              Logging level (info, debug)
    WEBHOOK_URL            Notification webhook URL
    SLACK_WEBHOOK_URL      Slack webhook URL
    ALERT_EMAIL            Email for alerts
    REPORT_EMAIL           Email for reports
    PAGERDUTY_KEY          PagerDuty integration key

Features:
    - Real-time metrics collection
    - Intelligent alerting
    - Performance monitoring
    - Error detection
    - Automated notifications
    - Report generation
    - Historical data retention

EOF
            ;;
        *)
            log_monitoring "ERROR" "Unknown command: $command"
            echo "Use '$0 help' for usage information"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
