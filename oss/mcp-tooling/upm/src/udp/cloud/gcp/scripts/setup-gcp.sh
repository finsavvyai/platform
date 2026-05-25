#!/bin/bash

# UDP GCP Setup Script
# Comprehensive setup for Google Cloud Platform deployment

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_PREFIX="udp"
REGION="us-central1"  # Free tier region
ZONE="us-central1-a"  # Free tier zone

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

check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if gcloud is installed
    if ! command -v gcloud &> /dev/null; then
        log_error "gcloud CLI is not installed. Please install it first:"
        echo "https://cloud.google.com/sdk/docs/install"
        exit 1
    fi

    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        log_warning "kubectl is not installed. Installing..."
        gcloud components install kubectl
    fi

    # Check if docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first:"
        echo "https://docs.docker.com/get-docker/"
        exit 1
    fi

    log_success "Prerequisites check completed"
}

authenticate_gcloud() {
    log_info "Authenticating with Google Cloud..."

    # Check if already authenticated
    if gcloud auth list --filter="status:ACTIVE" --format="value(account)" | grep -q "@"; then
        log_info "Already authenticated with gcloud"
        CURRENT_ACCOUNT=$(gcloud auth list --filter="status:ACTIVE" --format="value(account)")
        log_info "Current account: $CURRENT_ACCOUNT"

        read -p "Do you want to use this account? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            gcloud auth login
        fi
    else
        gcloud auth login
    fi

    # Enable application default credentials
    log_info "Setting up application default credentials..."
    gcloud auth application-default login

    log_success "Authentication completed"
}

create_or_select_project() {
    log_info "Setting up GCP project..."

    # Generate unique project ID
    TIMESTAMP=$(date +%s)
    PROJECT_ID="${PROJECT_PREFIX}-${TIMESTAMP}"

    echo "Available options:"
    echo "1. Create new project: $PROJECT_ID"
    echo "2. Use existing project"

    read -p "Select option (1 or 2): " -n 1 -r
    echo

    if [[ $REPLY == "1" ]]; then
        log_info "Creating new project: $PROJECT_ID"

        # Check if project already exists
        if gcloud projects describe "$PROJECT_ID" &>/dev/null; then
            log_error "Project $PROJECT_ID already exists"
            exit 1
        fi

        # Create project
        gcloud projects create "$PROJECT_ID" --name="UDP - Universal Dependency Platform"

        # Set as current project
        gcloud config set project "$PROJECT_ID"

        log_success "Project $PROJECT_ID created and selected"

        # Setup billing (if needed)
        setup_billing

    else
        # List available projects
        log_info "Available projects:"
        gcloud projects list --format="table(projectId,name,projectNumber)"

        read -p "Enter project ID: " PROJECT_ID

        # Validate project exists
        if ! gcloud projects describe "$PROJECT_ID" &>/dev/null; then
            log_error "Project $PROJECT_ID does not exist"
            exit 1
        fi

        # Set as current project
        gcloud config set project "$PROJECT_ID"
        log_success "Using existing project: $PROJECT_ID"
    fi

    # Set default region and zone
    gcloud config set compute/region "$REGION"
    gcloud config set compute/zone "$ZONE"
}

setup_billing() {
    log_info "Setting up billing..."

    # Check if billing is enabled
    if gcloud beta billing projects describe "$PROJECT_ID" &>/dev/null; then
        log_success "Billing is already enabled for this project"
        return
    fi

    # List billing accounts
    BILLING_ACCOUNTS=$(gcloud beta billing accounts list --format="value(name)" --filter="open:true")

    if [ -z "$BILLING_ACCOUNTS" ]; then
        log_warning "No active billing accounts found"
        log_info "Please set up billing in the Google Cloud Console:"
        log_info "https://console.cloud.google.com/billing"
        log_info "Then run this script again"
        exit 1
    fi

    # If only one billing account, use it
    BILLING_COUNT=$(echo "$BILLING_ACCOUNTS" | wc -l)
    if [ "$BILLING_COUNT" -eq 1 ]; then
        BILLING_ACCOUNT=$BILLING_ACCOUNTS
        log_info "Using billing account: $BILLING_ACCOUNT"
    else
        log_info "Available billing accounts:"
        gcloud beta billing accounts list --format="table(name,displayName,open)"
        read -p "Enter billing account ID: " BILLING_ACCOUNT
    fi

    # Link billing account to project
    gcloud beta billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT"
    log_success "Billing account linked to project"
}

