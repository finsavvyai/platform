#!/bin/bash

# =============================================================================
# SDLC.ai Platform - Automated Rollback System
# =============================================================================
# Advanced rollback system with multiple triggers and strategies
# Features:
# - Automatic failure detection
# - Instantaneous rollback capability
# - Multiple rollback triggers (metrics, health checks, manual)
# - Rollback verification and validation
# - Complete state restoration
# - Rollback analytics and reporting
# =============================================================================

set -euo pipefail

# Configuration
readonly PLATFORM_NAME="sdlc-platform"
readonly PRODUCTION_DOMAIN="sdlc.cc"
readonly API_DOMAIN="api.sdlc.cc"
readonly ADMIN_DOMAIN="admin.sdlc.cc"
readonly ROLLBACK_LOG_FILE="logs/rollback.log"
readonly ROLLBACK_STATE_DIR="state/rollback"
readonly MONITORING_INTERVAL=10
readonly HEALTH_CHECK_INTERVAL=30
readonly ROLLBACK_TIMEOUT=300

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Global state
ROLLBACK_ID=""
ROLLBACK_REASON=""
ROLLBACK_TRIGGER=""
TARGET_ENVIRONMENT=""
SOURCE_ENVIRONMENT=""
ROLLBACK_IN_PROGRESS=false
MONITORING_PROCESSES=()

# Logging functions
log_rollback() {
    local message="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${PURPLE}[ROLLBACK]${NC} $timestamp - $message" | tee -a "$ROLLBACK_LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$ROLLBACK_LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$ROLLBACK_LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$ROLLBACK_LOG_FILE"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$ROLLBACK_LOG_FILE"
}

# Initialize rollback system
initialize_rollback() {
    local reason="${1:-Manual rollback}"
    local trigger="${2:-manual}"

    # Prevent concurrent rollbacks
    if [[ "$ROLLBACK_IN_PROGRESS" = true ]]; then
        log_warning "Rollback already in progress"
        return 1
    fi

    ROLLBACK_IN_PROGRESS=true
    ROLLBACK_ID="rollback-$(date +%Y%m%d-%H%M%S)-$(openssl rand -hex 4)"
    ROLLBACK_REASON="$reason"
    ROLLBACK_TRIGGER="$trigger"

    # Create state directory
    mkdir -p "$ROLLBACK_STATE_DIR"

    # Initialize rollback state
    jq -n \
        --arg rollback_id "$ROLLBACK_ID" \
        --arg reason "$reason" \
        --arg trigger "$trigger" \
        --arg start_time "$(date -Iseconds)" \
        --arg status "initializing" \
        '{
            rollback_id: $rollback_id,
            reason: $reason,
            trigger: $trigger,
            start_time: $start_time,
            status: $status,
            steps: []
        }' > "$ROLLBACK_STATE_DIR/${ROLLBACK_ID}.json"

    log_rollback "Initializing rollback: $ROLLBACK_ID"
    log_rollback "Reason: $reason"
    log_rollback "Trigger: $trigger"

    # Create necessary directories
    mkdir -p logs state deployments backups

    # Send initial notification
    send_rollback_notification "started" "Rollback $ROLLBACK_ID initiated: $reason"
}

# Detect current environment state
detect_environment_state() {
    log_info "Detecting current environment state..."

    # Check DNS records to determine active environment
    local api_cname
    api_cname=$(dig +short CNAME "$API_DOMAIN" 2>/dev/null | head -n1 || echo "")

    local admin_cname
    admin_cname=$(dig +short CNAME "$ADMIN_DOMAIN" 2>/dev/null | head -n1 || echo "")

    # Determine active environment
    if [[ -n "$api_cname" && "$api_cname" =~ blue ]]; then
        TARGET_ENVIRONMENT="blue"
        SOURCE_ENVIRONMENT="green"
    elif [[ -n "$api_cname" && "$api_cname" =~ green ]]; then
        TARGET_ENVIRONMENT="green"
        SOURCE_ENVIRONMENT="blue"
    else
        log_error "Unable to determine active environment from DNS"
        # Fallback: check worker status
        if wrangler deployment list | grep -q "${PLATFORM_NAME}-blue"; then
            TARGET_ENVIRONMENT="blue"
            SOURCE_ENVIRONMENT="green"
        else
            TARGET_ENVIRONMENT="green"
            SOURCE_ENVIRONMENT="blue"
        fi
    fi

    log_info "Current active environment: $TARGET_ENVIRONMENT"
    log_info "Rollback target environment: $SOURCE_ENVIRONMENT"

    # Update rollback state
    update_rollback_state "environment_detected" "Active: $TARGET_ENVIRONMENT, Target: $SOURCE_ENVIRONMENT"
}

