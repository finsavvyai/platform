#!/bin/bash

# UDP GCP Project Configuration Script
# Sets up networking, storage, and infrastructure components

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

# Configuration
CLUSTER_NAME="udp-cluster"
VPC_NAME="udp-vpc"
SUBNET_NAME="udp-subnet"
DATABASE_INSTANCE="udp-postgres"
REDIS_INSTANCE="udp-redis"

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

create_vpc_network() {
    log_info "Creating VPC network and subnets..."

    # Create VPC network
    if ! gcloud compute networks describe "$VPC_NAME" &>/dev/null; then
        gcloud compute networks create "$VPC_NAME" \
            --subnet-mode=custom \
            --description="UDP VPC Network"
        log_success "VPC network created: $VPC_NAME"
    else
        log_info "VPC network already exists: $VPC_NAME"
    fi

    # Create subnet
    if ! gcloud compute networks subnets describe "$SUBNET_NAME" --region="$GOOGLE_CLOUD_REGION" &>/dev/null; then
        gcloud compute networks subnets create "$SUBNET_NAME" \
            --network="$VPC_NAME" \
            --range="10.0.0.0/16" \
            --region="$GOOGLE_CLOUD_REGION" \
            --enable-ip-alias \
            --secondary-range=pods=10.1.0.0/16,services=10.2.0.0/16
        log_success "Subnet created: $SUBNET_NAME"
    else
        log_info "Subnet already exists: $SUBNET_NAME"
    fi

    # Create firewall rules for internal communication
    create_firewall_rules
}

create_firewall_rules() {
    log_info "Creating firewall rules..."

    # Allow internal communication
    if ! gcloud compute firewall-rules describe "udp-allow-internal" &>/dev/null; then
        gcloud compute firewall-rules create "udp-allow-internal" \
            --network="$VPC_NAME" \
            --allow=tcp,udp,icmp \
            --source-ranges="10.0.0.0/8" \
            --description="Allow internal communication in UDP VPC"
        log_success "Internal firewall rule created"
    fi

    # Allow HTTPS from anywhere for load balancer
    if ! gcloud compute firewall-rules describe "udp-allow-https" &>/dev/null; then
        gcloud compute firewall-rules create "udp-allow-https" \
            --network="$VPC_NAME" \
            --allow=tcp:443,tcp:80 \
            --source-ranges="0.0.0.0/0" \
            --target-tags="udp-lb" \
            --description="Allow HTTPS traffic to UDP load balancer"
        log_success "HTTPS firewall rule created"
    fi

    # Allow health checks
    if ! gcloud compute firewall-rules describe "udp-allow-health-checks" &>/dev/null; then
        gcloud compute firewall-rules create "udp-allow-health-checks" \
            --network="$VPC_NAME" \
            --allow=tcp \
            --source-ranges="130.211.0.0/22,35.191.0.0/16" \
            --target-tags="udp-app" \
            --description="Allow GCP health checks"
        log_success "Health check firewall rule created"
    fi
}

create_gke_cluster() {
    log_info "Creating GKE cluster optimized for free tier..."

    if gcloud container clusters describe "$CLUSTER_NAME" --region="$GOOGLE_CLOUD_REGION" &>/dev/null; then
        log_info "GKE cluster already exists: $CLUSTER_NAME"
        return
    fi

    # Create cluster with free tier optimizations
    gcloud container clusters create "$CLUSTER_NAME" \
        --region="$GOOGLE_CLOUD_REGION" \
        --network="$VPC_NAME" \
        --subnetwork="$SUBNET_NAME" \
        --cluster-secondary-range-name=pods \
        --services-secondary-range-name=services \
        --machine-type="e2-micro" \
        --disk-type="pd-standard" \
        --disk-size="10GB" \
        --num-nodes=1 \
        --min-nodes=1 \
        --max-nodes=3 \
        --enable-autoscaling \
        --enable-autorepair \
        --enable-autoupgrade \
        --maintenance-window-start="2023-01-01T09:00:00Z" \
        --maintenance-window-end="2023-01-01T17:00:00Z" \
        --maintenance-window-recurrence="FREQ=WEEKLY;BYDAY=SA" \
        --preemptible \
        --enable-network-policy \
        --enable-ip-alias \
        --enable-cloud-logging \
        --enable-cloud-monitoring \
        --addons=HorizontalPodAutoscaling,HttpLoadBalancing,NetworkPolicy \
        --workload-pool="$GOOGLE_CLOUD_PROJECT.svc.id.goog" \
        --labels="project=udp,environment=production,cost-optimization=true"

    log_success "GKE cluster created: $CLUSTER_NAME"

    # Get cluster credentials
    gcloud container clusters get-credentials "$CLUSTER_NAME" --region="$GOOGLE_CLOUD_REGION"
    log_success "Cluster credentials configured"
}

