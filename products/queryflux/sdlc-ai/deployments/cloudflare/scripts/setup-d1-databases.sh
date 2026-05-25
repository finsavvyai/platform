#!/bin/bash
# =============================================================================
# SDLC.ai Platform - D1 Database Setup Script
# =============================================================================
# This script creates and initializes all D1 databases for the SDLC.ai platform
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CLOUDFLARE_DIR="$PROJECT_ROOT/deployments/cloudflare"

# D1 Database configurations
declare -A DATABASES=(
    ["sdlc-tenant-db"]="tenants"
    ["sdlc-auth-db"]="auth"
    ["sdlc-documents-db"]="documents"
    ["sdlc-vector-metadata-db"]="vector"
    ["sdlc-policy-db"]="policies"
)

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

# Create a single D1 database
create_database() {
    local db_name="$1"
    local migrations_dir="$2"
    local env="$3"
    local env_db_name="${db_name}-${env}"

    log_info "Creating D1 database: $env_db_name"

    # Check if database already exists
    if wrangler d1 list | jq -e ".[] | select(.name==\"$env_db_name\")" > /dev/null; then
        log_warning "Database $env_db_name already exists"
        return 0
    fi

    # Create database
    log_info "Executing: wrangler d1 create $env_db_name"
    wrangler d1 create "$env_db_name"

    # Get database ID
    local db_id
    db_id=$(wrangler d1 list | jq -r ".[] | select(.name==\"$env_db_name\") | .uuid")

    if [ -z "$db_id" ]; then
        log_error "Failed to get database ID for $env_db_name"
        return 1
    fi

    # Update wrangler.toml with database ID
    local placeholder="${env}-${db_name}-placeholder"
    log_info "Updating wrangler.toml with database ID: $db_id"

    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/${placeholder}/${db_id}/g" "$CLOUDFLARE_DIR/wrangler.toml"
    else
        sed -i "s/${placeholder}/${db_id}/g" "$CLOUDFLARE_DIR/wrangler.toml"
    fi

    log_success "Created database $env_db_name with ID: $db_id"

    # Run initial migrations if they exist
    if [ -d "$CLOUDFLARE_DIR/migrations/$migrations_dir" ]; then
        log_info "Running initial migrations for $env_db_name"
        cd "$CLOUDFLARE_DIR"
        wrangler d1 migrations apply "$env_db_name" --remote --config "$CLOUDFLARE_DIR/wrangler.toml"
        cd "$SCRIPT_DIR"
    fi

    return 0
}

# Create all D1 databases for all environments
create_all_databases() {
    local env="$1"

    log_info "Setting up D1 databases for $env environment..."

    for db_name in "${!DATABASES[@]}"; do
        local migrations_dir="${DATABASES[$db_name]}"

        if ! create_database "$db_name" "$migrations_dir" "$env"; then
            log_error "Failed to create database $db_name for $env environment"
            exit 1
        fi
    done

    log_success "All D1 databases created for $env environment"
}

# Initialize database with seed data
initialize_database() {
    local env="$1"
    local db_name="$2"
    local env_db_name="${db_name}-${env}"

    log_info "Initializing database $env_db_name with seed data..."

    # Create seed data file if it doesn't exist
    local seed_file="$CLOUDFLARE_DIR/seeds/${DATABASES[$db_name]}/${env}_seed.sql"

    if [ -f "$seed_file" ]; then
        log_info "Applying seed data from $seed_file"
        wrangler d1 execute "$env_db_name" --file="$seed_file" --env="$env" --config "$CLOUDFLARE_DIR/wrangler.toml"
        log_success "Seed data applied to $env_db_name"
    else
        log_warning "No seed file found at $seed_file"
    fi
}

# Verify database setup
verify_databases() {
    local env="$1"

    log_info "Verifying D1 databases for $env environment..."

    for db_name in "${!DATABASES[@]}"; do
        local env_db_name="${db_name}-${env}"

        # Check if database exists
        if wrangler d1 list | jq -e ".[] | select(.name==\"$env_db_name\")" > /dev/null; then
            log_success "✓ Database $env_db_name exists"

            # Get and display database info
            local db_info
            db_info=$(wrangler d1 info "$env_db_name" --env="$env" --config "$CLOUDFLARE_DIR/wrangler.toml")

            # Extract key information
            local db_id
            db_id=$(echo "$db_info" | jq -r '.uuid')
            local created_at
            created_at=$(echo "$db_info" | jq -r '.created_at')
            local num_tables
            num_tables=$(echo "$db_info" | jq -r '.num_tables // "N/A"')

            log_info "  - ID: $db_id"
            log_info "  - Created: $created_at"
            log_info "  - Tables: $num_tables"
        else
            log_error "✗ Database $env_db_name not found"
        fi
    done
}