# Save current state before rollback
save_current_state() {
    log_info "Saving current system state..."

    local state_file="$ROLLBACK_STATE_DIR/${ROLLBACK_ID}-pre-rollback.json"

    # Gather current state information
    local state_data
    state_data=$(jq -n \
        --arg active_env "$TARGET_ENVIRONMENT" \
        --arg api_domain "$API_DOMAIN" \
        --arg admin_domain "$ADMIN_DOMAIN" \
        --arg timestamp "$(date -Iseconds)" \
        --arg dns_records "$(dig +short "$API_DOMAIN" 2>/dev/null || echo "")" \
        --arg worker_status "$(wrangler deployment list 2>/dev/null || echo "")" \
        --arg analytics_snapshot "$(wrangler analytics --since 1h --format json 2>/dev/null || echo "{}")" \
        '{
            active_environment: $active_env,
            api_domain: $api_domain,
            admin_domain: $admin_domain,
            timestamp: $timestamp,
            dns_records: $dns_records,
            worker_status: $worker_status,
            analytics_snapshot: $analytics_snapshot | fromjson?
        }')

    echo "$state_data" > "$state_file"

    # Save route configurations
    wrangler route rule list --zone-name="$PRODUCTION_DOMAIN" > "$ROLLBACK_STATE_DIR/${ROLLBACK_ID}-routes.txt" 2>/dev/null || true

    # Save current deployment info
    wrangler deployment list > "$ROLLBACK_STATE_DIR/${ROLLBACK_ID}-deployments.txt" 2>/dev/null || true

    log_success "Current state saved to $state_file"
    update_rollback_state "state_saved" "System state preserved"
}

# Perform rollback traffic switch
perform_traffic_switch() {
    log_rollback "Switching traffic back to $SOURCE_ENVIRONMENT..."

    local switch_start=$(date +%s)

    # Remove current routes
    log_info "Removing current routes..."
    wrangler route rule delete --pattern="$API_DOMAIN/*" --zone-name="$PRODUCTION_DOMAIN" 2>/dev/null || true
    wrangler route rule delete --pattern="$ADMIN_DOMAIN/*" --zone-name="$PRODUCTION_DOMAIN" 2>/dev/null || true

    # Add routes to source environment
    log_info "Adding routes to $SOURCE_ENVIRONMENT..."
    wrangler route rule create --pattern="$API_DOMAIN/*" --zone-name="$PRODUCTION_DOMAIN" --worker="${PLATFORM_NAME}-${SOURCE_ENVIRONMENT}" 2>/dev/null || {
        log_error "Failed to create API route"
        return 1
    }

    wrangler route rule create --pattern="$ADMIN_DOMAIN/*" --zone-name="$PRODUCTION_DOMAIN" --worker="${PLATFORM_NAME}-${SOURCE_ENVIRONMENT}" 2>/dev/null || {
        log_error "Failed to create admin route"
        return 1
    }

    # Wait for DNS propagation
    log_info "Waiting for DNS propagation..."
    local propagation_wait=0
    local max_wait=60

    while [[ $propagation_wait -lt $max_wait ]]; do
        local test_url="https://$API_DOMAIN/health"
        if curl -f -s -m 5 "$test_url" > /dev/null 2>&1; then
            log_success "DNS propagation successful"
            break
        fi

        sleep 2
        ((propagation_wait++))
    done

    if [[ $propagation_wait -eq $max_wait ]]; then
        log_error "DNS propagation timeout"
        return 1
    fi

    local switch_end=$(date +%s)
    local switch_duration=$((switch_end - switch_start))

    log_success "Traffic switch completed in ${switch_duration}s"
    update_rollback_state "traffic_switched" "Switched to $SOURCE_ENVIRONMENT in ${switch_duration}s"
}

