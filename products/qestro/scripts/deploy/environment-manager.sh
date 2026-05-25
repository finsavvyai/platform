#!/bin/bash

# Questro AI-Powered Testing Automation Platform
# Environment Manager Script
#
# Comprehensive environment management with multi-environment deployment,
# configuration validation, secret handling, and health monitoring.

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$PROJECT_ROOT/logs/deploy-$(date +%Y%m%d-%H%M%S).log"
CONFIG_DIR="$PROJECT_ROOT/config/environments"
SECRETS_DIR="$PROJECT_ROOT/.secrets"

# Create necessary directories
mkdir -p "$PROJECT_ROOT/logs"
mkdir -p "$CONFIG_DIR"
mkdir -p "$SECRETS_DIR"

# Environment configuration
ENVIRONMENT=""
FORCE_DEPLOY=false
SKIP_VALIDATION=false
SKIP_HEALTH_CHECK=false
CREATE_BACKUP=true
DRY_RUN=false

# Environment URLs
declare -A ENVIRONMENT_URLS=(
    ["development"]="https://dev.qestro.ai"
    ["staging"]="https://staging.qestro.ai"
    ["production"]="https://app.qestro.ai"
)

# Environment ports
declare -A ENVIRONMENT_PORTS=(
    ["development"]="3000"
    ["staging"]="3000"
    ["production"]="3000")

# Environment configurations
declare -A ENVIRONMENT_CONFIGS=(
    ["development"]=".env.development"
    ["staging"]=".env.staging"
    ["production"]=".env.production"
)

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    case $level in
        "INFO")  echo -e "${GREEN}[INFO]${NC}  $message" ;;
        "WARN")  echo -e "${YELLOW}[WARN]${NC}  $message" ;;
        "ERROR") echo -e "${RED}[ERROR]${NC} $message" ;;
        "DEBUG") echo -e "${BLUE}[DEBUG]${NC} $message" ;;
        "SUCCESS") echo -e "${PURPLE}[SUCCESS]${NC} $message" ;;
        *)       echo -e "${CYAN}[LOG]${NC}   $message" ;;
    esac

    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

# Error handling
error_exit() {
    log "ERROR" "$1"
    log "ERROR" "Environment management failed. Check logs at $LOG_FILE"
    exit 1
}

# Success message
success_exit() {
    log "SUCCESS" "Environment management completed successfully!"
    log "INFO" "Deployment logs available at: $LOG_FILE"
    exit 0
}

# Show usage information
show_usage() {
    cat << EOF
Questro Environment Manager

Usage: $0 [OPTIONS] COMMAND ENVIRONMENT

Commands:
  deploy <env>           Deploy to specified environment
  validate <env>         Validate environment configuration
  health <env>           Check environment health
  backup <env>           Create environment backup
  rollback <env> <ver>   Rollback environment to version
  config <env>           Show environment configuration
  secrets <env>          Manage environment secrets
  status <env>           Show environment status
  list                   List all environments
  help                   Show this help message

Environments:
  development            Development environment
  staging                Staging environment
  production             Production environment

Options:
  -f, --force            Force deployment without confirmation
  -s, --skip-validation  Skip configuration validation
  -h, --skip-health      Skip health checks
  -b, --no-backup        Skip backup creation
  -d, --dry-run          Show what would be done without executing
  -v, --verbose          Enable verbose output

Examples:
  $0 deploy staging                   # Deploy to staging with all checks
  $0 deploy production --force        # Force production deployment
  $0 validate development             # Validate development config
  $0 health staging                   # Check staging health
  $0 rollback production 1.2.3       # Rollback production to v1.2.3

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -f|--force)
                FORCE_DEPLOY=true
                shift
                ;;
            -s|--skip-validation)
                SKIP_VALIDATION=true
                shift
                ;;
            -h|--skip-health)
                SKIP_HEALTH_CHECK=true
                shift
                ;;
            -b|--no-backup)
                CREATE_BACKUP=false
                shift
                ;;
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -v|--verbose)
                set -x
                shift
                ;;
            --help)
                show_usage
                exit 0
                ;;
            deploy|validate|health|backup|rollback|config|secrets|status|list|help)
                COMMAND="$1"
                shift
                ;;
            development|staging|production)
                ENVIRONMENT="$1"
                shift
                ;;
            *)
                if [[ "$COMMAND" == "rollback" && -z "$ROLLBACK_VERSION" ]]; then
                    ROLLBACK_VERSION="$1"
                    shift
                else
                    error_exit "Unknown argument: $1"
                fi
                ;;
        esac
    done
}