create_cloud_sql() {
    log_info "Creating Cloud SQL PostgreSQL instance..."

    if gcloud sql instances describe "$DATABASE_INSTANCE" &>/dev/null; then
        log_info "Cloud SQL instance already exists: $DATABASE_INSTANCE"
        return
    fi

    # Generate secure password
    DB_PASSWORD=$(openssl rand -base64 32)

    # Create Cloud SQL instance (free tier eligible)
    gcloud sql instances create "$DATABASE_INSTANCE" \
        --database-version=POSTGRES_13 \
        --tier=db-f1-micro \
        --region="$GOOGLE_CLOUD_REGION" \
        --storage-type=HDD \
        --storage-size=10GB \
        --storage-auto-increase \
        --backup-start-time=02:00 \
        --enable-bin-log \
        --maintenance-window-day=SUN \
        --maintenance-window-hour=03 \
        --maintenance-release-channel=production \
        --deletion-protection \
        --labels="project=udp,environment=production,component=database"

    log_success "Cloud SQL instance created: $DATABASE_INSTANCE"

    # Create database
    gcloud sql databases create "udp" --instance="$DATABASE_INSTANCE"
    log_success "Database 'udp' created"

    # Create database user
    gcloud sql users create "udp" \
        --instance="$DATABASE_INSTANCE" \
        --password="$DB_PASSWORD"
    log_success "Database user 'udp' created"

    # Store password securely
    echo "$DB_PASSWORD" | gcloud secrets create "udp-db-password" --data-file=-
    log_success "Database password stored in Secret Manager"

    # Enable private IP for cluster access
    setup_private_services_access
}

setup_private_services_access() {
    log_info "Setting up private services access for Cloud SQL..."

    # Allocate IP range for private services
    if ! gcloud compute addresses describe "udp-private-ip-range" --global &>/dev/null; then
        gcloud compute addresses create "udp-private-ip-range" \
            --global \
            --purpose=VPC_PEERING \
            --prefix-length=16 \
            --network="$VPC_NAME"
        log_success "Private IP range allocated"
    fi

    # Create private connection
    if ! gcloud services vpc-peerings list --network="$VPC_NAME" | grep -q "servicenetworking"; then
        gcloud services vpc-peerings connect \
            --service=servicenetworking.googleapis.com \
            --ranges="udp-private-ip-range" \
            --network="$VPC_NAME"
        log_success "Private services access configured"
    fi

    # Update Cloud SQL instance to use private IP
    gcloud sql instances patch "$DATABASE_INSTANCE" \
        --network="$VPC_NAME" \
        --no-assign-ip
    log_info "Cloud SQL configured for private access"
}

create_redis_instance() {
    log_info "Creating Redis instance..."

    if gcloud redis instances describe "$REDIS_INSTANCE" --region="$GOOGLE_CLOUD_REGION" &>/dev/null; then
        log_info "Redis instance already exists: $REDIS_INSTANCE"
        return
    fi

    # Create Redis instance (Basic tier for cost optimization)
    gcloud redis instances create "$REDIS_INSTANCE" \
        --region="$GOOGLE_CLOUD_REGION" \
        --network="$VPC_NAME" \
        --size=1 \
        --redis-version=redis_6_x \
        --tier=basic \
        --labels="project=udp,environment=production,component=cache"

    log_success "Redis instance created: $REDIS_INSTANCE"
}

create_storage_bucket() {
    log_info "Creating Cloud Storage bucket..."

    BUCKET_NAME="$GOOGLE_CLOUD_PROJECT-udp-storage"

    if gsutil ls -b "gs://$BUCKET_NAME" &>/dev/null; then
        log_info "Storage bucket already exists: $BUCKET_NAME"
        return
    fi

    # Create bucket with free tier optimizations
    gsutil mb -l "$GOOGLE_CLOUD_REGION" "gs://$BUCKET_NAME"

    # Set lifecycle policy to manage costs
    cat > /tmp/lifecycle.json << EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "SetStorageClass", "storageClass": "NEARLINE"},
        "condition": {"age": 30}
      },
      {
        "action": {"type": "SetStorageClass", "storageClass": "COLDLINE"},
        "condition": {"age": 90}
      },
      {
        "action": {"type": "Delete"},
        "condition": {"age": 365}
      }
    ]
  }
}
EOF

    gsutil lifecycle set /tmp/lifecycle.json "gs://$BUCKET_NAME"
    rm /tmp/lifecycle.json

    log_success "Storage bucket created: $BUCKET_NAME"
}

setup_workload_identity() {
    log_info "Setting up Workload Identity..."

    # Enable Workload Identity on cluster
    gcloud container clusters update "$CLUSTER_NAME" \
        --region="$GOOGLE_CLOUD_REGION" \
        --workload-pool="$GOOGLE_CLOUD_PROJECT.svc.id.goog"

    log_success "Workload Identity enabled on cluster"
}

main() {
    echo "🔧 UDP GCP Project Configuration"
    echo "================================"
    echo

    log_info "Project: $GOOGLE_CLOUD_PROJECT"
    log_info "Region: $GOOGLE_CLOUD_REGION"
    log_info "Zone: $GOOGLE_CLOUD_ZONE"
    echo

    create_vpc_network
    create_gke_cluster
    create_cloud_sql
    create_redis_instance
    create_storage_bucket
    setup_workload_identity

    echo
    log_success "Project configuration completed!"
    echo
    log_info "Resources created:"
    echo "• VPC Network: $VPC_NAME"
    echo "• GKE Cluster: $CLUSTER_NAME"
    echo "• Cloud SQL: $DATABASE_INSTANCE"
    echo "• Redis: $REDIS_INSTANCE"
    echo "• Storage: $GOOGLE_CLOUD_PROJECT-udp-storage"
    echo
    log_info "Next step: Run ./create-service-accounts.sh"
}

main "$@"