#!/bin/bash

# QuantumBeam Disaster Recovery Automation Script
# Comprehensive DR orchestration and automation

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/../dr-config.yaml"
LOG_FILE="/var/log/quantumbeam/dr-automation.log"
TEMP_DIR="/tmp/dr-automation-$(date +%Y%m%d-%H%M%S)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1${NC}" | tee -a "$LOG_FILE"
}

# Help function
show_help() {
    cat << EOF
QuantumBeam Disaster Recovery Automation Script

Usage: $0 <command> [options]

Commands:
    validate                     Validate DR configuration and prerequisites
    pre-check                   Perform pre-failover health checks
    failover                    Execute failover to secondary region
    validate-failover          Validate failed-over environment
    rollback                    Rollback to primary region
    backup-health               Check backup system health
    test-dr                    Run DR test scenario
    status                      Show current DR status
    cleanup                     Cleanup temporary resources

Options:
    --region PRIMARY_REGION     Primary AWS region (default: us-east-1)
    --secondary-region SECONDARY_REGION  Secondary region (default: us-west-2)
    --dry-run                  Show what would be done without executing
    --force                    Skip confirmation prompts
    --config-file FILE         Custom configuration file
    --log-level LEVEL          Log level (DEBUG, INFO, WARN, ERROR)
    --notify                   Send notifications during execution

Examples:
    $0 validate --region us-east-1
    $0 pre-check --secondary-region us-west-2
    $0 failover --dry-run
    $0 test-dr --scenario region-failover

EOF
}

# Parse command line arguments
COMMAND=""
PRIMARY_REGION="us-east-1"
SECONDARY_REGION="us-west-2"
DRY_RUN=false
FORCE=false
NOTIFY=false
LOG_LEVEL="INFO"

while [[ $# -gt 0 ]]; do
    case $1 in
        validate|pre-check|failover|validate-failover|rollback|backup-health|test-dr|status|cleanup)
            COMMAND="$1"
            shift
            ;;
        --region)
            PRIMARY_REGION="$2"
            shift 2
            ;;
        --secondary-region)
            SECONDARY_REGION="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --config-file)
            CONFIG_FILE="$2"
            shift 2
            ;;
        --log-level)
            LOG_LEVEL="$2"
            shift 2
            ;;
        --notify)
            NOTIFY=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            ;;
    esac
done

# Check dependencies
check_dependencies() {
    local deps=("aws" "kubectl" "jq" "curl" "yq")

    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            error "Required dependency not found: $dep"
        fi
    done

    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        error "AWS credentials not configured or invalid"
    fi

    # Check kubernetes access
    if ! kubectl cluster-info &> /dev/null; then
        error "Kubernetes cluster not accessible"
    fi

    log "Dependencies verified successfully"
}

# Load configuration
load_config() {
    if [[ ! -f "$CONFIG_FILE" ]]; then
        error "Configuration file not found: $CONFIG_FILE"
    fi

    # Load configuration using yq or fallback
    if command -v yq &> /dev/null; then
        PRIMARY_REGION=$(yq eval '.primary_region' "$CONFIG_FILE" 2>/dev/null || echo "$PRIMARY_REGION")
        SECONDARY_REGION=$(yq eval '.secondary_region' "$CONFIG_FILE" 2>/dev/null || echo "$SECONDARY_REGION")
    else
        warning "yq not found, using default regions"
    fi

    log "Configuration loaded from $CONFIG_FILE"
    log "Primary region: $PRIMARY_REGION"
    log "Secondary region: $SECONDARY_REGION"
}

# Send notification
send_notification() {
    local message="$1"
    local severity="${2:-INFO}"

    if [[ "$NOTIFY" == "true" ]]; then
        # Slack notification
        if command -v slack-cli &> /dev/null; then
            slack-cli send --message "$message" --channel "#dr-alerts" || warning "Failed to send Slack notification"
        fi

        # Email notification (placeholder)
        # send_email_notification "$message" "$severity"

        log "Notification sent: $message"
    fi
}