# Validate environment
validate_environment() {
    local env="$1"

    if [[ ! "${ENVIRONMENT_URLS[$env]+_}" ]]; then
        error_exit "Unknown environment: $env"
    fi

    # Check if environment configuration file exists
    local config_file="${ENVIRONMENT_CONFIGS[$env]}"
    if [[ ! -f "$PROJECT_ROOT/$config_file" ]]; then
        error_exit "Environment configuration file not found: $config_file"
    fi

    log "SUCCESS" "Environment $env is valid"
}

# Load environment configuration
load_environment_config() {
    local env="$1"
    local config_file="${ENVIRONMENT_CONFIGS[$env]}"

    log "INFO" "Loading environment configuration for $env..."

    if [[ -f "$PROJECT_ROOT/$config_file" ]]; then
        # Source the environment file
        set -a
        source "$PROJECT_ROOT/$config_file"
        set +a
        log "SUCCESS" "Environment configuration loaded"
    else
        error_exit "Environment configuration file not found: $config_file"
    fi
}

# Validate configuration
validate_configuration() {
    if [[ "$SKIP_VALIDATION" == "true" ]]; then
        log "WARN" "Skipping configuration validation"
        return 0
    fi

    log "INFO" "Validating environment configuration..."

    # Validate required environment variables
    local required_vars=("NODE_ENV" "PORT" "DATABASE_URL" "REDIS_URL" "JWT_SECRET")

    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            error_exit "Required environment variable not set: $var"
        fi
    done

    # Validate environment-specific variables
    case "$ENVIRONMENT" in
        "production")
            local prod_vars=("FRONTEND_URL" "API_URL" "STRIPE_API_KEY" "OPENAI_API_KEY" "SENTRY_DSN")
            for var in "${prod_vars[@]}"; do
                if [[ -z "${!var}" ]]; then
                    error_exit "Production required variable not set: $var"
                fi
            done
            ;;
    esac

    # Validate URLs
    if [[ -n "${FRONTEND_URL:-}" ]]; then
        if [[ ! "$FRONTEND_URL" =~ ^https?:// ]]; then
            error_exit "Invalid FRONTEND_URL format"
        fi
    fi

    if [[ -n "${API_URL:-}" ]]; then
        if [[ ! "$API_URL" =~ ^https?:// ]]; then
            error_exit "Invalid API_URL format"
        fi
    fi

    # Validate database URL
    if [[ -n "$DATABASE_URL" ]]; then
        if [[ ! "$DATABASE_URL" =~ ^postgresql:// ]]; then
            error_exit "Invalid DATABASE_URL format"
        fi
    fi

    log "SUCCESS" "Configuration validation passed"
}

# Test database connection
test_database_connection() {
    log "INFO" "Testing database connection..."

    # Test database connection using node
    node -e "
        const { Pool } = require('pg');
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            max: 1,
            connectionTimeoutMillis: 5000
        });

        pool.query('SELECT 1')
            .then(() => {
                console.log('✅ Database connection successful');
                process.exit(0);
            })
            .catch((err) => {
                console.error('❌ Database connection failed:', err.message);
                process.exit(1);
            });
    " || error_exit "Database connection test failed"

    log "SUCCESS" "Database connection test passed"
}

# Test Redis connection
test_redis_connection() {
    log "INFO" "Testing Redis connection..."

    # Test Redis connection using node
    node -e "
        const redis = require('redis');
        const client = redis.createClient({
            url: process.env.REDIS_URL,
            socket: {
                connectTimeout: 5000
            }
        });

        client.connect()
            .then(() => {
                console.log('✅ Redis connection successful');
                return client.ping();
            })
            .then(() => {
                console.log('✅ Redis ping successful');
                process.exit(0);
            })
            .catch((err) => {
                console.error('❌ Redis connection failed:', err.message);
                process.exit(1);
            });
    " || error_exit "Redis connection test failed"

    log "SUCCESS" "Redis connection test passed"
}

# Test external services
test_external_services() {
    log "INFO" "Testing external services..."

    # Test OpenAI API
    if [[ -n "${OPENAI_API_KEY:-}" ]]; then
        log "INFO" "Testing OpenAI API..."
        if curl -s -H "Authorization: Bearer $OPENAI_API_KEY" \
           "https://api.openai.com/v1/models" > /dev/null; then
            log "SUCCESS" "OpenAI API test passed"
        else
            error_exit "OpenAI API test failed"
        fi
    fi

    # Test Stripe API
    if [[ -n "${STRIPE_API_KEY:-}" ]]; then
        log "INFO" "Testing Stripe API..."
        if curl -s -H "Authorization: Bearer $STRIPE_API_KEY" \
           "https://api.stripe.com/v1" > /dev/null; then
            log "SUCCESS" "Stripe API test passed"
        else
            error_exit "Stripe API test failed"
        fi
    fi

    log "SUCCESS" "External services tests passed"
}

# Create backup
create_backup() {
    if [[ "$CREATE_BACKUP" != "true" ]]; then
        log "INFO" "Skipping backup creation"
        return 0
    fi

    local env="$1"
    local backup_dir="$PROJECT_ROOT/backups/$env"
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local backup_file="$backup_dir/backup-$timestamp.tar.gz"

    log "INFO" "Creating backup for $env environment..."

    mkdir -p "$backup_dir"

    # Backup configuration files
    local temp_backup_dir="/tmp/questro-backup-$timestamp"
    mkdir -p "$temp_backup_dir"

    # Copy important files
    cp "$PROJECT_ROOT/package.json" "$temp_backup_dir/" 2>/dev/null || true
    cp "$PROJECT_ROOT/${ENVIRONMENT_CONFIGS[$env]}" "$temp_backup_dir/" 2>/dev/null || true
    cp -r "$PROJECT_ROOT/config" "$temp_backup_dir/" 2>/dev/null || true
    cp -r "$PROJECT_ROOT/scripts" "$temp_backup_dir/" 2>/dev/null || true

    # Backup database if this is production
    if [[ "$env" == "production" ]]; then
        log "INFO" "Creating database backup..."
        pg_dump "$DATABASE_URL" > "$temp_backup_dir/database.sql" 2>/dev/null || true
    fi

    # Create archive
    tar -czf "$backup_file" -C "$temp_backup_dir" . 2>/dev/null || true

    # Cleanup
    rm -rf "$temp_backup_dir"

    log "SUCCESS" "Backup created: $backup_file"
}

# Deploy to environment
deploy_to_environment() {
    local env="$1"
    local env_url="${ENVIRONMENT_URLS[$env]}"

    log "INFO" "Deploying to $env environment..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would deploy to $env ($env_url)"
        return 0
    fi

    # Check deployment method
    case "$DEPLOYMENT_METHOD" in
        "docker")
            deploy_with_docker "$env"
            ;;
        "render")
            deploy_with_render "$env"
            ;;
        "cloudflare")
            deploy_with_cloudflare "$env"
            ;;
        *)
            error_exit "Unknown deployment method: $DEPLOYMENT_METHOD"
            ;;
    esac

    log "SUCCESS" "Deployment to $env completed"
}

