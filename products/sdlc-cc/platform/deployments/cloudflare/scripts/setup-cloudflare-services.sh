#!/bin/bash
# =============================================================================
# SDLC.ai Platform - Cloudflare Services Setup Script
# =============================================================================
# This script configures all necessary Cloudflare services for the SDLC.ai platform
# =============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PLATFORM_NAME="SDLC.ai"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CLOUDFLARE_DIR="$PROJECT_ROOT/deployments/cloudflare"

# Helper functions
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

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if wrangler is installed
    if ! command -v wrangler &> /dev/null; then
        log_error "Wrangler CLI is not installed. Please install it with:"
        log_error "npm install -g wrangler"
        exit 1
    fi

    # Check if user is logged in to Cloudflare
    if ! wrangler whoami &> /dev/null; then
        log_error "Not logged in to Cloudflare. Please run:"
        log_error "wrangler auth login"
        exit 1
    fi

    # Check Cloudflare account
    ACCOUNT_ID=$(wrangler whoami | jq -r '.account.id // empty')
    if [ -z "$ACCOUNT_ID" ]; then
        log_error "Could not retrieve Cloudflare account ID"
        exit 1
    fi

    log_success "Prerequisites checked successfully"
    log_info "Using Cloudflare Account ID: $ACCOUNT_ID"
}

# Create D1 databases
create_d1_databases() {
    log_info "Setting up D1 databases..."

    local databases=(
        "sdlc-tenant-db:tenants"
        "sdlc-auth-db:auth"
        "sdlc-documents-db:documents"
        "sdlc-vector-metadata-db:vector"
        "sdlc-policy-db:policies"
    )

    for db_config in "${databases[@]}"; do
        IFS=':' read -r db_name migrations_dir <<< "$db_config"

        log_info "Creating D1 database: $db_name"

        # Create database for each environment
        for env in development staging production; do
            env_db_name="${db_name}-${env}"

            # Check if database already exists
            if wrangler d1 list | grep -q "$env_db_name"; then
                log_warning "Database $env_db_name already exists, skipping..."
                continue
            fi

            # Create database
            wrangler d1 create "$env_db_name

            # Update wrangler.toml with database ID
            DB_ID=$(wrangler d1 list | jq -r ".[] | select(.name==\"$env_db_name\") | .uuid")
            if [ -n "$DB_ID" ]; then
                # Update the database ID in wrangler.toml
                if [[ "$OSTYPE" == "darwin"* ]]; then
                    sed -i '' "s/${env}-${db_name}-placeholder/${DB_ID}/g" "$CLOUDFLARE_DIR/wrangler.toml"
                else
                    sed -i "s/${env}-${db_name}-placeholder/${DB_ID}/g" "$CLOUDFLARE_DIR/wrangler.toml"
                fi
                log_success "Created $env_db_name with ID: $DB_ID"
            fi
        done
    done

    log_success "D1 databases setup completed"
}

# Create KV namespaces
create_kv_namespaces() {
    log_info "Setting up KV namespaces..."

    local namespaces=(
        "CACHE"
        "SESSIONS"
        "RATE_LIMIT_CACHE"
        "EMBEDDING_CACHE"
        "SEARCH_CACHE"
    )

    for namespace in "${namespaces[@]}"; do
        log_info "Creating KV namespace: $namespace"

        # Create namespace for each environment
        for env in development staging production; do
            env_namespace="${namespace}-${env}"

            # Check if namespace already exists
            if wrangler kv namespace list | grep -q "$env_namespace"; then
                log_warning "KV namespace $env_namespace already exists, skipping..."
                continue
            fi

            # Create namespace
            wrangler kv namespace create "$env_namespace" --env "$env"

            # Get namespace ID
            NAMESPACE_ID=$(wrangler kv namespace list | jq -r ".[] | select(.title==\"$env_namespace\") | .id")
            if [ -n "$NAMESPACE_ID" ]; then
                # Update the namespace ID in wrangler.toml
                if [[ "$OSTYPE" == "darwin"* ]]; then
                    sed -i '' "s/${env}-${namespace,,}-kv-placeholder/${NAMESPACE_ID}/g" "$CLOUDFLARE_DIR/wrangler.toml"
                else
                    sed -i "s/${env}-${namespace,,}-kv-placeholder/${NAMESPACE_ID}/g" "$CLOUDFLARE_DIR/wrangler.toml"
                fi
                log_success "Created KV namespace $env_namespace with ID: $NAMESPACE_ID"
            fi
        done
    done

    log_success "KV namespaces setup completed"
}

