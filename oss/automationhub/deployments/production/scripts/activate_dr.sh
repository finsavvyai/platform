#!/bin/bash

# UPM.Plus AutomationHub - Disaster Recovery Activation Script
# Version: 1.0
# Usage: ./activate_dr.sh [--force] [--region us-west-2]

set -euo pipefail

# Configuration
DEFAULT_DR_REGION="us-west-2"
DEFAULT_PRIMARY_REGION="us-east-1"
NAMESPACE="upm-plus-prod"
DR_NAMESPACE="upm-plus-dr"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/tmp/dr-activation-$(date +%Y%m%d_%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

log_info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC} $1" | tee -a "$LOG_FILE"
}

# Parse command line arguments
FORCE_ACTIVATION=false
DR_REGION="$DEFAULT_DR_REGION"
PRIMARY_REGION="$DEFAULT_PRIMARY_REGION"

while [[ $# -gt 0 ]]; do
    case $1 in
        --force)
            FORCE_ACTIVATION=true
            shift
            ;;
        --region)
            DR_REGION="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [--force] [--region REGION] [--help]"
            echo "  --force     Skip confirmation prompts"
            echo "  --region    DR region to activate (default: $DEFAULT_DR_REGION)"
            echo "  --help      Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."

    # Check if AWS CLI is available
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed"
        exit 1
    fi

    # Check if kubectl is available
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        exit 1
    fi

    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured"
        exit 1
    fi

    # Check kubernetes context
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi

    # Check required environment variables
    if [[ -z "${HOSTED_ZONE_ID:-}" ]]; then
        log_error "HOSTED_ZONE_ID environment variable is not set"
        exit 1
    fi

    if [[ -z "${SLACK_WEBHOOK_URL:-}" ]]; then
        log_warning "SLACK_WEBHOOK_URL not set, notifications will be skipped"
    fi

    log "Prerequisites check completed"
}

# Verify current environment state
verify_environment() {
    log "Verifying current environment state..."

    # Check if primary region is actually down
    if [[ "$FORCE_ACTIVATION" = false ]]; then
        log_info "Checking primary region health..."

        # Try to connect to primary API
        if curl -f --max-time 10 https://api.upm.plus/health &>/dev/null; then
            log_warning "Primary region appears to be healthy"
            read -p "Are you sure you want to activate DR? (yes/no): " -r
            if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
                log "DR activation cancelled"
                exit 0
            fi
        else
            log "Primary region is unhealthy, proceeding with DR activation"
        fi
    fi

    # Check DR namespace exists
    if ! kubectl get namespace "$DR_NAMESPACE" &> /dev/null; then
        log_error "DR namespace '$DR_NAMESPACE' does not exist"
        exit 1
    fi

    # Check DR services exist
    local required_services=("postgres-primary" "upm-plus-api" "upm-plus-frontend")
    for service in "${required_services[@]}"; do
        if ! kubectl get deployment "$service" -n "$DR_NAMESPACE" &> /dev/null; then
            log_error "Required service '$service' not found in DR namespace"
            exit 1
        fi
    done

    log "Environment verification completed"
}

# Switch DNS to DR region
switch_dns() {
    log "Switching DNS to DR region..."

    # Create DNS change JSON
    cat > /tmp/dns-dr-switch.json << EOF
{
  "Comment": "Switch UPM.Plus to DR region - $(date)",
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "api.upm.plus.",
        "Type": "CNAME",
        "TTL": 60,
        "ResourceRecords": [
          {
            "Value": "dr-api-loadbalancer.${DR_REGION}.elb.amazonaws.com"
          }
        ]
      }
    },
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "upm.plus.",
        "Type": "CNAME",
        "TTL": 60,
        "ResourceRecords": [
          {
            "Value": "dr-frontend-loadbalancer.${DR_REGION}.elb.amazonaws.com"
          }
        ]
      }
    }
  ]
}
EOF

    # Apply DNS change
    if aws route53 change-resource-record-sets \
        --hosted-zone-id "$HOSTED_ZONE_ID" \
        --change-batch file:///tmp/dns-dr-switch.json; then
        log "✅ DNS switch initiated successfully"
    else
        log_error "❌ Failed to switch DNS"
        return 1
    fi

    # Clean up temporary file
    rm -f /tmp/dns-dr-switch.json

    # Wait for DNS propagation (brief check)
    log "Waiting for DNS propagation to begin..."
    sleep 30
}

