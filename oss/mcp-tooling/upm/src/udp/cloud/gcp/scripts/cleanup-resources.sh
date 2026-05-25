#!/bin/bash

# UDP GCP Resource Cleanup Script
# Comprehensive cleanup of all UDP resources to avoid costs

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load configuration
if [ -f .env.gcp ]; then
    source .env.gcp
else
    echo "❌ .env.gcp file not found. Some operations may fail."
fi

# Configuration
FORCE_CLEANUP=${1:-false}

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

confirm_cleanup() {
    if [ "$FORCE_CLEANUP" != "true" ]; then
        echo
        log_warning "This will DELETE ALL UDP resources in project: $GOOGLE_CLOUD_PROJECT"
        log_warning "This action CANNOT be undone!"
        echo
        echo "Resources that will be deleted:"
        echo "• GKE cluster and all workloads"
        echo "• Cloud SQL instance and databases"
        echo "• Redis instance"
        echo "• Container images"
        echo "• Storage buckets"
        echo "• Load balancers and static IPs"
        echo "• VPC networks and firewall rules"
        echo "• Service accounts and IAM bindings"
        echo "• Secrets"
        echo
        read -p "Are you absolutely sure you want to proceed? (type 'DELETE' to confirm): " confirmation

        if [ "$confirmation" != "DELETE" ]; then
            log_info "Cleanup cancelled"
            exit 0
        fi
    fi

    log_warning "Starting cleanup in 10 seconds... Press Ctrl+C to cancel"
    sleep 10
}

cleanup_kubernetes_resources() {
    log_info "Cleaning up Kubernetes resources..."

    # Check if cluster exists and is accessible
    if ! kubectl cluster-info &>/dev/null; then
        log_warning "Cannot access Kubernetes cluster - it may already be deleted"
        return
    fi

    # Delete namespace (this will cascade delete all resources)
    if kubectl get namespace udp &>/dev/null; then
        log_info "Deleting UDP namespace and all resources..."
        kubectl delete namespace udp --force --grace-period=0 || log_warning "Failed to delete namespace cleanly"

        # Wait for namespace deletion
        local timeout=300
        local elapsed=0
        while kubectl get namespace udp &>/dev/null && [ $elapsed -lt $timeout ]; do
            echo "Waiting for namespace deletion... ($elapsed/$timeout seconds)"
            sleep 10
            elapsed=$((elapsed + 10))
        done

        if kubectl get namespace udp &>/dev/null; then
            log_warning "Namespace deletion timed out - some resources may remain"
        else
            log_success "Namespace deleted successfully"
        fi
    else
        log_info "UDP namespace not found"
    fi

    # Clean up any remaining resources
    log_info "Cleaning up any remaining Kubernetes resources..."

    # Delete any persistent volumes
    kubectl get pv -o jsonpath='{.items[?(@.spec.claimRef.namespace=="udp")].metadata.name}' | xargs -r kubectl delete pv || true

    # Delete any cluster roles/bindings related to UDP
    kubectl delete clusterrole,clusterrolebinding -l app=udp || true

    log_success "Kubernetes resources cleaned up"
}

cleanup_gke_cluster() {
    log_info "Deleting GKE cluster..."

    if gcloud container clusters describe udp-cluster --region="$GOOGLE_CLOUD_REGION" &>/dev/null; then
        log_info "Deleting GKE cluster: udp-cluster"
        gcloud container clusters delete udp-cluster \
            --region="$GOOGLE_CLOUD_REGION" \
            --quiet
        log_success "GKE cluster deleted"
    else
        log_info "GKE cluster not found or already deleted"
    fi
}