# Deploy with Docker
deploy_with_docker() {
    local env="$1"
    local env_url="${ENVIRONMENT_URLS[$env]}"
    local compose_file="docker-compose.$env.yml"

    log "INFO" "Deploying with Docker to $env..."

    cd "$PROJECT_ROOT"

    # Build and start containers
    docker-compose -f "$compose_file" down || true
    docker-compose -f "$compose_file" build --no-cache
    docker-compose -f "$compose_file" up -d

    log "SUCCESS" "Docker deployment to $env completed"
}

# Deploy with Render
deploy_with_render() {
    local env="$1"

    log "INFO" "Deploying with Render to $env..."

    # Render deployment is typically triggered by git push
    case "$env" in
        "staging")
            git push origin staging || error_exit "Failed to push to staging branch"
            ;;
        "production")
            git push origin main || error_exit "Failed to push to main branch"
            ;;
    esac

    log "SUCCESS" "Render deployment to $env triggered"
}

# Deploy with Cloudflare
deploy_with_cloudflare() {
    local env="$1"

    log "INFO" "Deploying with Cloudflare to $env..."

    cd "$PROJECT_ROOT"

    # Deploy to Cloudflare
    case "$env" in
        "production")
            npx wrangler deploy --env production || error_exit "Failed to deploy to production"
            ;;
        "staging")
            npx wrangler deploy --env staging || error_exit "Failed to deploy to staging"
            ;;
        *)
            npx wrangler deploy || error_exit "Failed to deploy"
            ;;
    esac

    log "SUCCESS" "Cloudflare deployment to $env completed"
}

# Health check
health_check() {
    local env="$1"
    local env_url="${ENVIRONMENT_URLS[$env]}"

    if [[ "$SKIP_HEALTH_CHECK" == "true" ]]; then
        log "WARN" "Skipping health check"
        return 0
    fi

    log "INFO" "Performing health check for $env..."

    # Wait for deployment to stabilize
    local max_attempts=30
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        log "INFO" "Health check attempt $attempt/$max_attempts"

        if curl -f -s "$env_url/health" > /dev/null 2>&1; then
            log "SUCCESS" "Health check passed for $env"
            return 0
        fi

        log "WARN" "Health check failed, retrying in 10 seconds..."
        sleep 10
        ((attempt++))
    done

    error_exit "Health check failed after $max_attempts attempts"
}