enable_apis() {
    log_info "Enabling required Google Cloud APIs..."

    APIS=(
        "container.googleapis.com"         # Google Kubernetes Engine
        "compute.googleapis.com"           # Compute Engine
        "cloudbuild.googleapis.com"        # Cloud Build
        "containerregistry.googleapis.com" # Container Registry
        "monitoring.googleapis.com"        # Cloud Monitoring
        "logging.googleapis.com"           # Cloud Logging
        "cloudsql.googleapis.com"          # Cloud SQL
        "redis.googleapis.com"             # Cloud Memorystore
        "storage.googleapis.com"           # Cloud Storage
        "iam.googleapis.com"               # Identity and Access Management
        "cloudresourcemanager.googleapis.com" # Cloud Resource Manager
        "servicenetworking.googleapis.com" # Service Networking
        "sqladmin.googleapis.com"          # Cloud SQL Admin
        "secretmanager.googleapis.com"     # Secret Manager
    )

    for api in "${APIS[@]}"; do
        log_info "Enabling $api..."
        gcloud services enable "$api"
    done

    log_success "All required APIs enabled"
}

setup_cost_monitoring() {
    log_info "Setting up cost monitoring and budget alerts..."

    # Create budget for free tier ($5 alert threshold)
    cat > /tmp/budget-config.json << EOF
{
  "displayName": "UDP Free Tier Budget",
  "budgetFilter": {
    "projects": ["projects/$PROJECT_ID"]
  },
  "amount": {
    "specifiedAmount": {
      "currencyCode": "USD",
      "units": "50"
    }
  },
  "thresholdRules": [
    {
      "thresholdPercent": 0.1,
      "spendBasis": "CURRENT_SPEND"
    },
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
  ],
  "allUpdatesRule": {
    "monitoringNotificationChannels": [],
    "disableDefaultIamRecipients": false
  }
}
EOF

    # Note: Budget creation requires billing API and permissions
    log_warning "Budget alerts need to be configured manually in the console:"
    log_info "https://console.cloud.google.com/billing/budgets"

    rm -f /tmp/budget-config.json
}

configure_defaults() {
    log_info "Configuring default settings..."

    # Set default cluster credentials
    gcloud container clusters get-credentials udp-cluster --region="$REGION" 2>/dev/null || true

    # Configure Docker for Container Registry
    gcloud auth configure-docker

    # Set default project for all subsequent commands
    export GOOGLE_CLOUD_PROJECT="$PROJECT_ID"

    # Create environment file
    cat > .env.gcp << EOF
# GCP Configuration for UDP
GOOGLE_CLOUD_PROJECT=$PROJECT_ID
GOOGLE_CLOUD_REGION=$REGION
GOOGLE_CLOUD_ZONE=$ZONE
GCP_REGISTRY=gcr.io/$PROJECT_ID
EOF

    log_success "Default settings configured"
}

main() {
    echo "🚀 UDP Google Cloud Platform Setup"
    echo "=================================="
    echo

    check_prerequisites
    authenticate_gcloud
    create_or_select_project
    enable_apis
    setup_cost_monitoring
    configure_defaults

    echo
    log_success "GCP setup completed successfully!"
    echo
    log_info "Next steps:"
    echo "1. Run: ./configure-project.sh"
    echo "2. Run: ./create-service-accounts.sh"
    echo "3. Run: ./deploy-udp.sh"
    echo
    log_info "Project ID: $PROJECT_ID"
    log_info "Region: $REGION"
    log_info "Zone: $ZONE"
    echo
    log_warning "Don't forget to set up billing alerts in the console:"
    log_info "https://console.cloud.google.com/billing/budgets"
}

# Export variables for other scripts
export PROJECT_ID REGION ZONE

main "$@"