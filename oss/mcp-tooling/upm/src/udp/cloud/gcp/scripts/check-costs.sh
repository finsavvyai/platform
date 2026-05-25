#!/bin/bash

# UDP GCP Cost Monitoring Script
# Real-time cost checking and budget monitoring

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Load configuration
if [ -f .env.gcp ]; then
    source .env.gcp
else
    echo "❌ .env.gcp file not found. Some features may not work."
fi

# Configuration
BILLING_ACCOUNT=""
COST_THRESHOLD_WARNING=25.00
COST_THRESHOLD_CRITICAL=40.00

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_highlight() {
    echo -e "${PURPLE}💰 $1${NC}"
}

get_billing_account() {
    log_info "Getting billing account information..."

    # Get active billing accounts
    BILLING_ACCOUNTS=$(gcloud beta billing accounts list --filter="open:true" --format="value(name)")

    if [ -z "$BILLING_ACCOUNTS" ]; then
        log_error "No active billing accounts found"
        exit 1
    fi

    # Use first active billing account
    BILLING_ACCOUNT=$(echo "$BILLING_ACCOUNTS" | head -1)
    log_info "Using billing account: $BILLING_ACCOUNT"
}

check_current_costs() {
    log_info "Checking current month costs..."

    # Get current month costs
    local current_month=$(date +%Y-%m)
    local start_date="${current_month}-01"
    local end_date=$(date +%Y-%m-%d)

    # Get billing data
    local billing_data=$(gcloud beta billing projects describe "$GOOGLE_CLOUD_PROJECT" --format="json" 2>/dev/null || echo '{}')

    if [ "$billing_data" = "{}" ]; then
        log_warning "Could not retrieve billing information for project"
        return
    fi

    # Use Cloud Asset API to get cost information
    log_info "Fetching cost data for $current_month..."

    # Create a simple cost estimation based on running resources
    estimate_current_costs
}

estimate_current_costs() {
    log_info "Estimating costs based on current resources..."

    local total_cost=0
    local cost_breakdown=""

    # Check GKE cluster
    if gcloud container clusters describe udp-cluster --region="$GOOGLE_CLOUD_REGION" &>/dev/null; then
        local node_count=$(gcloud container clusters describe udp-cluster --region="$GOOGLE_CLOUD_REGION" --format="value(currentNodeCount)")
        local gke_cost=$(echo "scale=2; $node_count * 24.27" | bc)  # e2-micro cost per month
        total_cost=$(echo "scale=2; $total_cost + $gke_cost" | bc)
        cost_breakdown="${cost_breakdown}GKE Cluster ($node_count nodes): \$$gke_cost\n"
    fi

    # Check Cloud SQL
    if gcloud sql instances describe udp-postgres &>/dev/null; then
        local sql_cost=7.67  # db-f1-micro cost per month
        total_cost=$(echo "scale=2; $total_cost + $sql_cost" | bc)
        cost_breakdown="${cost_breakdown}Cloud SQL (db-f1-micro): \$$sql_cost\n"
    fi

    # Check Redis
    if gcloud redis instances describe udp-redis --region="$GOOGLE_CLOUD_REGION" &>/dev/null; then
        local redis_size=$(gcloud redis instances describe udp-redis --region="$GOOGLE_CLOUD_REGION" --format="value(memorySizeGb)")
        local redis_cost=$(echo "scale=2; $redis_size * 0.049 * 24 * 30" | bc)  # Basic tier pricing
        total_cost=$(echo "scale=2; $total_cost + $redis_cost" | bc)
        cost_breakdown="${cost_breakdown}Redis (${redis_size}GB Basic): \$$redis_cost\n"
    fi

    # Check Load Balancer
    if gcloud compute addresses list --global --filter="name~udp" --format="value(name)" | grep -q .; then
        local lb_cost=18.00  # Standard load balancer cost
        total_cost=$(echo "scale=2; $total_cost + $lb_cost" | bc)
        cost_breakdown="${cost_breakdown}Load Balancer: \$$lb_cost\n"
    fi

    # Check Storage
    local bucket_name="$GOOGLE_CLOUD_PROJECT-udp-storage"
    if gsutil ls -b "gs://$bucket_name" &>/dev/null; then
        local storage_size=$(gsutil du -s "gs://$bucket_name" 2>/dev/null | awk '{print $1}' || echo "0")
        local storage_gb=$(echo "scale=2; $storage_size / 1024 / 1024 / 1024" | bc)
        local storage_cost=$(echo "scale=2; $storage_gb * 0.020" | bc)  # Standard storage pricing
        total_cost=$(echo "scale=2; $total_cost + $storage_cost" | bc)
        cost_breakdown="${cost_breakdown}Cloud Storage (${storage_gb}GB): \$$storage_cost\n"
    fi

    # Add networking costs (estimate)
    local network_cost=5.00
    total_cost=$(echo "scale=2; $total_cost + $network_cost" | bc)
    cost_breakdown="${cost_breakdown}Networking (estimated): \$$network_cost\n"

    # Display results
    echo
    log_highlight "Current Month Cost Estimate"
    echo "=========================="
    echo -e "$cost_breakdown"
    echo "------------------------"
    log_highlight "Total Estimated: \$$total_cost"

    # Check against thresholds
    if (( $(echo "$total_cost > $COST_THRESHOLD_CRITICAL" | bc -l) )); then
        log_error "CRITICAL: Costs exceed \$$COST_THRESHOLD_CRITICAL threshold!"
        recommend_cost_reduction
    elif (( $(echo "$total_cost > $COST_THRESHOLD_WARNING" | bc -l) )); then
        log_warning "WARNING: Costs exceed \$$COST_THRESHOLD_WARNING threshold"
        recommend_cost_optimization
    else
        log_success "Costs are within acceptable range"
    fi
}

