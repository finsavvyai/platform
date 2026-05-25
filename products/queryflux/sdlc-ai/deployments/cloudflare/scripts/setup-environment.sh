#!/bin/bash

# =============================================================================
# SDLC.ai Platform - Environment Setup Script
# =============================================================================
# This script sets up environment-specific configurations and secrets
# Usage: ./setup-environment.sh [environment]
# =============================================================================

set -euo pipefail

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

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

# Generate secure random strings
generate_secret() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

# Setup development environment
setup_development() {
    log_info "Setting up development environment..."

    cat > .env.development << EOF
# =============================================================================
# SDLC.ai Platform - Development Environment Configuration
# =============================================================================
# Generated on: $(date)
# Environment: development
# =============================================================================

# Application Configuration
ENVIRONMENT=development
LOG_LEVEL=debug
SERVICE_VERSION=1.0.0
PLATFORM_NAME=SDLC.ai
API_VERSION=v1

# Security Secrets
JWT_SECRET=$(generate_secret)
API_KEY_ENCRYPTION_KEY=$(generate_secret)
SESSION_ENCRYPTION_KEY=$(generate_secret)
MFA_ENCRYPTION_KEY=$(generate_secret)

# External Service API Keys
OPENAI_API_KEY=your-openai-api-key-here
ANTHROPIC_API_KEY=your-anthropic-api-key-here
COHERE_API_KEY=your-cohere-api-key-here
DLP_API_KEY=your-dlp-api-key-here

# Database Configuration
BACKUP_ENCRYPTION_KEY=$(generate_secret)

# Monitoring and Observability
SENTRY_DSN=your-sentry-dsn-here
DATADOG_API_KEY=your-datadog-api-key-here
LOGTAIL_TOKEN=your-logtail-token-here

# Third-party Integrations
WEBHOOK_SECRET=$(generate_secret)
NOTIFICATION_SERVICE_KEY=your-notification-key-here
EMAIL_SERVICE_API_KEY=your-email-api-key-here
BILLING_WEBHOOK_SECRET=$(generate_secret)

# Development-specific
DEV_API_KEYS=dev-key-1,dev-key-2
TEST_SECRETS=test-secret-1,test-secret-2
EOF

    log_success "Development environment configuration created in .env.development"
}

# Setup staging environment
setup_staging() {
    log_info "Setting up staging environment..."

    cat > .env.staging << EOF
# =============================================================================
# SDLC.ai Platform - Staging Environment Configuration
# =============================================================================
# Generated on: $(date)
# Environment: staging
# =============================================================================

# Application Configuration
ENVIRONMENT=staging
LOG_LEVEL=info
SERVICE_VERSION=1.0.0
PLATFORM_NAME=SDLC.ai
API_VERSION=v1

# Security Secrets
JWT_SECRET=$(generate_secret)
API_KEY_ENCRYPTION_KEY=$(generate_secret)
SESSION_ENCRYPTION_KEY=$(generate_secret)
MFA_ENCRYPTION_KEY=$(generate_secret)

# External Service API Keys
OPENAI_API_KEY=your-staging-openai-api-key-here
ANTHROPIC_API_KEY=your-staging-anthropic-api-key-here
COHERE_API_KEY=your-staging-cohere-api-key-here
DLP_API_KEY=your-staging-dlp-api-key-here

# Database Configuration
BACKUP_ENCRYPTION_KEY=$(generate_secret)

# Monitoring and Observability
SENTRY_DSN=your-staging-sentry-dsn-here
DATADOG_API_KEY=your-staging-datadog-api-key-here
LOGTAIL_TOKEN=your-staging-logtail-token-here

# Third-party Integrations
WEBHOOK_SECRET=$(generate_secret)
NOTIFICATION_SERVICE_KEY=your-staging-notification-key-here
EMAIL_SERVICE_API_KEY=your-staging-email-api-key-here
BILLING_WEBHOOK_SECRET=$(generate_secret)

# Staging-specific
STAGING_MODE=true
EXTERNAL_API_BASE_URL=https://api-staging.sdlc.ai
EOF

    log_success "Staging environment configuration created in .env.staging"
}