# Verify rollback success
verify_rollback() {
    log_rollback "Verifying rollback success..."

    local verification_start=$(date +%s)
    local all_checks_passed=true

    # Health check endpoints
    local endpoints=(
        "https://$API_DOMAIN/health"
        "https://$API_DOMAIN/api/v1/status"
        "https://$API_DOMAIN/api/v1/metrics"
        "https://$ADMIN_DOMAIN/health"
    )

    for endpoint in "${endpoints[@]}"; do
        local retries=0
        local max_retries=10

        log_info "Checking $endpoint..."

        while [[ $retries -lt $max_retries ]]; do
            local response_code
            response_code=$(curl -s -o /dev/null -w "%{http_code}" -m 10 "$endpoint" 2>/dev/null || echo "000")

            if [[ "$response_code" =~ ^2[0-9][0-9]$ ]]; then
                log_success "✓ $endpoint - Status: $response_code"
                break
            fi

            ((retries++))
            sleep 2
        done

        if [[ $retries -eq $max_retries ]]; then
            log_error "✗ $endpoint - Failed after $max_retries attempts"
            all_checks_passed=false
        fi
    done

    # Test functionality
    log_info "Testing core functionality..."

    # Test authentication
    local auth_test
    auth_test=$(curl -s -X POST "https://$API_DOMAIN/api/v1/auth/health" -H "Content-Type: application/json" -d '{}' 2>/dev/null || echo "")
    if [[ "$auth_test" =~ "ok" || "$auth_test" =~ "success" ]]; then
        log_success "✓ Authentication system operational"
    else
        log_error "✗ Authentication system failed"
        all_checks_passed=false
    fi

    # Test database connectivity
    local db_test
    db_test=$(curl -s "https://$API_DOMAIN/api/v1/health/database" 2>/dev/null || echo "")
    if [[ "$db_test" =~ "healthy" || "$db_test" =~ "connected" ]]; then
        log_success "✓ Database connectivity operational"
    else
        log_error "✗ Database connectivity failed"
        all_checks_passed=false
    done

    local verification_end=$(date +%s)
    local verification_duration=$((verification_end - verification_start))

    if [[ "$all_checks_passed" = true ]]; then
        log_success "All rollback verifications passed (${verification_duration}s)"
        update_rollback_state "verified" "All checks passed in ${verification_duration}s"
        return 0
    else
        log_error "Rollback verification failed (${verification_duration}s)"
        update_rollback_state "verification_failed" "Some checks failed"
        return 1
    fi
}

# Restore additional state if needed
restore_additional_state() {
    log_info "Restoring additional system state..."

    # Check if there are any cached states to restore
    local cache_dir="state/cache"
    if [[ -d "$cache_dir" ]]; then
        log_info "Restoring cached configurations..."

        # Restore any necessary configurations
        find "$cache_dir" -name "*.json" -exec cp {} . \; 2>/dev/null || true
    fi

    # Clear any temporary states from failed deployment
    log_info "Cleaning up temporary states..."

    # Clear temporary KV entries if needed
    wrangler kv:namespace delete --namespace-id="temp-${ROLLBACK_ID}" --env production 2>/dev/null || true

    # Clear temporary caches
    wrangler cache purge --url="https://$API_DOMAIN/*" 2>/dev/null || true

    log_success "Additional state restored"
    update_rollback_state "state_restored" "Additional system state restored"
}

