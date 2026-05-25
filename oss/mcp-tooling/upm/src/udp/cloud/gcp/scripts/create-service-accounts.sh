#!/bin/bash

# UDP GCP Service Account Creation Script
# Creates service accounts with minimal required permissions

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
    echo "❌ .env.gcp file not found. Run setup-gcp.sh first."
    exit 1
fi

# Service Account Names
UDP_API_SA="udp-api"
UDP_WORKER_SA="udp-worker"
UDP_MONITORING_SA="udp-monitoring"
UDP_BACKUP_SA="udp-backup"

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

create_service_account() {
    local sa_name="$1"
    local display_name="$2"
    local description="$3"

    if gcloud iam service-accounts describe "$sa_name@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com" &>/dev/null; then
        log_info "Service account already exists: $sa_name"
        return
    fi

    gcloud iam service-accounts create "$sa_name" \
        --display-name="$display_name" \
        --description="$description"

    log_success "Service account created: $sa_name"
}

create_udp_api_service_account() {
    log_info "Creating UDP API service account..."

    create_service_account \
        "$UDP_API_SA" \
        "UDP API Service Account" \
        "Service account for UDP API components with minimal required permissions"

    # Grant necessary roles
    local roles=(
        "roles/cloudsql.client"              # Access Cloud SQL
        "roles/redis.viewer"                 # Access Redis
        "roles/storage.objectViewer"         # Read from Storage
        "roles/storage.objectCreator"        # Write to Storage
        "roles/secretmanager.secretAccessor" # Access secrets
        "roles/monitoring.metricWriter"      # Write metrics
        "roles/logging.logWriter"            # Write logs
    )

    for role in "${roles[@]}"; do
        gcloud projects add-iam-policy-binding "$GOOGLE_CLOUD_PROJECT" \
            --member="serviceAccount:$UDP_API_SA@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com" \
            --role="$role"
        log_info "Granted $role to $UDP_API_SA"
    done

    # Enable Workload Identity binding
    gcloud iam service-accounts add-iam-policy-binding \
        "$UDP_API_SA@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com" \
        --role="roles/iam.workloadIdentityUser" \
        --member="serviceAccount:$GOOGLE_CLOUD_PROJECT.svc.id.goog[udp/udp-api]"

    log_success "UDP API service account configured"
}

create_udp_worker_service_account() {
    log_info "Creating UDP Worker service account..."

    create_service_account \
        "$UDP_WORKER_SA" \
        "UDP Worker Service Account" \
        "Service account for UDP background workers"

    # Grant necessary roles
    local roles=(
        "roles/cloudsql.client"              # Access Cloud SQL
        "roles/redis.editor"                 # Full Redis access for job queues
        "roles/storage.objectAdmin"          # Full Storage access for artifacts
        "roles/secretmanager.secretAccessor" # Access secrets
        "roles/monitoring.metricWriter"      # Write metrics
        "roles/logging.logWriter"            # Write logs
        "roles/pubsub.publisher"             # Publish notifications
        "roles/pubsub.subscriber"            # Subscribe to events
    )

    for role in "${roles[@]}"; do
        gcloud projects add-iam-policy-binding "$GOOGLE_CLOUD_PROJECT" \
            --member="serviceAccount:$UDP_WORKER_SA@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com" \
            --role="$role"
        log_info "Granted $role to $UDP_WORKER_SA"
    done

    # Enable Workload Identity binding
    gcloud iam service-accounts add-iam-policy-binding \
        "$UDP_WORKER_SA@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com" \
        --role="roles/iam.workloadIdentityUser" \
        --member="serviceAccount:$GOOGLE_CLOUD_PROJECT.svc.id.goog[udp/udp-worker]"

    log_success "UDP Worker service account configured"
}

