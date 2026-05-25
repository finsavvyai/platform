#!/bin/bash

# =============================================================================
# SDLC.ai Platform - Database Migration Script
# =============================================================================
# This script runs all database migrations for all Cloudflare D1 databases
# Usage: ./migrate-all.sh [environment] [target_version]
# Examples:
#   ./migrate-all.sh development
#   ./migrate-all.sh staging
#   ./migrate-all.sh production
#   ./migrate-all.sh development 0002
# =============================================================================

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Database configurations
declare -A DATABASES=(
    ["tenant"]="sdlc-tenant-db"
    ["auth"]="sdlc-auth-db"
    ["documents"]="sdlc-documents-db"
    ["vector"]="sdlc-vector-metadata-db"
    ["policy"]="sdlc-policy-db"
)

# Migration files for each database
declare -A MIGRATION_FILES=(
    ["tenant"]="migrations/tenants/0001_create_tenants.sql"
    ["auth"]="migrations/auth/0001_create_users.sql"
    ["documents"]="migrations/documents/0001_create_documents.sql migrations/documents/0002_create_chunks.sql"
    ["vector"]="migrations/vector/0001_create_vector_tables.sql"
    ["policy"]="migrations/policies/0001_create_policies.sql migrations/policies/0002_create_usage_tracking.sql"
)

# Available environments
ENVIRONMENTS=("development" "staging" "production")

# Logging functions
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

log_migration() {
    echo -e "${CYAN}[MIGRATION]${NC} $1"
}

# Validate environment parameter
validate_environment() {
    local env="$1"
    for valid_env in "${ENVIRONMENTS[@]}"; do
        if [[ "$env" == "$valid_env" ]]; then
            return 0
        fi
    done
    log_error "Invalid environment: $env. Valid environments: ${ENVIRONMENTS[*]}"
    exit 1
}

# Check if migration file exists
check_migration_file() {
    local file="$1"
    if [[ ! -f "$file" ]]; then
        log_error "Migration file not found: $file"
        return 1
    fi
}

# Get migration version from filename
get_migration_version() {
    local file="$1"
    basename "$file" | grep -o '^[0-9]\{4\}'
}

# Run single migration
run_migration() {
    local env="$1"
    local db_type="$2"
    local db_name="$3"
    local migration_file="$4"

    local migration_version
    migration_version=$(get_migration_version "$migration_file")

    log_migration "Running migration $migration_version for $db_type database ($env)..."
    log_migration "  Database: $db_name"
    log_migration "  File: $migration_file"

    # Check if migration already exists
    local migration_table="schema_migrations"
    local check_query="SELECT version FROM $migration_table WHERE version = '$migration_version'"

    # Create migration table if it doesn't exist
    wrangler d1 execute "$db_name-$env" --env "$env" --command "
        CREATE TABLE IF NOT EXISTS $migration_table (
            version TEXT PRIMARY KEY,
            applied_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            filename TEXT NOT NULL
        )
    " 2>/dev/null || true

    # Check if migration already applied
    local applied
    applied=$(wrangler d1 execute "$db_name-$env" --env "$env" --command "$check_query" 2>/dev/null | grep -c "$migration_version" || echo "0")

    if [[ "$applied" -gt 0 ]]; then
        log_warning "Migration $migration_version already applied to $db_type database"
        return 0
    fi

    # Run the migration
    if wrangler d1 execute "$db_name-$env" --env "$env" --file="$migration_file"; then
        # Record the migration
        wrangler d1 execute "$db_name-$env" --env "$env" --command "
            INSERT INTO $migration_table (version, filename) VALUES ('$migration_version', '$migration_file')
        " 2>/dev/null || true

        log_success "Migration $migration_version applied successfully to $db_type database"
        return 0
    else
        log_error "Failed to apply migration $migration_version to $db_type database"
        return 1
    fi
}