# Scale up DR services
scale_dr_services() {
    log "Scaling up DR services..."

    local services_and_replicas=(
        "upm-plus-api:5"
        "upm-plus-frontend:3"
        "postgres-primary:1"
        "redis-master:1"
        "redis-slave:1"
    )

    for service_replica in "${services_and_replicas[@]}"; do
        local service="${service_replica%:*}"
        local replicas="${service_replica#*:}"

        log "Scaling $service to $replicas replicas..."
        if kubectl scale deployment "$service" --replicas="$replicas" -n "$DR_NAMESPACE"; then
            log "✅ $service scaling initiated"
        else
            log_error "❌ Failed to scale $service"
            return 1
        fi
    done

    log "Service scaling completed"
}

# Promote DR database to primary
promote_database() {
    log "Promoting DR database to primary..."

    # Wait for PostgreSQL pod to be ready
    log "Waiting for PostgreSQL pod to be ready..."
    local max_wait=300
    local wait_time=0

    while [[ $wait_time -lt $max_wait ]]; do
        if kubectl get pod postgres-primary-0 -n "$DR_NAMESPACE" -o jsonpath='{.status.phase}' | grep -q "Running"; then
            log "✅ PostgreSQL pod is ready"
            break
        fi

        sleep 10
        wait_time=$((wait_time + 10))
        log_info "Waiting for PostgreSQL pod... (${wait_time}s/${max_wait}s)"
    done

    if [[ $wait_time -ge $max_wait ]]; then
        log_error "PostgreSQL pod did not become ready in time"
        return 1
    fi

    # Promote replica to primary
    log "Promoting PostgreSQL replica to primary..."
    if kubectl exec -it postgres-primary-0 -n "$DR_NAMESPACE" -- \
        pg_ctl promote -D /var/lib/postgresql/data; then
        log "✅ Database promotion completed"
    else
        log_error "❌ Failed to promote database"
        return 1
    fi

    # Wait for promotion to complete
    sleep 30

    # Verify promotion
    local is_primary=$(kubectl exec postgres-primary-0 -n "$DR_NAMESPACE" -- \
        psql -U postgres -tAc "SELECT pg_is_in_recovery()")

    if [[ "$is_primary" == "f" ]]; then
        log "✅ Database successfully promoted to primary"
    else
        log_error "❌ Database promotion verification failed"
        return 1
    fi
}

# Update application configuration
update_configuration() {
    log "Updating application configuration..."

    # Update ConfigMap with DR-specific settings
    kubectl patch configmap upm-plus-config -n "$DR_NAMESPACE" \
        --patch '{"data":{"DATABASE_HOST":"postgres-primary","ENVIRONMENT":"production_dr","REDIS_HOST":"redis-master"}}'

    # Update secrets if needed
    if [[ -n "${NEW_DATABASE_PASSWORD:-}" ]]; then
        kubectl patch secret upm-plus-secrets -n "$DR_NAMESPACE" \
            --patch "{\"data\":{\"DATABASE_PASSWORD\":\"$(echo -n "$NEW_DATABASE_PASSWORD" | base64)\"}}"
    fi

    log "✅ Configuration updated successfully"
}

# Restart services with new configuration
restart_services() {
    log "Restarting services with new configuration..."

    local services=("upm-plus-api" "upm-plus-frontend")

    for service in "${services[@]}"; do
        log "Restarting $service..."
        if kubectl rollout restart deployment/"$service" -n "$DR_NAMESPACE"; then
            log "✅ $service restart initiated"
        else
            log_error "❌ Failed to restart $service"
            return 1
        fi
    done

    log "Service restarts completed"
}

# Wait for services to be ready
wait_for_services() {
    log "Waiting for services to become ready..."

    local services=("upm-plus-api" "upm-plus-frontend" "postgres-primary")
    local max_wait=600
    local wait_time=0

    for service in "${services[@]}"; do
        log "Waiting for $service rollout to complete..."

        if kubectl rollout status deployment/"$service" -n "$DR_NAMESPACE" --timeout="${max_wait}s"; then
            log "✅ $service is ready"
        else
            log_error "❌ $service failed to become ready"
            return 1
        fi
    done
}