# Create database backup
create_backup() {
    local env="$1"
    local backup_dir="$PROJECT_ROOT/backups/d1/$env"

    log_info "Creating D1 database backups for $env environment..."

    # Create backup directory
    mkdir -p "$backup_dir"

    for db_name in "${!DATABASES[@]}"; do
        local env_db_name="${db_name}-${env}"
        local timestamp
        timestamp=$(date -u +"%Y%m%d_%H%M%S")
        local backup_file="$backup_dir/${db_name}_${timestamp}.sql"

        log_info "Creating backup for $env_db_name..."

        # Export database
        if wrangler d1 execute "$env_db_name" --command="SELECT * FROM sqlite_master WHERE type='table';" --env="$env" --config "$CLOUDFLARE_DIR/wrangler.toml" > "$backup_file"; then
            log_success "Backup created: $backup_file"
        else
            log_error "Failed to create backup for $env_db_name"
        fi
    done

    log_success "D1 database backups completed for $env environment"
}

# Restore database from backup
restore_database() {
    local env="$1"
    local db_name="$2"
    local backup_file="$3"

    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        return 1
    fi

    local env_db_name="${db_name}-${env}"

    log_warning "Restoring database $env_db_name from backup $backup_file"
    log_warning "This will overwrite all existing data!"

    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        wrangler d1 execute "$env_db_name" --file="$backup_file" --env="$env" --config "$CLOUDFLARE_DIR/wrangler.toml"
        log_success "Database $env_db_name restored from backup"
    else
        log_info "Restore cancelled"
    fi
}

# Main execution
main() {
    echo "=========================================="
    echo "SDLC.ai D1 Database Setup"
    echo "=========================================="
    echo

    # Parse command line arguments
    ACTION=${1:-"create"}
    ENV=${2:-"development"}

    case "$ACTION" in
        "create")
            log_info "Creating D1 databases for $ENV environment..."
            create_all_databases "$ENV"
            verify_databases "$ENV"
            ;;
        "init")
            log_info "Initializing D1 databases for $ENV environment..."
            for db_name in "${!DATABASES[@]}"; do
                initialize_database "$ENV" "$db_name"
            done
            ;;
        "verify")
            verify_databases "$ENV"
            ;;
        "backup")
            create_backup "$ENV"
            ;;
        "restore")
            if [ -z "$3" ]; then
                log_error "Please provide backup file path"
                echo "Usage: $0 restore <env> <backup_file>"
                exit 1
            fi
            restore_database "$ENV" "$2" "$3"
            ;;
        "all")
            log_info "Creating D1 databases for all environments..."
            for env in development staging production; do
                create_all_databases "$env"
                verify_databases "$env"
            done
            ;;
        "help"|"-h"|"--help")
            echo "Usage: $0 [ACTION] [ENVIRONMENT] [OPTIONS]"
            echo
            echo "Actions:"
            echo "  create    Create D1 databases (default)"
            echo "  init      Initialize databases with seed data"
            echo "  verify    Verify database setup"
            echo "  backup    Create database backups"
            echo "  restore   Restore database from backup"
            echo "  all       Create databases for all environments"
            echo "  help      Show this help message"
            echo
            echo "Environments:"
            echo "  development (default)"
            echo "  staging"
            echo "  production"
            echo
            echo "Examples:"
            echo "  $0 create development"
            echo "  $0 all"
            echo "  $0 init production"
            echo "  $0 backup staging"
            echo "  $0 restore development /path/to/backup.sql"
            ;;
        *)
            log_error "Unknown action: $ACTION"
            echo "Use '$0 help' for usage information"
            exit 1
            ;;
    esac

    echo
    log_success "D1 database setup completed!"
}

# Check prerequisites
check_prerequisites() {
    # Check if wrangler is installed
    if ! command -v wrangler &> /dev/null; then
        log_error "Wrangler CLI is not installed. Please install it with:"
        log_error "npm install -g wrangler"
        exit 1
    fi

    # Check if jq is installed
    if ! command -v jq &> /dev/null; then
        log_error "jq is not installed. Please install it to parse JSON responses"
        exit 1
    fi

    # Check if user is logged in to Cloudflare
    if ! wrangler whoami &> /dev/null; then
        log_error "Not logged in to Cloudflare. Please run:"
        log_error "wrangler auth login"
        exit 1
    fi
}

# Run prerequisites check
check_prerequisites

# Execute main function
main "$@"