# Validate DR configuration
validate_dr_config() {
    log "Validating DR configuration..."

    # Check primary region
    log "Checking primary region: $PRIMARY_REGION"
    aws ec2 describe-regions --region-names "$PRIMARY_REGION" &> /dev/null || \
        error "Primary region $PRIMARY_REGION not accessible"

    # Check secondary region
    log "Checking secondary region: $SECONDARY_REGION"
    aws ec2 describe-regions --region-names "$SECONDARY_REGION" &> /dev/null || \
        error "Secondary region $SECONDARY_REGION not accessible"

    # Check EKS clusters
    log "Checking EKS clusters..."
    aws eks describe-cluster --name quantumbeam-prod --region "$PRIMARY_REGION" &> /dev/null || \
        error "Primary EKS cluster not found"
    aws eks describe-cluster --name quantumbeam-prod --region "$SECONDARY_REGION" &> /dev/null || \
        warning "Secondary EKS cluster not found"

    # Check backup availability
    log "Checking backup availability..."
    local backup_count
    backup_count=$(aws s3 ls s3://quantumbeam-backups-$SECONDARY_REGION/ --recursive 2>/dev/null | wc -l)
    if [[ $backup_count -eq 0 ]]; then
        error "No backups found in secondary region"
    fi
    log "Found $backup_count backup objects in secondary region"

    # Check DNS configuration
    log "Checking DNS configuration..."
    if ! aws route53 list-hosted-zones --query "HostedZones[?Name=='quantumbeam.io.']" | jq -r '.[0].Id' &> /dev/null; then
        error "Route53 hosted zone for quantumbeam.io not found"
    fi

    # Check team availability
    log "Checking team contact information..."
    # Placeholder for team availability check

    log "DR configuration validation completed successfully"
    send_notification "DR configuration validation completed successfully" "INFO"
}

# Pre-failover health checks
pre_failover_checks() {
    log "Performing pre-failover health checks..."

    mkdir -p "$TEMP_DIR"

    # Check primary region health
    log "Checking primary region health..."
    local primary_healthy=true

    # Check EKS cluster health
    if ! aws eks describe-cluster --name quantumbeam-prod --region "$PRIMARY_REGION" --query 'cluster.status' | grep -q "ACTIVE"; then
        primary_healthy=false
        error "Primary EKS cluster not healthy"
    fi

    # Check critical services
    kubectl config use-context "arn:aws:eks:$PRIMARY_REGION:$(aws sts get-caller-identity --query Account --output text):cluster/quantumbeam-prod"

    local unhealthy_pods
    unhealthy_pods=$(kubectl get pods -A --field-selector=status.phase!=Running --no-headers | wc -l)
    if [[ $unhealthy_pods -gt 0 ]]; then
        warning "Found $unhealthy_pods unhealthy pods in primary region"
    fi

    # Check secondary region readiness
    log "Checking secondary region readiness..."
    local secondary_ready=true

    # Update kubeconfig for secondary region
    aws eks update-kubeconfig --region "$SECONDARY_REGION" --name quantumbeam-prod --alias quantumbeam-secondary

    # Check if secondary cluster exists and is accessible
    if ! kubectl config get-contexts | grep -q "quantumbeam-secondary"; then
        secondary_ready=false
        error "Secondary EKS cluster not accessible"
    fi

    # Check backup availability and integrity
    log "Checking backup availability and integrity..."
    local latest_backup
    latest_backup=$(aws s3 ls s3://quantumbeam-backups-$SECONDARY_REGION/database/ --recursive | sort | tail -1 | awk '{print $4}')

    if [[ -z "$latest_backup" ]]; then
        error "No recent backups found in secondary region"
    fi

    # Verify backup integrity (simplified)
    log "Verifying backup integrity for: $latest_backup"
    if ! aws s3api head-object --bucket "quantumbeam-backups-$SECONDARY_REGION" --key "$latest_backup" &> /dev/null; then
        error "Backup integrity check failed"
    fi

    # Generate pre-failover report
    cat > "$TEMP_DIR/pre-failover-report.json" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "primary_region": "$PRIMARY_REGION",
    "secondary_region": "$SECONDARY_REGION",
    "primary_healthy": $primary_healthy,
    "secondary_ready": $secondary_ready,
    "latest_backup": "$latest_backup",
    "unhealthy_pods_primary": $unhealthy_pods,
    "recommendation": "$([ "$primary_healthy" = true ] && echo "Primary healthy, consider manual investigation" || echo "Failover recommended")"
}
EOF

    log "Pre-failover health checks completed"
    log "Report saved to: $TEMP_DIR/pre-failover-report.json"

    # Display summary
    cat "$TEMP_DIR/pre-failover-report.json" | jq '.'

    send_notification "Pre-failover health checks completed. Primary healthy: $primary_healthy, Secondary ready: $secondary_ready" "INFO"
}

# Execute failover
execute_failover() {
    log "Starting failover to secondary region..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would execute failover to $SECONDARY_REGION"
        return 0
    fi

    # Confirmation prompt
    if [[ "$FORCE" != "true" ]]; then
        echo "This will initiate a failover to $SECONDARY_REGION"
        echo "Are you sure you want to continue? (yes/no)"
        read -r confirmation
        if [[ "$confirmation" != "yes" ]]; then
            log "Failover cancelled by user"
            exit 0
        fi
    fi

    send_notification "Starting failover to $SECONDARY_REGION" "CRITICAL"

    # Phase 1: Prepare secondary region
    log "Phase 1: Preparing secondary region..."

    # Switch to secondary region context
    kubectl config use-context quantumbeam-secondary

    # Deploy infrastructure
    log "Deploying infrastructure in secondary region..."
    kubectl apply -f kubernetes/secondary-region/namespaces.yaml
    kubectl apply -f kubernetes/secondary-region/configmaps.yaml
    kubectl apply -f kubernetes/secondary-region/secrets.yaml

    # Phase 2: Restore data
    log "Phase 2: Restoring data..."

    # Restore database
    log "Restoring PostgreSQL database..."
    local latest_backup
    latest_backup=$(aws s3 ls s3://quantumbeam-backups-$SECONDARY_REGION/database/ --recursive | sort | tail -1 | awk '{print $4}')

    aws s3 cp "s3://quantumbeam-backups-$SECONDARY_REGION/$latest_backup" "$TEMP_DIR/latest-backup.dump"

    # Create new database instance (simplified)
    local db_instance_id="quantumbeam-db-dr-$(date +%Y%m%d%H%M%S)"
    aws rds restore-db-instance-from-db-snapshot \
        --db-instance-identifier "$db_instance_id" \
        --db-snapshot-identifier "quantumbeam-db-snapshot-$(date +%Y%m%d)" \
        --db-instance-class db.r5.large \
        --multi-az \
        --region "$SECONDARY_REGION"

    # Wait for database to be available
    log "Waiting for database to become available..."
    aws rds wait db-instance-available \
        --db-instance-identifiers "$db_instance_id" \
        --region "$SECONDARY_REGION" \
        --output text

    # Phase 3: Deploy applications
    log "Phase 3: Deploying applications..."

    # Update database configuration
    local db_host
    db_host=$(aws rds describe-db-instances \
        --db-instance-identifier "$db_instance_id" \
        --region "$SECONDARY_REGION" \
        --query 'DBInstances[0].Endpoint.Address' \
        --output text)

    kubectl patch configmap quantumbeam-config -n quantumbeam -p \
        "{\"data\":{\"database_host\":\"$db_host\"}}"

    # Deploy applications
    kubectl apply -f kubernetes/secondary-region/deployments.yaml
    kubectl apply -f kubernetes/secondary-region/services.yaml

    # Wait for deployments to be ready
    log "Waiting for deployments to be ready..."
    kubectl rollout status deployment/quantumbeam-api -n quantumbeam --timeout=600s
    kubectl rollout status deployment/quantumbeam-worker -n quantumbeam --timeout=600s

    # Phase 4: Update DNS
    log "Phase 4: Updating DNS..."

    # Get load balancer hostname
    local lb_hostname
    lb_hostname=$(kubectl get ingress quantumbeam-ingress -n quantumbeam -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

    # Update Route53 records
    local hosted_zone_id
    hosted_zone_id=$(aws route53 list-hosted-zones --query "HostedZones[?Name=='quantumbeam.io.'].Id" --output text | head -1)

    # Create change batch
    cat > "$TEMP_DIR/dns-change-batch.json" << EOF
{
    "Comment": "DR failover to $SECONDARY_REGION",
    "Changes": [
        {
            "Action": "UPSERT",
            "ResourceRecordSet": {
                "Name": "api.quantumbeam.io",
                "Type": "CNAME",
                "TTL": 60,
                "ResourceRecords": [
                    {
                        "Value": "$lb_hostname"
                    }
                ]
            }
        }
    ]
}
EOF

    aws route53 change-resource-record-sets \
        --hosted-zone-id "$hosted_zone_id" \
        --change-batch "file://$TEMP_DIR/dns-change-batch.json"

    # Phase 5: Validate failover
    log "Phase 5: Validating failover..."

    # Health checks
    local failover_success=true
    local max_attempts=30
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        log "Health check attempt $attempt/$max_attempts"

        if curl -f "https://api.quantumbeam.io/health" &> /dev/null; then
            log "Health check passed"
            break
        fi

        if [[ $attempt -eq $max_attempts ]]; then
            failover_success=false
            error "Health checks failed after $max_attempts attempts"
        fi

        sleep 30
        ((attempt++))
    done

    # Generate failover report
    cat > "$TEMP_DIR/failover-report.json" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "primary_region": "$PRIMARY_REGION",
    "secondary_region": "$SECONDARY_REGION",
    "db_instance_id": "$db_instance_id",
    "lb_hostname": "$lb_hostname",
    "failover_success": $failover_success,
    "total_duration": "$(date +%s)s"
}
EOF

    log "Failover completed successfully"
    log "Report saved to: $TEMP_DIR/failover-report.json"

    send_notification "Failover to $SECONDARY_REGION completed successfully" "INFO"
}

# Validate failed-over environment
validate_failover() {
    log "Validating failed-over environment..."

    mkdir -p "$TEMP_DIR"

    # Switch to secondary region context
    kubectl config use-context quantumbeam-secondary

    # Check cluster health
    log "Checking cluster health..."
    local node_count
    node_count=$(kubectl get nodes --no-headers | wc -l)
    log "Node count: $node_count"

    local ready_nodes
    ready_nodes=$(kubectl get nodes --no-headers | grep "Ready" | wc -l)
    log "Ready nodes: $ready_nodes"

    # Check pod health
    log "Checking pod health..."
    local total_pods
    total_pods=$(kubectl get pods -A --no-headers | wc -l)
    log "Total pods: $total_pods"

    local running_pods
    running_pods=$(kubectl get pods -A --field-selector=status.phase=Running --no-headers | wc -l)
    log "Running pods: $running_pods"

    # Application health checks
    log "Performing application health checks..."
    local api_healthy=false
    local auth_healthy=false
    local db_healthy=false

    # API health check
    if curl -f "https://api.quantumbeam.io/health" &> /dev/null; then
        api_healthy=true
        log "API health check: PASSED"
    else
        log "API health check: FAILED"
    fi

    # Authentication health check
    if curl -f -X POST "https://api.quantumbeam.io/auth/health" &> /dev/null; then
        auth_healthy=true
        log "Authentication health check: PASSED"
    else
        log "Authentication health check: FAILED"
    fi

    # Database health check
    if kubectl exec -n quantumbeam deployment/quantumbeam-api -- psql "$DATABASE_URL" -c "SELECT 1;" &> /dev/null; then
        db_healthy=true
        log "Database health check: PASSED"
    else
        log "Database health check: FAILED"
    fi

    # Performance checks
    log "Performing performance checks..."
    local response_time
    response_time=$(curl -o /dev/null -s -w "%{time_total}" "https://api.quantumbeam.io/health")
    log "API response time: ${response_time}s"

    # Generate validation report
    cat > "$TEMP_DIR/validation-report.json" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "secondary-region",
    "cluster_health": {
        "total_nodes": $node_count,
        "ready_nodes": $ready_nodes,
        "total_pods": $total_pods,
        "running_pods": $running_pods
    },
    "application_health": {
        "api_healthy": $api_healthy,
        "auth_healthy": $auth_healthy,
        "db_healthy": $db_healthy
    },
    "performance": {
        "api_response_time": $response_time
    },
    "overall_health": $([ "$api_healthy" = true ] && [ "$auth_healthy" = true ] && [ "$db_healthy" = true ] && echo "true" || echo "false")
}
EOF

    log "Environment validation completed"
    log "Report saved to: $TEMP_DIR/validation-report.json"

    # Display summary
    cat "$TEMP_DIR/validation-report.json" | jq '.'

    local overall_health
    overall_health=$(cat "$TEMP_DIR/validation-report.json" | jq -r '.overall_health')

    if [[ "$overall_health" == "true" ]]; then
        send_notification "Failed-over environment validation: PASSED" "INFO"
    else
        send_notification "Failed-over environment validation: FAILED" "CRITICAL"
    fi
}

# Rollback to primary region
rollback() {
    log "Starting rollback to primary region..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would execute rollback to $PRIMARY_REGION"
        return 0
    fi

    # Confirmation prompt
    if [[ "$FORCE" != "true" ]]; then
        echo "This will rollback to the primary region: $PRIMARY_REGION"
        echo "Are you sure you want to continue? (yes/no)"
        read -r confirmation
        if [[ "$confirmation" != "yes" ]]; then
            log "Rollback cancelled by user"
            exit 0
        fi
    fi

    send_notification "Starting rollback to $PRIMARY_REGION" "CRITICAL"

    # Switch to primary region context
    kubectl config use-context "arn:aws:eks:$PRIMARY_REGION:$(aws sts get-caller-identity --query Account --output text):cluster/quantumbeam-prod"

    # Deploy primary region infrastructure
    log "Deploying primary region infrastructure..."
    kubectl apply -f kubernetes/primary-region/namespaces.yaml
    kubectl apply -f kubernetes/primary-region/configmaps.yaml
    kubectl apply -f kubernetes/primary-region/secrets.yaml

    # Deploy applications
    log "Deploying applications in primary region..."
    kubectl apply -f kubernetes/primary-region/deployments.yaml
    kubectl apply -f kubernetes/primary-region/services.yaml

    # Wait for deployments to be ready
    log "Waiting for deployments to be ready..."
    kubectl rollout status deployment/quantumbeam-api -n quantumbeam --timeout=600s
    kubectl rollout status deployment/quantumbeam-worker -n quantumbeam --timeout=600s

    # Update DNS to point back to primary
    log "Updating DNS to point back to primary region..."

    local primary_lb
    primary_lb=$(kubectl get ingress quantumbeam-ingress -n quantumbeam -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

    local hosted_zone_id
    hosted_zone_id=$(aws route53 list-hosted-zones --query "HostedZones[?Name=='quantumbeam.io.'].Id" --output text | head -1)

    cat > "$TEMP_DIR/rollback-dns-change.json" << EOF
{
    "Comment": "Rollback to $PRIMARY_REGION",
    "Changes": [
        {
            "Action": "UPSERT",
            "ResourceRecordSet": {
                "Name": "api.quantumbeam.io",
                "Type": "CNAME",
                "TTL": 60,
                "ResourceRecords": [
                    {
                        "Value": "$primary_lb"
                    }
                ]
            }
        }
    ]
}
EOF

    aws route53 change-resource-record-sets \
        --hosted-zone-id "$hosted_zone_id" \
        --change-batch "file://$TEMP_DIR/rollback-dns-change.json"

    # Validate rollback
    log "Validating rollback..."
    sleep 60  # Wait for DNS propagation

    if curl -f "https://api.quantumbeam.io/health" &> /dev/null; then
        log "Rollback validation: PASSED"
        send_notification "Rollback to $PRIMARY_REGION completed successfully" "INFO"
    else
        log "Rollback validation: FAILED"
        send_notification "Rollback to $PRIMARY_REGION validation failed" "CRITICAL"
    fi

    # Scale down secondary region
    log "Scaling down secondary region..."
    kubectl config use-context quantumbeam-secondary
    kubectl scale deployment --replicas=0 --all -n quantumbeam

    log "Rollback completed"
}

# Check backup health
check_backup_health() {
    log "Checking backup system health..."

    mkdir -p "$TEMP_DIR"

    local backup_regions=("$PRIMARY_REGION" "$SECONDARY_REGION")
    local backup_health_report=()

    for region in "${backup_regions[@]}"; do
        log "Checking backup health for region: $region"

        local backup_count=0
        local latest_backup=""
        local backup_age_hours=999999
        local backup_size_mb=0

        # Check database backups
        local db_backups
        db_backups=$(aws s3 ls s3://quantumbeam-backups-$region/database/ --recursive 2>/dev/null || true)
        if [[ -n "$db_backups" ]]; then
            backup_count=$(echo "$db_backups" | wc -l)
            latest_backup=$(echo "$db_backups" | sort | tail -1 | awk '{print $4}')

            if [[ -n "$latest_backup" ]]; then
                # Calculate backup age
                local backup_timestamp
                backup_timestamp=$(echo "$latest_backup" | grep -o '[0-9]\{8\}-[0-9]\{6\}' | head -1)
                if [[ -n "$backup_timestamp" ]]; then
                    local backup_date
                    backup_date=$(date -d "${backup_timestamp:0:8} ${backup_timestamp:9:2}:${backup_timestamp:11:2}:${backup_timestamp:13:2}" +%s)
                    local current_date
                    current_date=$(date +%s)
                    backup_age_hours=$(( (current_date - backup_date) / 3600 ))
                fi

                # Get backup size
                backup_size_mb=$(aws s3api head-object --bucket "quantumbeam-backups-$region" --key "$latest_backup" --query ContentLength --output text 2>/dev/null | awk '{print int($1/1024/1024)}' || echo "0")
            fi
        fi

        # Add to report
        backup_health_report+=("Region: $region, Count: $backup_count, Latest: $latest_backup, Age: ${backup_age_hours}h, Size: ${backup_size_mb}MB")

        # Check backup age threshold (24 hours)
        if [[ $backup_age_hours -gt 24 ]]; then
            warning "Region $region: Latest backup is ${backup_age_hours} hours old"
        fi

        # Check backup size
        if [[ $backup_size_mb -eq 0 ]]; then
            warning "Region $region: No valid backups found"
        fi
    done

    # Generate backup health report
    cat > "$TEMP_DIR/backup-health-report.json" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "regions": ["$PRIMARY_REGION", "$SECONDARY_REGION"],
    "backup_summary": [
$(printf '        "%s"' "${backup_health_report[@]}" | paste -sd ',\n')
    ],
    "overall_health": $([[ $backup_age_hours -le 24 && $backup_size_mb -gt 0 ]] && echo "true" || echo "false")
}
EOF

    log "Backup health check completed"
    log "Report saved to: $TEMP_DIR/backup-health-report.json"

    # Display summary
    cat "$TEMP_DIR/backup-health-report.json" | jq '.'

    local overall_health
    overall_health=$(cat "$TEMP_DIR/backup-health-report.json" | jq -r '.overall_health')

    if [[ "$overall_health" == "true" ]]; then
        send_notification "Backup system health check: PASSED" "INFO"
    else
        send_notification "Backup system health check: FAILED" "WARNING"
    fi
}

# Run DR test scenario
run_dr_test() {
    local scenario="${1:-region-failover}"

    log "Running DR test scenario: $scenario"

    case "$scenario" in
        "region-failover")
            log "Testing region failover scenario..."
            pre_failover_checks
            if [[ "$DRY_RUN" != "true" ]]; then
                execute_failover
                sleep 60
                validate_failover
                rollback
            fi
            ;;
        "backup-restore")
            log "Testing backup restore scenario..."
            check_backup_health
            # Add backup restore test logic
            ;;
        "security-incident")
            log "Testing security incident scenario..."
            # Add security incident test logic
            ;;
        *)
            error "Unknown DR test scenario: $scenario"
            ;;
    esac

    log "DR test scenario completed: $scenario"
    send_notification "DR test scenario completed: $scenario" "INFO"
}