cleanup_cloud_sql() {
    log_info "Deleting Cloud SQL instance..."

    if gcloud sql instances describe udp-postgres &>/dev/null; then
        log_info "Deleting Cloud SQL instance: udp-postgres"

        # Disable deletion protection first
        gcloud sql instances patch udp-postgres --no-deletion-protection --quiet || true

        # Delete the instance
        gcloud sql instances delete udp-postgres --quiet
        log_success "Cloud SQL instance deleted"
    else
        log_info "Cloud SQL instance not found or already deleted"
    fi
}

cleanup_redis() {
    log_info "Deleting Redis instance..."

    if gcloud redis instances describe udp-redis --region="$GOOGLE_CLOUD_REGION" &>/dev/null; then
        log_info "Deleting Redis instance: udp-redis"
        gcloud redis instances delete udp-redis \
            --region="$GOOGLE_CLOUD_REGION" \
            --quiet
        log_success "Redis instance deleted"
    else
        log_info "Redis instance not found or already deleted"
    fi
}

cleanup_container_images() {
    log_info "Deleting container images..."

    # List and delete UDP images
    local images=$(gcloud container images list --repository="gcr.io/$GOOGLE_CLOUD_PROJECT" --filter="name~udp" --format="value(name)" 2>/dev/null || echo "")

    if [ -n "$images" ]; then
        for image in $images; do
            log_info "Deleting image: $image"
            gcloud container images delete "$image" --quiet --force-delete-tags || log_warning "Failed to delete $image"
        done
        log_success "Container images deleted"
    else
        log_info "No UDP container images found"
    fi
}

cleanup_storage() {
    log_info "Deleting Cloud Storage bucket..."

    local bucket_name="$GOOGLE_CLOUD_PROJECT-udp-storage"

    if gsutil ls -b "gs://$bucket_name" &>/dev/null; then
        log_info "Deleting storage bucket: $bucket_name"

        # Remove all objects first
        gsutil -m rm -r "gs://$bucket_name/**" 2>/dev/null || true

        # Delete bucket
        gsutil rb "gs://$bucket_name"
        log_success "Storage bucket deleted"
    else
        log_info "Storage bucket not found or already deleted"
    fi
}

cleanup_networking() {
    log_info "Cleaning up networking resources..."

    # Delete static IP
    if gcloud compute addresses describe udp-ip --global &>/dev/null; then
        log_info "Deleting static IP: udp-ip"
        gcloud compute addresses delete udp-ip --global --quiet
    fi

    # Delete firewall rules
    local firewall_rules=("udp-allow-internal" "udp-allow-https" "udp-allow-health-checks")
    for rule in "${firewall_rules[@]}"; do
        if gcloud compute firewall-rules describe "$rule" &>/dev/null; then
            log_info "Deleting firewall rule: $rule"
            gcloud compute firewall-rules delete "$rule" --quiet
        fi
    done

    # Delete VPC peering
    if gcloud services vpc-peerings list --network=udp-vpc | grep -q servicenetworking; then
        log_info "Deleting VPC peering..."
        gcloud services vpc-peerings delete \
            --service=servicenetworking.googleapis.com \
            --network=udp-vpc --quiet || log_warning "Failed to delete VPC peering"
    fi

    # Delete private IP allocation
    if gcloud compute addresses describe udp-private-ip-range --global &>/dev/null; then
        log_info "Deleting private IP range: udp-private-ip-range"
        gcloud compute addresses delete udp-private-ip-range --global --quiet
    fi

    # Delete subnet
    if gcloud compute networks subnets describe udp-subnet --region="$GOOGLE_CLOUD_REGION" &>/dev/null; then
        log_info "Deleting subnet: udp-subnet"
        gcloud compute networks subnets delete udp-subnet \
            --region="$GOOGLE_CLOUD_REGION" --quiet
    fi

    # Delete VPC network
    if gcloud compute networks describe udp-vpc &>/dev/null; then
        log_info "Deleting VPC network: udp-vpc"
        gcloud compute networks delete udp-vpc --quiet
    fi

    log_success "Networking resources cleaned up"
}