# Create R2 buckets
create_r2_buckets() {
    log_info "Setting up R2 buckets..."

    local buckets=(
        "sdlc-documents"
        "sdlc-backup-archive"
        "sdlc-temp-uploads"
    )

    for bucket_name in "${buckets[@]}"; do
        log_info "Creating R2 bucket: $bucket_name"

        # Create bucket for each environment
        for env in development staging production; do
            env_bucket="${bucket_name}-${env}"

            # Check if bucket already exists
            if wrangler r2 bucket list | grep -q "$env_bucket"; then
                log_warning "R2 bucket $env_bucket already exists, skipping..."
                continue
            fi

            # Create bucket
            wrangler r2 bucket create "$env_bucket"
            log_success "Created R2 bucket: $env_bucket"
        done
    done

    log_success "R2 buckets setup completed"
}

# Create Vectorize indexes
create_vectorize_indexes() {
    log_info "Setting up Vectorize indexes..."

    local indexes=(
        "sdlc-semantic-search:openai-3-small:openai-3-large"
        "sdlc-document-vectors:openai-3-small:openai-3-large"
        "sdlc-code-vectors:openai-3-small:openai-3-large"
    )

    for index_config in "${indexes[@]}"; do
        IFS=':' read -r index_name preset preset_prod <<< "$index_config"

        log_info "Creating Vectorize index: $index_name"

        # Create index for each environment
        for env in development staging production; do
            env_index="${index_name}-${env}"

            # Check if index already exists
            if wrangler vectorize list | grep -q "$env_index"; then
                log_warning "Vectorize index $env_index already exists, skipping..."
                continue
            fi

            # Choose preset based on environment
            chosen_preset="$preset"
            if [ "$env" == "production" ]; then
                chosen_preset="$preset_prod"
            fi

            # Create index
            wrangler vectorize create "$env_index" --preset="$chosen_preset"

            # Get index ID
            INDEX_ID=$(wrangler vectorize list | jq -r ".[] | select(.name==\"$env_index\") | .index_id")
            if [ -n "$INDEX_ID" ]; then
                log_success "Created Vectorize index $env_index with ID: $INDEX_ID"
            fi
        done
    done

    log_success "Vectorize indexes setup completed"
}

# Create Queues
create_queues() {
    log_info "Setting up Cloudflare Queues..."

    local queues=(
        "sdlc-document-processing"
        "sdlc-embedding"
        "sdlc-dlp-scan"
        "sdlc-notifications"
        "sdlc-backup"
    )

    for queue_name in "${queues[@]}"; do
        log_info "Creating Queue: $queue_name"

        # Create queue for each environment
        for env in development staging production; do
            env_queue="${queue_name}-${env}"

            # Check if queue already exists
            if wrangler queues list | grep -q "$env_queue"; then
                log_warning "Queue $env_queue already exists, skipping..."
                continue
            fi

            # Create queue
            wrangler queues create "$env_queue"
            log_success "Created Queue: $env_queue"
        done
    done

    log_success "Queues setup completed"
}

# Configure custom domains
configure_domains() {
    log_info "Configuring custom domains..."

    local domains=(
        "api.sdlc.cc"
        "admin.sdlc.cc"
        "api-staging.sdlc.cc"
        "api-dev.sdlc.cc"
    )

    for domain in "${domains[@]}"; do
        log_info "Configuring domain: $domain"

        # Get zone ID
        ZONE_ID=$(wrangler zone list | jq -r ".[] | select(.name==\"sdlc.cc\") | .id")
        if [ -n "$ZONE_ID" ]; then
            log_success "Domain $domain is ready for configuration"
            # Note: Actual DNS configuration needs to be done manually
            # or via Cloudflare API with proper permissions
        fi
    done

    log_success "Domain configuration completed"
}

# Set up secrets prompt
setup_secrets_prompt() {
    log_info "Setting up required secrets..."
    log_warning "Please set the following secrets using 'wrangler secret put <SECRET_NAME>'"

    cat << EOF

Required secrets for ${PLATFORM_NAME}:

Authentication & Security:
- JWT_SECRET: High-entropy secret for JWT tokens
- API_KEY_ENCRYPTION_KEY: Encryption key for API keys
- SESSION_ENCRYPTION_KEY: Session encryption key
- MFA_ENCRYPTION_KEY: Multi-factor authentication encryption

External Services:
- OPENAI_API_KEY: OpenAI API key for embeddings and models
- ANTHROPIC_API_KEY: Anthropic API key for Claude models
- COHERE_API_KEY: Cohere API key for alternative embeddings
- DLP_API_KEY: Data Loss Prevention service API key

Database & Storage:
- SUPABASE_URL: Supabase connection URL (if used)
- SUPABASE_SERVICE_ROLE_KEY: Supabase service role key
- BACKUP_ENCRYPTION_KEY: Backup encryption key

Monitoring & Observability:
- SENTRY_DSN: Sentry error tracking DSN
- DATADOG_API_KEY: DataDog monitoring API key
- LOGTAIL_TOKEN: Logtail logging token

Example commands:
wrangler secret put JWT_SECRET --env development
wrangler secret put OPENAI_API_KEY --env production
wrangler secret put SENTRY_DSN --env staging

EOF
}