check_free_tier_usage() {
    log_info "Checking free tier resource usage..."

    echo
    echo "🎁 Free Tier Usage Status"
    echo "========================"

    # Compute Engine free tier
    local gce_hours=$(gcloud compute instances list --format="csv[no-heading](name,zone,status,machineType)" | wc -l)
    if [ $gce_hours -gt 0 ]; then
        echo "Compute Engine: Using $gce_hours instances (744 hours/month free)"
    else
        echo "Compute Engine: No instances running ✅"
    fi

    # Check machine types
    local non_micro_instances=$(gcloud compute instances list --filter="machineType.scope()~e2-micro" --format="value(name)" | wc -l)
    if [ $non_micro_instances -eq 0 ]; then
        echo "Machine Types: All instances are e2-micro (free tier) ✅"
    else
        echo "Machine Types: Some instances are NOT e2-micro ⚠️"
    fi

    # Cloud Storage
    local bucket_name="$GOOGLE_CLOUD_PROJECT-udp-storage"
    if gsutil ls -b "gs://$bucket_name" &>/dev/null; then
        local storage_size=$(gsutil du -s "gs://$bucket_name" 2>/dev/null | awk '{print $1}' || echo "0")
        local storage_gb=$(echo "scale=2; $storage_size / 1024 / 1024 / 1024" | bc)
        echo "Cloud Storage: ${storage_gb}GB used (5GB free)"
        if (( $(echo "$storage_gb > 5" | bc -l) )); then
            log_warning "Storage exceeds free tier limit!"
        fi
    else
        echo "Cloud Storage: No buckets found ✅"
    fi

    # Networking
    echo "Networking: Monitoring egress (1GB/month free to North America)"

    # Cloud SQL
    if gcloud sql instances describe udp-postgres &>/dev/null; then
        local sql_tier=$(gcloud sql instances describe udp-postgres --format="value(settings.tier)")
        if [ "$sql_tier" = "db-f1-micro" ]; then
            echo "Cloud SQL: Using db-f1-micro ✅"
        else
            echo "Cloud SQL: Using $sql_tier (not free tier) ⚠️"
        fi
    fi
}