cleanup_iam() {
    log_info "Cleaning up IAM resources..."

    # Service accounts to clean up
    local service_accounts=("udp-api" "udp-worker" "udp-monitoring" "udp-backup")

    for sa in "${service_accounts[@]}"; do
        local sa_email="$sa@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com"

        if gcloud iam service-accounts describe "$sa_email" &>/dev/null; then
            log_info "Deleting service account: $sa"

            # Remove IAM policy bindings first
            local roles=$(gcloud projects get-iam-policy "$GOOGLE_CLOUD_PROJECT" --flatten="bindings[].members" --filter="bindings.members:serviceAccount:$sa_email" --format="value(bindings.role)" 2>/dev/null || echo "")

            for role in $roles; do
                log_info "Removing role $role from $sa"
                gcloud projects remove-iam-policy-binding "$GOOGLE_CLOUD_PROJECT" \
                    --member="serviceAccount:$sa_email" \
                    --role="$role" --quiet || true
            done

            # Delete service account
            gcloud iam service-accounts delete "$sa_email" --quiet
        fi
    done

    # Delete custom roles
    local custom_roles=("udp.databaseAccess" "udp.storageAccess")
    for role in "${custom_roles[@]}"; do
        if gcloud iam roles describe "$role" --project="$GOOGLE_CLOUD_PROJECT" &>/dev/null; then
            log_info "Deleting custom role: $role"
            gcloud iam roles delete "$role" --project="$GOOGLE_CLOUD_PROJECT" --quiet
        fi
    done

    log_success "IAM resources cleaned up"
}

cleanup_secrets() {
    log_info "Deleting secrets..."

    local secrets=("udp-jwt-secret" "udp-session-secret" "udp-encryption-key" "udp-db-password")

    for secret in "${secrets[@]}"; do
        if gcloud secrets describe "$secret" &>/dev/null; then
            log_info "Deleting secret: $secret"
            gcloud secrets delete "$secret" --quiet
        fi
    done

    log_success "Secrets deleted"
}

cleanup_monitoring() {
    log_info "Cleaning up monitoring resources..."

    # Delete budget
    local budgets=$(gcloud beta billing budgets list --billing-account=$(gcloud beta billing accounts list --filter="open:true" --format="value(name)" | head -1) --format="value(name)" --filter="displayName~UDP" 2>/dev/null || echo "")

    for budget in $budgets; do
        log_info "Deleting budget: $budget"
        gcloud beta billing budgets delete "$budget" --quiet || log_warning "Failed to delete budget"
    done

    # Delete alert policies
    local policies=$(gcloud alpha monitoring policies list --filter="displayName~UDP" --format="value(name)" 2>/dev/null || echo "")

    for policy in $policies; do
        log_info "Deleting alert policy: $policy"
        gcloud alpha monitoring policies delete "$policy" --quiet || log_warning "Failed to delete alert policy"
    done

    log_success "Monitoring resources cleaned up"
}

cleanup_build_artifacts() {
    log_info "Cleaning up build artifacts..."

    # Delete Cloud Build triggers
    local triggers=$(gcloud builds triggers list --filter="name~udp" --format="value(id)" 2>/dev/null || echo "")

    for trigger in $triggers; do
        log_info "Deleting Cloud Build trigger: $trigger"
        gcloud builds triggers delete "$trigger" --quiet || log_warning "Failed to delete trigger"
    done

    # Clean up build history
    local builds=$(gcloud builds list --filter="source.repoSource.repoName~udp OR tags~udp" --format="value(id)" --limit=50 2>/dev/null || echo "")

    for build in $builds; do
        log_info "Cancelling/cleaning build: $build"
        gcloud builds cancel "$build" --quiet 2>/dev/null || true
    done

    log_success "Build artifacts cleaned up"
}