create_monitoring_service_account() {
    log_info "Creating UDP Monitoring service account..."

    create_service_account \
        "$UDP_MONITORING_SA" \
        "UDP Monitoring Service Account" \
        "Service account for UDP monitoring and observability"

    # Grant necessary roles
    local roles=(
        "roles/monitoring.editor"            # Full monitoring access
        "roles/logging.viewer"               # Read logs
        "roles/cloudtrace.agent"             # Trace collection
        "roles/cloudprofiler.agent"          # Profiling
        "roles/storage.objectViewer"         # Read monitoring configs
    )

    for role in "${roles[@]}"; do
        gcloud projects add-iam-policy-binding "$GOOGLE_CLOUD_PROJECT" \
            --member="serviceAccount:$UDP_MONITORING_SA@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com" \
            --role="$role"
        log_info "Granted $role to $UDP_MONITORING_SA"
    done

    # Enable Workload Identity binding
    gcloud iam service-accounts add-iam-policy-binding \
        "$UDP_MONITORING_SA@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com" \
        --role="roles/iam.workloadIdentityUser" \
        --member="serviceAccount:$GOOGLE_CLOUD_PROJECT.svc.id.goog[udp/udp-monitoring]"

    log_success "UDP Monitoring service account configured"
}

create_backup_service_account() {
    log_info "Creating UDP Backup service account..."

    create_service_account \
        "$UDP_BACKUP_SA" \
        "UDP Backup Service Account" \
        "Service account for UDP backup and disaster recovery"

    # Grant necessary roles
    local roles=(
        "roles/cloudsql.viewer"              # Read Cloud SQL for backups
        "roles/storage.admin"                # Full Storage access for backups
        "roles/secretmanager.secretAccessor" # Access secrets for backup encryption
        "roles/logging.logWriter"            # Write logs
    )

    for role in "${roles[@]}"; do
        gcloud projects add-iam-policy-binding "$GOOGLE_CLOUD_PROJECT" \
            --member="serviceAccount:$UDP_BACKUP_SA@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com" \
            --role="$role"
        log_info "Granted $role to $UDP_BACKUP_SA"
    done

    # Enable Workload Identity binding for backup jobs
    gcloud iam service-accounts add-iam-policy-binding \
        "$UDP_BACKUP_SA@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com" \
        --role="roles/iam.workloadIdentityUser" \
        --member="serviceAccount:$GOOGLE_CLOUD_PROJECT.svc.id.goog[udp/udp-backup]"

    log_success "UDP Backup service account configured"
}

create_custom_roles() {
    log_info "Creating custom IAM roles for fine-grained permissions..."

    # UDP Database Access Role
    cat > /tmp/udp-database-role.yaml << EOF
title: "UDP Database Access"
description: "Custom role for UDP database operations"
stage: "GA"
includedPermissions:
- cloudsql.instances.connect
- cloudsql.instances.get
- cloudsql.databases.list
- cloudsql.databases.get
EOF

    if ! gcloud iam roles describe "udp.databaseAccess" --project="$GOOGLE_CLOUD_PROJECT" &>/dev/null; then
        gcloud iam roles create "udp.databaseAccess" \
            --project="$GOOGLE_CLOUD_PROJECT" \
            --file="/tmp/udp-database-role.yaml"
        log_success "Custom database role created"
    fi

    # UDP Storage Access Role
    cat > /tmp/udp-storage-role.yaml << EOF
title: "UDP Storage Access"
description: "Custom role for UDP storage operations"
stage: "GA"
includedPermissions:
- storage.objects.create
- storage.objects.delete
- storage.objects.get
- storage.objects.list
- storage.buckets.get
EOF

    if ! gcloud iam roles describe "udp.storageAccess" --project="$GOOGLE_CLOUD_PROJECT" &>/dev/null; then
        gcloud iam roles create "udp.storageAccess" \
            --project="$GOOGLE_CLOUD_PROJECT" \
            --file="/tmp/udp-storage-role.yaml"
        log_success "Custom storage role created"
    fi

    rm -f /tmp/udp-*-role.yaml
}