get_detailed_billing() {
    log_info "Getting detailed billing information..."

    # Export billing data (requires additional permissions)
    local export_available=false

    # Check if billing export is configured
    if gcloud beta billing accounts describe "$BILLING_ACCOUNT" --format="json" | jq -r '.datasetId' | grep -v null; then
        export_available=true
        log_info "Billing export is configured"
    else
        log_warning "Billing export not configured - detailed cost breakdown unavailable"
    fi

    if [ "$export_available" = true ]; then
        show_detailed_costs
    else
        show_setup_billing_export
    fi
}

show_detailed_costs() {
    log_info "Fetching detailed cost breakdown..."

    # This would require BigQuery access to billing export data
    # For now, show service-level cost estimates
    echo
    echo "📊 Service-Level Cost Breakdown"
    echo "=============================="

    # Get service usage (simplified)
    echo "Compute Engine:"
    gcloud compute instances list --format="table(name,zone,machineType.scope(),status,creationTimestamp.date())"

    echo
    echo "Kubernetes Engine:"
    gcloud container clusters list --format="table(name,location,currentNodeCount,status,createTime.date())"

    echo
    echo "Cloud SQL:"
    gcloud sql instances list --format="table(name,region,tier,backendType,status,createTime.date())"

    echo
    echo "Redis:"
    gcloud redis instances list --format="table(name,region,tier,memorySizeGb,state,createTime.date())"
}

show_setup_billing_export() {
    echo
    log_info "Setting up billing export for detailed cost tracking..."

    cat << EOF

To get detailed cost breakdowns, set up billing export:

1. Create a BigQuery dataset:
   gcloud bigquery datasets create --location=US udp_billing

2. Enable billing export (in Cloud Console):
   - Go to Billing → Billing export
   - Select "Create export"
   - Choose BigQuery as destination
   - Select your dataset: udp_billing

3. Wait 24 hours for data to populate

4. Run detailed cost queries with:
   ./check-costs.sh --detailed

EOF
}

recommend_cost_reduction() {
    echo
    log_error "🚨 IMMEDIATE COST REDUCTION NEEDED"
    echo "=================================="

    cat << EOF

Immediate actions to reduce costs:

1. Scale down deployments:
   kubectl scale deployment udp-api --replicas=1 -n udp
   kubectl scale deployment udp-worker --replicas=0 -n udp

2. Use preemptible nodes:
   ./scale-down.sh

3. Stop non-essential services:
   kubectl delete deployment udp-redis-exporter -n udp

4. Consider temporary shutdown:
   ./cleanup-resources.sh

5. Set up automatic shutdown:
   # Scale to zero during off-hours
   crontab -e
   0 18 * * * kubectl scale deployment udp-api --replicas=0 -n udp
   0 8 * * MON-FRI kubectl scale deployment udp-api --replicas=1 -n udp

EOF
}

recommend_cost_optimization() {
    echo
    log_warning "💡 COST OPTIMIZATION RECOMMENDATIONS"
    echo "===================================="

    cat << EOF

Optimization suggestions:

1. Use committed use discounts for sustained workloads
2. Enable cluster autoscaling with aggressive scale-down
3. Use spot/preemptible instances for non-critical workloads
4. Implement proper resource requests/limits
5. Use Cloud Storage lifecycle policies
6. Monitor and optimize egress traffic
7. Review and clean up unused resources regularly

Run these commands:
- ./scale-down.sh (temporary cost reduction)
- ./optimize-resources.sh (resource optimization)

EOF
}