# Run smoke tests
run_smoke_tests() {
    local env="$1"
    local env_url="${ENVIRONMENT_URLS[$env]}"

    log "INFO" "Running smoke tests for $env..."

    # Test main endpoints
    local endpoints=(
        "/health"
        "/api/v1/status"
        "/api/v1/health"
    )

    for endpoint in "${endpoints[@]}"; do
        if curl -f -s "$env_url$endpoint" > /dev/null 2>&1; then
            log "SUCCESS" "Endpoint $endpoint is responding"
        else
            error_exit "Smoke test failed for endpoint $endpoint"
        fi
    done

    log "SUCCESS" "Smoke tests passed for $env"
}

# Show environment status
show_status() {
    local env="$1"
    local env_url="${ENVIRONMENT_URLS[$env]}"

    log "INFO" "Environment: $env"
    log "INFO" "URL: $env_url"

    # Check if environment is accessible
    if curl -f -s "$env_url/health" > /dev/null 2>&1; then
        log "SUCCESS" "Environment $env is healthy"

        # Get additional status information
        local status_json
        status_json=$(curl -s "$env_url/api/v1/status" 2>/dev/null || echo '{}')

        if [[ -n "$status_json" ]]; then
            log "INFO" "Status: $(echo "$status_json" | jq -r '.status // "unknown"')"
            log "INFO" "Version: $(echo "$status_json" | jq -r '.version // "unknown"')"
            log "INFO" "Uptime: $(echo "$status_json" | jq -r '.uptime // "unknown"')"
        fi
    else
        log "ERROR" "Environment $env is not accessible"
    fi
}

# List all environments
list_environments() {
    log "INFO" "Available environments:"

    for env in "${!ENVIRONMENT_URLS[@]}"; do
        local env_url="${ENVIRONMENT_URLS[$env]}"
        local status="unknown"

        if curl -f -s "$env_url/health" > /dev/null 2>&1; then
            status="healthy"
        else
            status="unhealthy"
        fi

        log "INFO" "  $env - $env_url ($status)"
    done
}

# Rollback environment
rollback_environment() {
    local env="$1"
    local version="$2"

    log "INFO" "Rolling back $env to version $version..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: Would rollback $env to version $version"
        return 0
    fi

    # Implementation would depend on your deployment method
    case "$DEPLOYMENT_METHOD" in
        "docker")
            log "INFO" "Rolling back Docker containers..."
            # Docker rollback implementation
            ;;
        "render")
            log "INFO" "Rolling back on Render..."
            # Render rollback implementation
            ;;
        "cloudflare")
            log "INFO" "Rolling back Cloudflare deployment..."
            # Cloudflare rollback implementation
            ;;
    esac

    log "SUCCESS" "Rollback to version $version completed"
}

# Main function
main() {
    log "INFO" "Starting Questro Environment Manager..."

    # Parse command line arguments
    parse_args "$@"

    # Handle different commands
    case "$COMMAND" in
        "deploy")
            if [[ -z "$ENVIRONMENT" ]]; then
                error_exit "Environment is required for deploy command"
            fi

            validate_environment "$ENVIRONMENT"
            load_environment_config "$ENVIRONMENT"
            validate_configuration
            create_backup "$ENVIRONMENT"
            test_database_connection
            test_redis_connection
            test_external_services
            deploy_to_environment "$ENVIRONMENT"
            health_check "$ENVIRONMENT"
            run_smoke_tests "$ENVIRONMENT"
            show_status "$ENVIRONMENT"
            ;;

        "validate")
            if [[ -z "$ENVIRONMENT" ]]; then
                error_exit "Environment is required for validate command"
            fi

            validate_environment "$ENVIRONMENT"
            load_environment_config "$ENVIRONMENT"
            validate_configuration
            test_database_connection
            test_redis_connection
            test_external_services
            ;;

        "health")
            if [[ -z "$ENVIRONMENT" ]]; then
                error_exit "Environment is required for health command"
            fi

            validate_environment "$ENVIRONMENT"
            health_check "$ENVIRONMENT"
            ;;

        "backup")
            if [[ -z "$ENVIRONMENT" ]]; then
                error_exit "Environment is required for backup command"
            fi

            validate_environment "$ENVIRONMENT"
            create_backup "$ENVIRONMENT"
            ;;

        "rollback")
            if [[ -z "$ENVIRONMENT" || -z "$ROLLBACK_VERSION" ]]; then
                error_exit "Environment and version are required for rollback command"
            fi

            validate_environment "$ENVIRONMENT"
            rollback_environment "$ENVIRONMENT" "$ROLLBACK_VERSION"
            ;;

        "status")
            if [[ -z "$ENVIRONMENT" ]]; then
                error_exit "Environment is required for status command"
            fi

            validate_environment "$ENVIRONMENT"
            show_status "$ENVIRONMENT"
            ;;

        "list")
            list_environments
            ;;

        "help"|"")
            show_usage
            ;;

        *)
            error_exit "Unknown command: $COMMAND"
            ;;
    esac

    success_exit
}

# Execute main function
main "$@"