verify_cleanup() {
    log_info "Verifying cleanup completion..."

    local remaining_resources=0

    # Check for remaining resources
    if gcloud container clusters list --filter="name~udp" --format="value(name)" | grep -q .; then
        log_warning "Some GKE clusters may still exist"
        remaining_resources=$((remaining_resources + 1))
    fi

    if gcloud sql instances list --filter="name~udp" --format="value(name)" | grep -q .; then
        log_warning "Some Cloud SQL instances may still exist"
        remaining_resources=$((remaining_resources + 1))
    fi

    if gcloud redis instances list --filter="displayName~udp" --format="value(displayName)" | grep -q .; then
        log_warning "Some Redis instances may still exist"
        remaining_resources=$((remaining_resources + 1))
    fi

    if gcloud compute networks list --filter="name~udp" --format="value(name)" | grep -q .; then
        log_warning "Some VPC networks may still exist"
        remaining_resources=$((remaining_resources + 1))
    fi

    if [ $remaining_resources -eq 0 ]; then
        log_success "Cleanup verification passed - no remaining resources found"
    else
        log_warning "Cleanup verification found $remaining_resources resource types that may need manual cleanup"
        log_info "Run 'gcloud projects list' and check the console for any remaining resources"
    fi
}

estimate_cost_savings() {
    log_info "Estimating cost savings from cleanup..."

    cat << EOF

💰 Estimated Monthly Cost Savings:
================================

Resources Cleaned Up:
• GKE Cluster (1 node, e2-micro): ~\$15-25/month
• Cloud SQL (db-f1-micro): ~\$10-15/month
• Redis (Basic, 1GB): ~\$25-35/month
• Load Balancer: ~\$18/month
• Storage and egress: ~\$5-10/month
• Networking: ~\$5/month

Total Estimated Savings: ~\$78-108/month

Note: These are rough estimates. Actual costs depend on usage patterns.
Always check your billing dashboard for accurate information.

EOF
}

cleanup_local_files() {
    log_info "Cleaning up local configuration files..."

    # Clean up local files
    rm -f .env.gcp
    rm -f deployment-info.txt
    rm -f service-accounts-summary.txt
    rm -f teddk-integration-info.txt
    rm -f /tmp/udp-port-forward.pid

    # Clean up temporary manifests
    rm -rf /tmp/udp-manifests

    # Clean up kubectl context if it exists
    kubectl config delete-context "gke_${GOOGLE_CLOUD_PROJECT}_${GOOGLE_CLOUD_REGION}_udp-cluster" 2>/dev/null || true

    log_success "Local configuration files cleaned up"
}

main() {
    echo "🧹 UDP GCP Resource Cleanup"
    echo "=========================="
    echo

    if [ -n "${GOOGLE_CLOUD_PROJECT:-}" ]; then
        log_info "Project: $GOOGLE_CLOUD_PROJECT"
        log_info "Region: ${GOOGLE_CLOUD_REGION:-us-central1}"
    else
        log_warning "No project configuration found - some cleanup operations may be skipped"
    fi

    confirm_cleanup

    log_info "Starting comprehensive cleanup..."
    echo

    # Cleanup in reverse order of creation
    cleanup_kubernetes_resources
    cleanup_gke_cluster
    cleanup_cloud_sql
    cleanup_redis
    cleanup_container_images
    cleanup_storage
    cleanup_networking
    cleanup_iam
    cleanup_secrets
    cleanup_monitoring
    cleanup_build_artifacts
    cleanup_local_files

    verify_cleanup
    estimate_cost_savings

    echo
    log_success "UDP resource cleanup completed!"
    echo
    log_info "Recommendations:"
    echo "1. Check your GCP billing dashboard to confirm cost reductions"
    echo "2. Verify no unexpected charges appear in the next billing cycle"
    echo "3. Consider disabling unused APIs to avoid quota charges"
    echo "4. Review and clean up any remaining project-level resources"
    echo
    log_warning "If you plan to redeploy UDP, you'll need to run the setup scripts again"
}

main "$@"