setup_budget_alerts() {
    log_info "Setting up budget alerts..."

    cat > /tmp/budget-config.json << EOF
{
  "displayName": "UDP Monthly Budget",
  "budgetFilter": {
    "projects": ["projects/$GOOGLE_CLOUD_PROJECT"],
    "services": [
      "services/6F81-5844-456A",
      "services/95FF-2EF5-5EA1",
      "services/24E6-581D-38E5"
    ]
  },
  "amount": {
    "specifiedAmount": {
      "currencyCode": "USD",
      "units": "50"
    }
  },
  "thresholdRules": [
    {
      "thresholdPercent": 0.5,
      "spendBasis": "CURRENT_SPEND"
    },
    {
      "thresholdPercent": 0.8,
      "spendBasis": "CURRENT_SPEND"
    },
    {
      "thresholdPercent": 1.0,
      "spendBasis": "CURRENT_SPEND"
    }
  ]
}
EOF

    # Create budget (requires billing admin permissions)
    if gcloud beta billing budgets create --billing-account="$BILLING_ACCOUNT" --budget-from-file="/tmp/budget-config.json" &>/dev/null; then
        log_success "Budget alert created"
    else
        log_warning "Could not create budget alert - check permissions"
        log_info "Create manually at: https://console.cloud.google.com/billing/budgets"
    fi

    rm -f /tmp/budget-config.json
}

generate_cost_report() {
    log_info "Generating cost report..."

    local report_file="udp-cost-report-$(date +%Y%m%d).txt"

    cat > "$report_file" << EOF
UDP GCP Cost Report - $(date)
===========================

Project: $GOOGLE_CLOUD_PROJECT
Region: $GOOGLE_CLOUD_REGION
Report Generated: $(date)

CURRENT RESOURCES:
-----------------
$(gcloud compute instances list --format="table(name,zone,machineType.scope(),status)" 2>/dev/null || echo "No compute instances")

$(gcloud container clusters list --format="table(name,location,currentNodeCount,status)" 2>/dev/null || echo "No GKE clusters")

$(gcloud sql instances list --format="table(name,region,tier,status)" 2>/dev/null || echo "No Cloud SQL instances")

$(gcloud redis instances list --format="table(name,region,tier,memorySizeGb,state)" 2>/dev/null || echo "No Redis instances")

COST RECOMMENDATIONS:
--------------------
• Use committed use discounts for sustained workloads
• Enable cluster autoscaling with proper node pools
• Implement resource quotas and limits
• Use preemptible instances for fault-tolerant workloads
• Monitor and optimize network egress
• Set up automated shutdown schedules

USEFUL COMMANDS:
---------------
# Check current costs
./check-costs.sh

# Scale down for cost savings
./scale-down.sh

# Optimize resources
kubectl describe nodes | grep -A 5 "Allocated resources"

# Monitor usage
gcloud monitoring metrics list

BILLING DASHBOARD:
-----------------
https://console.cloud.google.com/billing

EOF

    log_success "Cost report saved to: $report_file"
}

main() {
    echo "💰 UDP GCP Cost Monitoring"
    echo "========================="
    echo

    if [ -n "${GOOGLE_CLOUD_PROJECT:-}" ]; then
        log_info "Project: $GOOGLE_CLOUD_PROJECT"
        log_info "Region: ${GOOGLE_CLOUD_REGION:-us-central1}"
    else
        log_error "No project configuration found"
        exit 1
    fi

    echo

    get_billing_account
    check_current_costs
    check_free_tier_usage
    get_detailed_billing
    setup_budget_alerts
    generate_cost_report

    echo
    log_success "Cost monitoring completed!"
    echo
    log_info "Next steps:"
    echo "1. Review the cost report generated"
    echo "2. Set up billing alerts in the console"
    echo "3. Consider running ./scale-down.sh if costs are high"
    echo "4. Monitor regularly with: ./check-costs.sh"
}

# Check for command line arguments
case "${1:-}" in
    --detailed)
        get_billing_account
        show_detailed_costs
        ;;
    --setup-alerts)
        get_billing_account
        setup_budget_alerts
        ;;
    --report-only)
        generate_cost_report
        ;;
    *)
        main "$@"
        ;;
esac