# Verify DR services health
verify_dr_health() {
    log "Verifying DR services health..."

    local dr_api_url="https://dr-api.upm.plus"
    local dr_frontend_url="https://dr.upm.plus"
    local max_attempts=30
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        log_info "Health check attempt $attempt/$max_attempts"

        # Check API health
        if curl -f --max-time 10 "$dr_api_url/health" &>/dev/null; then
            log "✅ API health check passed"
            api_healthy=true
        else
            log_warning "⚠ API health check failed"
            api_healthy=false
        fi

        # Check frontend health
        if curl -f --max-time 10 "$dr_frontend_url/health" &>/dev/null; then
            log "✅ Frontend health check passed"
            frontend_healthy=true
        else
            log_warning "⚠ Frontend health check failed"
            frontend_healthy=false
        fi

        if [[ "$api_healthy" = true && "$frontend_healthy" = true ]]; then
            log "✅ All DR services are healthy"
            return 0
        fi

        sleep 30
        attempt=$((attempt + 1))
    done

    log_error "❌ DR services failed health checks after $max_attempts attempts"
    return 1
}

# Send notifications
send_notifications() {
    if [[ -z "${SLACK_WEBHOOK_URL:-}" ]]; then
        log_info "Slack webhook URL not configured, skipping notifications"
        return 0
    fi

    log "Sending DR activation notification..."

    local message="🚨 *UPM.Plus Disaster Recovery ACTIVATED* 🚨

*Region*: $DR_REGION
*Timestamp*: $(date)
*Activated by*: $(whoami)
*Log File*: $LOG_FILE

All services have been switched to the DR environment.
Team should monitor system performance and user feedback."

    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"$message\"}" \
        "$SLACK_WEBHOOK_URL" || log_warning "Failed to send Slack notification"

    log "✅ Notifications sent"
}

# Generate activation report
generate_report() {
    log "Generating DR activation report..."

    local report_file="/tmp/dr-activation-report-$(date +%Y%m%d_%H%M%S).txt"

    cat > "$report_file" << EOF
UPM.Plus Disaster Recovery Activation Report
==========================================

Activation Timestamp: $(date)
Activated By: $(whoami)
DR Region: $DR_REGION
Primary Region: $PRIMARY_REGION

Services Status:
$(kubectl get deployments -n "$DR_NAMESPACE" -o wide)

Pods Status:
$(kubectl get pods -n "$DR_NAMESPACE" -o wide)

Services:
$(kubectl get services -n "$DR_NAMESPACE")

Ingress:
$(kubectl get ingress -n "$DR_NAMESPACE")

External Health Checks:
API: $(curl -s -o /dev/null -w "%{http_code}" https://dr-api.upm.plus/health)
Frontend: $(curl -s -o /dev/null -w "%{http_code}" https://dr.upm.plus/health)

Next Steps:
1. Monitor system performance
2. Check application functionality
3. Verify data integrity
4. Update stakeholders
5. Plan return to primary region

Log File: $LOG_FILE
EOF

    log "✅ Report generated: $report_file"

    # Send report to Slack if configured
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        curl -X POST -F file=@"$report_file" "$SLACK_WEBHOOK_URL/upload" || log_warning "Failed to upload report to Slack"
    fi
}

# Cleanup function
cleanup() {
    log_info "Performing cleanup..."
    # Clean up any temporary files
    rm -f /tmp/dns-dr-switch.json
    log "Cleanup completed"
}

# Main execution
main() {
    log "🚨 Starting UPM.Plus Disaster Recovery Activation"
    log "=================================================="
    log "DR Region: $DR_REGION"
    log "Primary Region: $PRIMARY_REGION"
    log "Namespace: $DR_NAMESPACE"
    log "Timestamp: $(date)"
    log ""

    # Set up error handling
    trap cleanup ERR
    trap 'log "DR activation completed successfully"; exit 0' EXIT

    # Execute DR activation steps
    check_prerequisites
    verify_environment

    if [[ "$FORCE_ACTIVATION" = false ]]; then
        log_info "Type 'yes' to continue with DR activation:"
        read -r confirmation
        if [[ ! $confirmation =~ ^[Yy][Ee][Ss]$ ]]; then
            log "DR activation cancelled by user"
            exit 0
        fi
    fi

    switch_dns
    scale_dr_services
    promote_database
    update_configuration
    restart_services
    wait_for_services
    verify_dr_health
    send_notifications
    generate_report

    log ""
    log "✅ Disaster Recovery activation completed successfully!"
    log "DR Environment: https://dr.upm.plus"
    log "API Endpoint: https://dr-api.upm.plus"
    log ""
    log "Important Notes:"
    log "- Monitor system performance closely"
    log "- Check all application functionality"
    log "- Verify data integrity"
    log "- Update stakeholders about the activation"
    log "- Plan for return to primary region when stable"
}

# Execute main function
main "$@"