# Rollback migration (simplified - in production you'd want proper down migrations)
rollback_migration() {
    local env="$1"
    local db_type="$2"
    local db_name="$3"
    local migration_version="$4"

    log_migration "Rolling back migration $migration_version for $db_type database ($env)..."

    # Remove migration record
    wrangler d1 execute "$db_name-$env" --env "$env" --command "
        DELETE FROM schema_migrations WHERE version = '$migration_version'
    " 2>/dev/null || true

    log_warning "Migration $migration_version rolled back (manual schema changes required)"
}

# Get current migration status
migration_status() {
    local env="$1"
    local db_type="$2"
    local db_name="$3"

    log_info "Migration status for $db_type database ($env):"

    # Get applied migrations
    local applied_migrations
    applied_migrations=$(wrangler d1 execute "$db_name-$env" --env "$env" --command "
        SELECT version, applied_at, filename FROM schema_migrations ORDER BY version
    " 2>/dev/null || echo "No migrations table found")

    if [[ -n "$applied_migrations" ]]; then
        echo "$applied_migrations" | while read -r version; do
            echo "  ✅ $version"
        done
    else
        echo "  ⚠️  No migrations applied"
    fi
}

# Validate database connection
validate_database() {
    local env="$1"
    local db_type="$2"
    local db_name="$3"

    log_info "Validating $db_type database connection ($env)..."

    # Simple connection test
    if wrangler d1 execute "$db_name-$env" --env "$env" --command "SELECT 1 as test" > /dev/null 2>&1; then
        log_success "$db_type database connection successful"
        return 0
    else
        log_error "Failed to connect to $db_type database"
        return 1
    fi
}

# Run all migrations for a specific database
migrate_database() {
    local env="$1"
    local db_type="$2"
    local db_name="$3"
    local target_version="${4:-}"

    log_info "Migrating $db_type database ($env)..."

    # Validate connection
    if ! validate_database "$env" "$db_type" "$db_name"; then
        return 1
    fi

    # Get migration files for this database
    local migration_files="${MIGRATION_FILES[$db_type]}"

    # Run each migration
    for migration_file in $migration_files; do
        if [[ -f "$migration_file" ]]; then
            local migration_version
            migration_version=$(get_migration_version "$migration_file")

            # If target version specified, only run up to that version
            if [[ -n "$target_version" ]]; then
                if [[ "$migration_version" > "$target_version" ]]; then
                    log_info "Skipping migration $migration_version (target: $target_version)"
                    continue
                fi
            fi

            if ! run_migration "$env" "$db_type" "$db_name" "$migration_file"; then
                log_error "Migration failed for $db_type database"
                return 1
            fi
        else
            log_warning "Migration file not found: $migration_file"
        fi
    done

    # Show final status
    migration_status "$env" "$db_type" "$db_name"

    log_success "$db_type database migration completed"
}

# Verify migration integrity
verify_migrations() {
    local env="$1"

    log_info "Verifying migration integrity for $env environment..."

    local errors=0

    for db_type in "${!DATABASES[@]}"; do
        local db_name="${DATABASES[$db_type]}"

        # Check if migration table exists
        local migration_table_exists
        migration_table_exists=$(wrangler d1 execute "$db_name-$env" --env "$env" --command "
            SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'
        " 2>/dev/null | grep -c "schema_migrations" || echo "0")

        if [[ "$migration_table_exists" -eq 0 ]]; then
            log_warning "Migration table not found for $db_type database"
            errors=$((errors + 1))
        fi

        # Check for duplicate migration versions
        local duplicates
        duplicates=$(wrangler d1 execute "$db_name-$env" --env "$env" --command "
            SELECT version, COUNT(*) as count FROM schema_migrations GROUP BY version HAVING count > 1
        " 2>/dev/null || echo "")

        if [[ -n "$duplicates" ]]; then
            log_error "Duplicate migrations found in $db_type database: $duplicates"
            errors=$((errors + 1))
        fi
    done

    if [[ $errors -eq 0 ]]; then
        log_success "Migration integrity verified for $env environment"
        return 0
    else
        log_error "Found $errors migration integrity issues in $env environment"
        return 1
    fi
}

# Create migration backup
create_migration_backup() {
    local env="$1"
    local backup_dir="backups/$(date +%Y%m%d_%H%M%S)_$env"

    log_info "Creating migration backup for $env environment..."

    mkdir -p "$backup_dir"

    for db_type in "${!DATABASES[@]}"; do
        local db_name="${DATABASES[$db_type]}"
        local backup_file="$backup_dir/${db_type}_backup.sql"

        # Export database schema
        wrangler d1 export "$db_name-$env" --env "$env" --output="$backup_file" 2>/dev/null || {
            log_warning "Failed to backup $db_type database"
            continue
        }

        log_info "Backup created: $backup_file"
    done

    log_success "Migration backup completed: $backup_dir"
}

# Main migration function
main() {
    local env="${1:-development}"
    local target_version="${2:-}"
    local action="migrate"

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --rollback)
                action="rollback"
                shift
                ;;
            --status)
                action="status"
                shift
                ;;
            --verify)
                action="verify"
                shift
                ;;
            --backup)
                action="backup"
                shift
                ;;
            *)
                if [[ -z "${env:-}" ]]; then
                    env="$1"
                elif [[ -z "${target_version:-}" ]]; then
                    target_version="$1"
                fi
                shift
                ;;
        esac
    done

    # Validate environment
    validate_environment "$env"

    log_info "Starting migration process for $env environment..."

    case $action in
        "migrate")
            log_info "Running migrations for all databases..."

            for db_type in "${!DATABASES[@]}"; do
                local db_name="${DATABASES[$db_type]}"
                if ! migrate_database "$env" "$db_type" "$db_name" "$target_version"; then
                    log_error "Migration failed for $db_type database"
                    exit 1
                fi
            done

            # Verify after migration
            verify_migrations "$env"
            ;;

        "rollback")
            if [[ -z "$target_version" ]]; then
                log_error "Target version required for rollback"
                exit 1
            fi

            log_warning "Rollback functionality is limited. Manual intervention may be required."
            for db_type in "${!DATABASES[@]}"; do
                local db_name="${DATABASES[$db_type]}"
                rollback_migration "$env" "$db_type" "$db_name" "$target_version"
            done
            ;;

        "status")
            log_info "Migration status for $env environment:"
            for db_type in "${!DATABASES[@]}"; do
                local db_name="${DATABASES[$db_type]}"
                migration_status "$env" "$db_type" "$db_name"
                echo ""
            done
            ;;

        "verify")
            verify_migrations "$env"
            ;;

        "backup")
            create_migration_backup "$env"
            ;;
    esac

    log_success "Migration process completed for $env environment"
}

# Help function
show_help() {
    echo "SDLC.ai Platform - Database Migration Script"
    echo ""
    echo "Usage: $0 [environment] [options] [target_version]"
    echo ""
    echo "Environments: ${ENVIRONMENTS[*]}"
    echo ""
    echo "Options:"
    echo "  --rollback     Rollback to specified version"
    echo "  --status       Show migration status"
    echo "  --verify       Verify migration integrity"
    echo "  --backup       Create migration backup"
    echo ""
    echo "Examples:"
    echo "  $0 development                    # Migrate all databases in development"
    echo "  $0 staging --status              # Show migration status for staging"
    echo "  $0 production --verify           # Verify production migrations"
    echo "  $0 development --backup          # Create development backup"
    echo "  $0 development 0002              # Migrate to version 0002"
    echo "  $0 production --rollback 0001    # Rollback to version 0001"
    echo ""
    echo "Databases:"
    for db_type in "${!DATABASES[@]}"; do
        echo "  - $db_type: ${DATABASES[$db_type]}"
    done
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