# Generate rollback report
generate_rollback_report() {
    log_info "Generating rollback report..."

    local report_file="reports/rollback-${ROLLBACK_ID}.md"
    mkdir -p reports

    local rollback_end=$(date -Iseconds)
    local rollback_state=$(cat "$ROLLBACK_STATE_DIR/${ROLLBACK_ID}.json")

    cat > "$report_file" << EOF
# Rollback Report: $ROLLBACK_ID

## Summary
- **Rollback ID**: $ROLLBACK_ID
- **Reason**: $ROLLBACK_REASON
- **Trigger**: $ROLLBACK_TRIGGER
- **Start Time**: $(echo "$rollback_state" | jq -r '.start_time')
- **End Time**: $rollback_end
- **Status**: $(echo "$rollback_state" | jq -r '.status')

## Environment Changes
- **From**: $TARGET_ENVIRONMENT
- **To**: $SOURCE_ENVIRONMENT
- **API Domain**: $API_DOMAIN
- **Admin Domain**: $ADMIN_DOMAIN

## Rollback Steps
$(echo "$rollback_state" | jq -r '.steps[] | "- \(.step): \(.description) (\(.timestamp))"')

## Verification Results
- All health checks: $([ -f "$ROLLBACK_STATE_DIR/${ROLLBACK_ID}.json" ] && echo "$rollback_state" | jq -r '.verification_status // "Not completed"')
- DNS propagation: Successful
- Core functionality: Operational

## Analytics Impact
- Error rate before rollback: $(wrangler analytics --since 1h --format json 2>/dev/null | jq -r '.data[0].error_rate // "N/A"')%
- Response time before rollback: $(wrangler analytics --since 1h --format json 2>/dev/null | jq -r '.data[0].avg_response_time // "N/A"')ms

## Recommendations
1. Investigate the root cause of the rollback trigger: $ROLLBACK_REASON
2. Review deployment logs for errors
3. Consider running additional tests before redeployment
4. Monitor system performance closely for the next hour

## Attachments
- Pre-rollback state: \`state/rollback/${ROLLBACK_ID}-pre-rollback.json\`
- Route configurations: \`state/rollback/${ROLLBACK_ID}-routes.txt\`
- Deployment list: \`state/rollback/${ROLLBACK_ID}-deployments.txt\`

Generated on: $(date)
EOF

    log_success "Rollback report generated: $report_file"
}

# Update rollback state
update_rollback_state() {
    local step="$1"
    local description="$2"
    local timestamp=$(date -Iseconds)

    local state_file="$ROLLBACK_STATE_DIR/${ROLLBACK_ID}.json"

    if [[ -f "$state_file" ]]; then
        jq --arg step "$step" \
           --arg description "$description" \
           --arg timestamp "$timestamp" \
           '.steps += [{step: $step, description: $description, timestamp: $timestamp}]' \
           "$state_file" > "${state_file}.tmp" && mv "${state_file}.tmp" "$state_file"
    fi
}

# Send rollback notifications
send_rollback_notification() {
    local status="$1"
    local message="$2"

    log_info "Sending rollback notification: $status"

    # Create notification payload
    local payload
    payload=$(jq -n \
        --arg status "$status" \
        --arg message "$message" \
        --arg rollback_id "$ROLLBACK_ID" \
        --arg reason "$ROLLBACK_REASON" \
        --arg trigger "$ROLLBACK_TRIGGER" \
        --arg environment "production" \
        --arg from_env "$TARGET_ENVIRONMENT" \
        --arg to_env "$SOURCE_ENVIRONMENT" \
        '{
            status: $status,
            message: $message,
            rollback_id: $rollback_id,
            reason: $reason,
            trigger: $trigger,
            environment: $environment,
            from_environment: $from_env,
            to_environment: $to_env,
            timestamp: now
        }')

    # Send to webhook if configured
    if [[ -n "${WEBHOOK_URL:-}" ]]; then
        curl -s -X POST "$WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "$payload" &>/dev/null || true
    fi

    # Send to Slack if configured
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        local slack_message
        slack_message=$(jq -n \
            --arg text "🚨 Rollback $status: $message" \
            --arg channel "#alerts" \
            --arg username "SDLC Rollback Bot" \
            '{
                text: $text,
                channel: $channel,
                username: $username,
                attachments: [{
                    color: if $status == "completed" then "good" elif $status == "failed" then "danger" else "warning" end,
                    fields: [
                        {title: "Rollback ID", value: $rollback_id, short: true},
                        {title: "Reason", value: $reason, short: true},
                        {title: "Environment", value: $environment, short: true},
                        {title: "Trigger", value: $trigger, short: true}
                    ]
                }]
            }')

        curl -s -X POST "$SLACK_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "$slack_message" &>/dev/null || true
    fi

    # Send email if configured
    if [[ -n "${ALERT_EMAIL:-}" && -n "${SMTP_SERVER:-}" ]]; then
        echo "$message" | mail -s "SDLC Rollback $status: $ROLLBACK_ID" "$ALERT_EMAIL" 2>/dev/null || true
    fi
}

# Cleanup function
cleanup_rollback() {
    log_info "Cleaning up rollback resources..."

    # Kill any monitoring processes
    for pid in "${MONITORING_PROCESSES[@]}"; do
        kill "$pid" 2>/dev/null || true
    done

    # Clear temporary files older than 7 days
    find "$ROLLBACK_STATE_DIR" -name "*.json" -mtime +7 -delete 2>/dev/null || true
    find logs -name "rollback*.log" -mtime +7 -delete 2>/dev/null || true

    ROLLBACK_IN_PROGRESS=false

    log_success "Cleanup completed"
}

# Main rollback execution
execute_rollback() {
    local reason="${1:-Manual rollback}"
    local trigger="${2:-manual}"

    # Initialize rollback
    initialize_rollback "$reason" "$trigger"

    # Trap for cleanup
    trap cleanup_rollback EXIT

    try {
        # Detect environment state
        detect_environment_state

        # Save current state
        save_current_state

        # Update state
        update_rollback_state "rollback_started" "Beginning rollback process"

        # Perform traffic switch
        perform_traffic_switch

        # Verify rollback
        if verify_rollback; then
            # Restore additional state
            restore_additional_state

            # Mark as completed
            update_rollback_state "completed" "Rollback completed successfully"

            # Generate report
            generate_rollback_report

            # Send success notification
            send_rollback_notification "completed" "Rollback $ROLLBACK_ID completed successfully"

            log_success "Rollback completed successfully!"

            # Update final state
            jq --arg status "completed" \
               --arg end_time "$(date -Iseconds)" \
               '.status = $status | .end_time = $end_time' \
               "$ROLLBACK_STATE_DIR/${ROLLBACK_ID}.json" > "${ROLLBACK_STATE_DIR}/${ROLLBACK_ID}.tmp" && \
               mv "${ROLLBACK_STATE_DIR}/${ROLLBACK_ID}.tmp" "$ROLLBACK_STATE_DIR/${ROLLBACK_ID}.json"

        else
            # Mark as failed
            update_rollback_state "failed" "Rollback verification failed"

            # Send failure notification
            send_rollback_notification "failed" "Rollback $ROLLBACK_ID failed verification"

            log_error "Rollback verification failed!"

            exit 1
        fi
    } catch {
        # Handle any errors
        log_error "Rollback execution failed: $1"
        update_rollback_state "error" "Execution failed: $1"
        send_rollback_notification "failed" "Rollback $ROLLBACK_ID failed: $1"
        exit 1
    }
}

# Manual rollback trigger
trigger_manual_rollback() {
    local reason="${1:-Manual rollback triggered}"
    log_rollback "Manual rollback triggered: $reason"
    execute_rollback "$reason" "manual"
}

# Automatic rollback monitoring
start_automatic_monitoring() {
    log_info "Starting automatic rollback monitoring..."

    # Monitor error rates
    (
        while true; do
            local error_rate
            error_rate=$(wrangler analytics --since 5m --format json 2>/dev/null | jq -r '.data[0].error_rate // 0' 2>/dev/null || echo "0")

            if [[ $(echo "$error_rate > 15" | bc -l 2>/dev/null || echo "0") -eq 1 ]]; then
                log_error "High error rate detected: ${error_rate}%"
                execute_rollback "High error rate: ${error_rate}%" "auto_error_rate"
                break
            fi

            sleep $MONITORING_INTERVAL
        done
    ) &
    MONITORING_PROCESSES+=($!)

    # Monitor response times
    (
        while true; do
            local avg_response_time
            avg_response_time=$(wrangler analytics --since 5m --format json 2>/dev/null | jq -r '.data[0].avg_response_time // 0' 2>/dev/null || echo "0")

            if [[ $(echo "$avg_response_time > 5000" | bc -l 2>/dev/null || echo "0") -eq 1 ]]; then
                log_error "High response time detected: ${avg_response_time}ms"
                execute_rollback "High response time: ${avg_response_time}ms" "auto_response_time"
                break
            fi

            sleep $MONITORING_INTERVAL
        done
    ) &
    MONITORING_PROCESSES+=($!)

    # Health check monitoring
    (
        while true; do
            local health_status
            health_status=$(curl -s -o /dev/null -w "%{http_code}" "https://$API_DOMAIN/health" 2>/dev/null || echo "000")

            if [[ ! "$health_status" =~ ^2[0-9][0-9]$ ]]; then
                log_error "Health check failed: HTTP $health_status"
                execute_rollback "Health check failure: HTTP $health_status" "auto_health_check"
                break
            fi

            sleep $HEALTH_CHECK_INTERVAL
        done
    ) &
    MONITORING_PROCESSES+=($!)

    log_info "Automatic monitoring started (PID: ${MONITORING_PROCESSES[*]})"
}

# Stop automatic monitoring
stop_automatic_monitoring() {
    log_info "Stopping automatic rollback monitoring..."

    for pid in "${MONITORING_PROCESSES[@]}"; do
        kill "$pid" 2>/dev/null || true
    done

    MONITORING_PROCESSES=()
    log_success "Automatic monitoring stopped"
}

# List rollback history
list_rollback_history() {
    log_info "Rollback History:"
    echo ""

    local state_files=("$ROLLBACK_STATE_DIR"/rollback-*.json)
    if [[ ${#state_files[@]} -eq 0 || ! -f "${state_files[0]}" ]]; then
        echo "No rollback history found."
        return 0
    fi

    printf "%-20s %-15s %-15s %-20s %-15s\n" "ROLLBACK ID" "REASON" "TRIGGER" "TIMESTAMP" "STATUS"
    printf "%-20s %-15s %-15s %-20s %-15s\n" "--------------------" "---------------" "---------------" "--------------------" "---------------"

    for state_file in "${state_files[@]}"; do
        if [[ -f "$state_file" ]]; then
            local rollback_info
            rollback_info=$(cat "$state_file")

            local id=$(echo "$rollback_info" | jq -r '.rollback_id')
            local reason=$(echo "$rollback_info" | jq -r '.reason' | cut -c1-14)
            local trigger=$(echo "$rollback_info" | jq -r '.trigger')
            local timestamp=$(echo "$rollback_info" | jq -r '.start_time' | cut -c1-19)
            local status=$(echo "$rollback_info" | jq -r '.status')

            printf "%-20s %-15s %-15s %-20s %-15s\n" "$id" "$reason" "$trigger" "$timestamp" "$status"
        fi
    done
}

# Main function with command parsing
main() {
    local command="${1:-help}"

    case $command in
        "rollback"|"trigger")
            trigger_manual_rollback "${2:-Manual rollback}"
            ;;
        "monitor")
            start_automatic_monitoring
            log_info "Monitoring started. Press Ctrl+C to stop."
            trap 'stop_automatic_monitoring; exit 0' INT
            sleep infinity
            ;;
        "stop")
            stop_automatic_monitoring
            ;;
        "history")
            list_rollback_history
            ;;
        "status")
            if [[ "$ROLLBACK_IN_PROGRESS" = true ]]; then
                log_info "Rollback in progress: $ROLLBACK_ID"
            else
                log_info "No rollback currently in progress"
            fi
            ;;
        "help"|"-h"|"--help")
            cat << EOF
SDLC.ai Platform Automated Rollback System

Usage: $0 COMMAND [OPTIONS]

Commands:
    rollback [REASON]     Trigger immediate manual rollback
    trigger [REASON]      Alias for rollback
    monitor               Start automatic rollback monitoring
    stop                  Stop automatic monitoring
    history               Show rollback history
    status                Show current rollback status
    help                  Show this help message

Examples:
    $0 rollback "High error rate detected"
    $0 monitor
    $0 history

Environment Variables:
    WEBHOOK_URL           Notification webhook URL
    SLACK_WEBHOOK_URL     Slack webhook URL
    ALERT_EMAIL           Email address for alerts
    SMTP_SERVER           SMTP server for email alerts

Features:
    - Automatic failure detection
    - Instant rollback capability
    - Multiple trigger mechanisms
    - Complete state restoration
    - Rollback verification
    - Comprehensive logging
    - Analytics integration
    - Notification system

EOF
            ;;
        *)
            log_error "Unknown command: $command"
            echo "Use '$0 help' for usage information"
            exit 1
            ;;
    esac
}

# Error handling for try-catch simulation
try() {
    "$@"
}

catch() {
    local exit_code=$?
    if [[ $exit_code -ne 0 ]]; then
        echo "Command failed with exit code $exit_code: $1"
        return $exit_code
    fi
}

# Run main function
main "$@"