# Setup production environment
setup_production() {
    log_info "Setting up production environment..."

    cat > .env.production << EOF
# =============================================================================
# SDLC.ai Platform - Production Environment Configuration
# =============================================================================
# Generated on: $(date)
# Environment: production
# SECURITY: This file contains sensitive production secrets
# =============================================================================

# Application Configuration
ENVIRONMENT=production
LOG_LEVEL=warn
SERVICE_VERSION=1.0.0
PLATFORM_NAME=SDLC.ai
API_VERSION=v1

# Security Secrets (REPLACE WITH SECURE VALUES)
JWT_SECRET=REPLACE_WITH_PRODUCTION_JWT_SECRET
API_KEY_ENCRYPTION_KEY=REPLACE_WITH_PRODUCTION_ENCRYPTION_KEY
SESSION_ENCRYPTION_KEY=REPLACE_WITH_PRODUCTION_SESSION_KEY
MFA_ENCRYPTION_KEY=REPLACE_WITH_PRODUCTION_MFA_KEY

# External Service API Keys (REPLACE WITH PRODUCTION KEYS)
OPENAI_API_KEY=REPLACE_WITH_PRODUCTION_OPENAI_KEY
ANTHROPIC_API_KEY=REPLACE_WITH_PRODUCTION_ANTHROPIC_KEY
COHERE_API_KEY=REPLACE_WITH_PRODUCTION_COHERE_KEY
DLP_API_KEY=REPLACE_WITH_PRODUCTION_DLP_KEY

# Database Configuration
BACKUP_ENCRYPTION_KEY=REPLACE_WITH_PRODUCTION_BACKUP_KEY

# Monitoring and Observability
SENTRY_DSN=REPLACE_WITH_PRODUCTION_SENTRY_DSN
DATADOG_API_KEY=REPLACE_WITH_PRODUCTION_DATADOG_KEY
LOGTAIL_TOKEN=REPLACE_WITH_PRODUCTION_LOGTAIL_TOKEN

# Third-party Integrations
WEBHOOK_SECRET=REPLACE_WITH_PRODUCTION_WEBHOOK_SECRET
NOTIFICATION_SERVICE_KEY=REPLACE_WITH_PRODUCTION_NOTIFICATION_KEY
EMAIL_SERVICE_API_KEY=REPLACE_WITH_PRODUCTION_EMAIL_KEY
BILLING_WEBHOOK_SECRET=REPLACE_WITH_PRODUCTION_BILLING_WEBHOOK_SECRET

# Production-specific
PRODUCTION_MODE=true
EXTERNAL_API_BASE_URL=https://api.sdlc.ai
EOF

    log_success "Production environment configuration created in .env.production"
    log_warning "Please update the production secrets with secure values before deployment!"
}

# Create .gitignore entry for environment files
setup_gitignore() {
    if [ ! -f ".gitignore" ]; then
        touch .gitignore
    fi

    if ! grep -q ".env.*" .gitignore; then
        echo "" >> .gitignore
        echo "# Environment files with secrets" >> .gitignore
        echo ".env.development" >> .gitignore
        echo ".env.staging" >> .gitignore
        echo ".env.production" >> .gitignore
        echo ".env.local" >> .gitignore
        log_success "Added environment files to .gitignore"
    fi
}

# Validate environment parameter
validate_environment() {
    local env="$1"
    case $env in
        development|staging|production)
            return 0
            ;;
        all)
            return 0
            ;;
        *)
            log_error "Invalid environment: $env. Valid environments: development, staging, production, all"
            exit 1
            ;;
    esac
}

# Main setup function
main() {
    local env="${1:-all}"

    log_info "Setting up SDLC.ai Platform environment(s): $env"

    # Check if openssl is available
    if ! command -v openssl &> /dev/null; then
        log_error "OpenSSL is required to generate secure secrets. Please install OpenSSL."
        exit 1
    fi

    validate_environment "$env"

    # Setup .gitignore
    setup_gitignore

    # Setup requested environments
    case $env in
        development)
            setup_development
            ;;
        staging)
            setup_staging
            ;;
        production)
            setup_production
            ;;
        all)
            setup_development
            setup_staging
            setup_production
            ;;
    esac

    log_success "Environment setup completed!"
    log_info "Next steps:"
    echo "  1. Update the environment files with your actual API keys and secrets"
    echo "  2. Run: ./deploy-all.sh $env"
    echo "  3. Monitor the deployment with: ./scripts/monitor-deployment.sh $env"
}

# Help function
show_help() {
    echo "SDLC.ai Platform Environment Setup Script"
    echo ""
    echo "Usage: $0 [environment]"
    echo ""
    echo "Arguments:"
    echo "  environment    Environment to setup (development, staging, production, all)"
    echo ""
    echo "Examples:"
    echo "  $0 development    # Setup development environment only"
    echo "  $0 staging        # Setup staging environment only"
    echo "  $0 production     # Setup production environment only"
    echo "  $0 all            # Setup all environments (default)"
    echo ""
    echo "What this script does:"
    echo "  - Creates .env.{environment} files with secure random secrets"
    echo "  - Adds environment files to .gitignore"
    echo "  - Provides templates for all required configuration values"
    echo ""
    echo "Prerequisites:"
    echo "  - OpenSSL installed (for generating secure secrets)"
    echo "  - Write permissions in the current directory"
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