# Run migrations
run_migrations() {
    log_info "Running database migrations..."

    cd "$CLOUDFLARE_DIR"

    # Run migrations for each environment
    for env in development staging production; do
        log_info "Running migrations for $env environment..."

        # Run all migration directories
        for migration_dir in migrations/*/; do
            if [ -d "$migration_dir" ]; then
                log_info "Running migrations from $(basename $migration_dir)..."
                wrangler d1 migrations apply --env "$env" --remote "$(basename $migration_dir)"
            fi
        done
    done

    log_success "Database migrations completed"
}

# Verify setup
verify_setup() {
    log_info "Verifying Cloudflare services setup..."

    # Check D1 databases
    log_info "Checking D1 databases..."
    wrangler d1 list

    # Check KV namespaces
    log_info "Checking KV namespaces..."
    wrangler kv namespace list

    # Check R2 buckets
    log_info "Checking R2 buckets..."
    wrangler r2 bucket list

    # Check Vectorize indexes
    log_info "Checking Vectorize indexes..."
    wrangler vectorize list

    # Check Queues
    log_info "Checking Queues..."
    wrangler queues list

    log_success "Setup verification completed"
}

# Main execution
main() {
    echo "=========================================="
    echo "${PLATFORM_NAME} Cloudflare Setup"
    echo "=========================================="
    echo

    # Parse command line arguments
    SKIP_D1=${SKIP_D1:-false}
    SKIP_KV=${SKIP_KV:-false}
    SKIP_R2=${SKIP_R2:-false}
    SKIP_VECTORIZE=${SKIP_VECTORIZE:-false}
    SKIP_QUEUES=${SKIP_QUEUES:-false}
    SKIP_MIGRATIONS=${SKIP_MIGRATIONS:-false}

    # Check prerequisites
    check_prerequisites

    # Create services
    if [ "$SKIP_D1" != "true" ]; then
        create_d1_databases
    fi

    if [ "$SKIP_KV" != "true" ]; then
        create_kv_namespaces
    fi

    if [ "$SKIP_R2" != "true" ]; then
        create_r2_buckets
    fi

    if [ "$SKIP_VECTORIZE" != "true" ]; then
        create_vectorize_indexes
    fi

    if [ "$SKIP_QUEUES" != "true" ]; then
        create_queues
    fi

    # Configure domains
    configure_domains

    # Setup secrets prompt
    setup_secrets_prompt

    # Run migrations
    if [ "$SKIP_MIGRATIONS" != "true" ]; then
        run_migrations
    fi

    # Verify setup
    verify_setup

    echo
    log_success "${PLATFORM_NAME} Cloudflare services setup completed successfully!"
    echo
    log_info "Next steps:"
    log_info "1. Set up the required secrets as prompted above"
    log_info "2. Configure custom domains in Cloudflare dashboard"
    log_info "3. Deploy services using: ./scripts/deploy-all.sh"
    echo
}

# Show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  --skip-d1          Skip D1 database creation"
    echo "  --skip-kv          Skip KV namespace creation"
    echo "  --skip-r2          Skip R2 bucket creation"
    echo "  --skip-vectorize   Skip Vectorize index creation"
    echo "  --skip-queues      Skip Queue creation"
    echo "  --skip-migrations  Skip database migrations"
    echo "  --help, -h         Show this help message"
    echo
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-d1)
            SKIP_D1=true
            shift
            ;;
        --skip-kv)
            SKIP_KV=true
            shift
            ;;
        --skip-r2)
            SKIP_R2=true
            shift
            ;;
        --skip-vectorize)
            SKIP_VECTORIZE=true
            shift
            ;;
        --skip-queues)
            SKIP_QUEUES=true
            shift
            ;;
        --skip-migrations)
            SKIP_MIGRATIONS=true
            shift
            ;;
        --help|-h)
            show_usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Run main function
main