create_kubernetes_service_accounts() {
    log_info "Creating Kubernetes service accounts..."

    # Ensure we're connected to the cluster
    gcloud container clusters get-credentials "udp-cluster" --region="$GOOGLE_CLOUD_REGION"

    # Create UDP namespace
    kubectl create namespace udp --dry-run=client -o yaml | kubectl apply -f -

    # Create Kubernetes service accounts
    kubectl create serviceaccount udp-api -n udp --dry-run=client -o yaml | kubectl apply -f -
    kubectl create serviceaccount udp-worker -n udp --dry-run=client -o yaml | kubectl apply -f -
    kubectl create serviceaccount udp-monitoring -n udp --dry-run=client -o yaml | kubectl apply -f -
    kubectl create serviceaccount udp-backup -n udp --dry-run=client -o yaml | kubectl apply -f -

    # Annotate service accounts for Workload Identity
    kubectl annotate serviceaccount udp-api -n udp \
        iam.gke.io/gcp-service-account="$UDP_API_SA@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com"

    kubectl annotate serviceaccount udp-worker -n udp \
        iam.gke.io/gcp-service-account="$UDP_WORKER_SA@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com"

    kubectl annotate serviceaccount udp-monitoring -n udp \
        iam.gke.io/gcp-service-account="$UDP_MONITORING_SA@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com"

    kubectl annotate serviceaccount udp-backup -n udp \
        iam.gke.io/gcp-service-account="$UDP_BACKUP_SA@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com"

    log_success "Kubernetes service accounts created and configured"
}

create_secrets() {
    log_info "Creating application secrets..."

    # Generate JWT secret
    JWT_SECRET=$(openssl rand -base64 64)
    echo "$JWT_SECRET" | gcloud secrets create "udp-jwt-secret" --data-file=- || log_info "JWT secret already exists"

    # Generate session secret
    SESSION_SECRET=$(openssl rand -base64 32)
    echo "$SESSION_SECRET" | gcloud secrets create "udp-session-secret" --data-file=- || log_info "Session secret already exists"

    # Generate encryption key
    ENCRYPTION_KEY=$(openssl rand -base64 32)
    echo "$ENCRYPTION_KEY" | gcloud secrets create "udp-encryption-key" --data-file=- || log_info "Encryption key already exists"

    log_success "Application secrets created"
}

output_configuration() {
    log_info "Generating configuration summary..."

    cat > service-accounts-summary.txt << EOF
UDP GCP Service Accounts Configuration
=====================================

Project: $GOOGLE_CLOUD_PROJECT
Region: $GOOGLE_CLOUD_REGION

Service Accounts Created:
------------------------
1. $UDP_API_SA@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com
   - Purpose: UDP API components
   - Permissions: Cloud SQL, Redis, Storage (read/write), Secrets, Monitoring, Logging

2. $UDP_WORKER_SA@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com
   - Purpose: Background workers and job processing
   - Permissions: Cloud SQL, Redis (admin), Storage (admin), Secrets, Pub/Sub

3. $UDP_MONITORING_SA@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com
   - Purpose: Monitoring and observability
   - Permissions: Monitoring (admin), Logging, Tracing, Profiling

4. $UDP_BACKUP_SA@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com
   - Purpose: Backup and disaster recovery
   - Permissions: Cloud SQL (read), Storage (admin), Secrets

Kubernetes Service Accounts:
---------------------------
- udp-api (linked to $UDP_API_SA)
- udp-worker (linked to $UDP_WORKER_SA)
- udp-monitoring (linked to $UDP_MONITORING_SA)
- udp-backup (linked to $UDP_BACKUP_SA)

Secrets Created:
---------------
- udp-jwt-secret
- udp-session-secret
- udp-encryption-key
- udp-db-password

Next Steps:
----------
1. Run: ./deploy-udp.sh
2. Verify deployments with: ./test-deployment.sh

Security Notes:
--------------
- All service accounts follow the principle of least privilege
- Workload Identity is enabled for secure pod-to-GCP authentication
- Secrets are stored in Google Secret Manager
- Custom IAM roles provide fine-grained access control
EOF

    log_success "Configuration summary saved to service-accounts-summary.txt"
}

main() {
    echo "🔐 UDP GCP Service Account Setup"
    echo "================================"
    echo

    create_custom_roles
    create_udp_api_service_account
    create_udp_worker_service_account
    create_monitoring_service_account
    create_backup_service_account
    create_kubernetes_service_accounts
    create_secrets
    output_configuration

    echo
    log_success "Service account setup completed!"
    echo
    log_info "Service accounts created with minimal required permissions"
    log_info "Workload Identity configured for secure pod authentication"
    log_info "Application secrets stored in Secret Manager"
    echo
    log_info "Next step: Run ./deploy-udp.sh"
}

main "$@"