# Show DR status
show_status() {
    log "Current DR status..."

    echo "=== DR Configuration ==="
    echo "Primary Region: $PRIMARY_REGION"
    echo "Secondary Region: $SECONDARY_REGION"
    echo "Configuration File: $CONFIG_FILE"
    echo ""

    echo "=== Cluster Status ==="

    # Primary cluster
    echo "Primary Region ($PRIMARY_REGION):"
    if kubectl config get-contexts | grep -q "$PRIMARY_REGION"; then
        kubectl config use-context "arn:aws:eks:$PRIMARY_REGION:$(aws sts get-caller-identity --query Account --output text):cluster/quantumbeam-prod" 2>/dev/null
        echo "  Nodes: $(kubectl get nodes --no-headers | wc -l)"
        echo "  Pods: $(kubectl get pods -A --no-headers | wc -l)"
    else
        echo "  Status: Not accessible"
    fi

    echo ""

    # Secondary cluster
    echo "Secondary Region ($SECONDARY_REGION):"
    if kubectl config get-contexts | grep -q "quantumbeam-secondary"; then
        kubectl config use-context quantumbeam-secondary 2>/dev/null
        echo "  Nodes: $(kubectl get nodes --no-headers | wc -l)"
        echo "  Pods: $(kubectl get pods -A --no-headers | wc -l)"
    else
        echo "  Status: Not accessible"
    fi

    echo ""

    echo "=== DNS Status ==="
    local api_endpoint
    api_endpoint=$(nslookup api.quantumbeam.io | grep -A 1 "Name:" | grep "Address:" | awk '{print $2}' | head -1)
    echo "API Endpoint: api.quantumbeam.io -> $api_endpoint"

    echo ""

    echo "=== Backup Status ==="
    for region in "$PRIMARY_REGION" "$SECONDARY_REGION"; do
        local backup_count
        backup_count=$(aws s3 ls s3://quantumbeam-backups-$region/ --recursive 2>/dev/null | wc -l)
        echo "Region $region: $backup_count backup objects"
    done
}

# Cleanup temporary resources
cleanup() {
    log "Cleaning up temporary resources..."

    if [[ -d "$TEMP_DIR" ]]; then
        rm -rf "$TEMP_DIR"
        log "Removed temporary directory: $TEMP_DIR"
    fi

    # Add any additional cleanup logic here

    log "Cleanup completed"
}

# Main execution logic
main() {
    # Create temporary directory
    mkdir -p "$TEMP_DIR"

    # Initialize log file
    mkdir -p "$(dirname "$LOG_FILE")"
    touch "$LOG_FILE"

    # Trap cleanup
    trap cleanup EXIT

    # Check dependencies
    check_dependencies

    # Load configuration
    load_config

    # Execute command
    case "$COMMAND" in
        "validate")
            validate_dr_config
            ;;
        "pre-check")
            pre_failover_checks
            ;;
        "failover")
            execute_failover
            ;;
        "validate-failover")
            validate_failover
            ;;
        "rollback")
            rollback
            ;;
        "backup-health")
            check_backup_health
            ;;
        "test-dr")
            run_dr_test "${2:-region-failover}"
            ;;
        "status")
            show_status
            ;;
        "cleanup")
            cleanup
            ;;
        *)
            error "Unknown command: $COMMAND. Use --help for usage information."
            ;;
    esac
}

# Execute main function
main "$@"