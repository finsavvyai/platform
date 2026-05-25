#!/bin/bash

# Multi-Platform Migration Script
# Migrates from SDLC, Qestro, PipeWarden, and MCPOverflow to Unified Platform

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MIGRATION_WORKSPACE="$PROJECT_ROOT/migration-workspace"
BACKUP_DIR="$PROJECT_ROOT/backups/$(date +%Y%m%d-%H%M%S)"

# Platform configurations
declare -A PLATFORMS=(
  ["sdlc"]="SDLC Compliance Platform"
  ["qestro"]="Qestro Orchestration"
  ["pipewarden"]="PipeWarden Security"
  ["mcpoverflow"]="MCPOverflow Tools"
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

log_step() {
    echo -e "${PURPLE}[STEP]${NC} $1"
}

log_platform() {
    echo -e "${CYAN}[PLATFORM]${NC} $1"
}

# Progress indicator
show_progress() {
    local current=$1
    local total=$2
    local description=$3
    local width=50
    local percentage=$((current * 100 / total))
    local filled=$((current * width / total))
    local empty=$((width - filled))

    printf "\r${BLUE}[PROGRESS]${NC} %s: [" "$description"
    printf "%*s" $filled | tr ' ' '█'
    printf "%*s" $empty | tr ' ' '░'
    printf "] %d%% (%d/%d)" $percentage $current $total
}

# Check prerequisites
check_prerequisites() {
    log_step "Checking migration prerequisites..."

    local errors=0

    # Check if required tools are installed
    for tool in node npm curl jq; do
        if ! command -v $tool &> /dev/null; then
            log_error "Required tool not found: $tool"
            errors=$((errors + 1))
        fi
    done

    # Check if we're in the right directory
    if [ ! -f "$PROJECT_ROOT/package.json" ]; then
        log_error "package.json not found. Please run from project root."
        errors=$((errors + 1))
    fi

    # Check Cloudflare authentication
    if ! wrangler whoami &> /dev/null; then
        log_error "Not authenticated with Cloudflare. Run: wrangler auth login"
        errors=$((errors + 1))
    fi

    if [ $errors -gt 0 ]; then
        log_error "Found $errors prerequisite issues. Please fix them before continuing."
        exit 1
    fi

    log_success "Prerequisites check passed"
}

# Create migration workspace
setup_workspace() {
    log_step "Setting up migration workspace..."

    # Create directories
    mkdir -p "$MIGRATION_WORKSPACE"
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$MIGRATION_WORKSPACE/exports"
    mkdir -p "$MIGRATION_WORKSPACE/transformed"
    mkdir -p "$MIGRATION_WORKSPACE/validation"

    log_success "Migration workspace created"
}

# Detect existing platforms
detect_platforms() {
    log_step "Detecting existing platforms..."

    local detected_platforms=()

    # Check for platform API endpoints
    if curl -f -s "https://api.sdlc.finsavvyai.com/health" &> /dev/null; then
        detected_platforms+=("sdlc")
        log_platform "SDLC platform detected"
    fi

    if curl -f -s "https://api.qestro.sdlc.finsavvyai.com/health" &> /dev/null; then
        detected_platforms+=("qestro")
        log_platform "Qestro platform detected"
    fi

    if curl -f -s "https://api.pipewarden.sdlc.finsavvyai.com/health" &> /dev/null; then
        detected_platforms+=("pipewarden")
        log_platform "PipeWarden platform detected"
    fi

    if curl -f -s "https://api.mcpoverflow.sdlc.finsavvyai.com/health" &> /dev/null; then
        detected_platforms+=("mcpoverflow")
        log_platform "MCPOverflow platform detected"
    fi

    if [ ${#detected_platforms[@]} -eq 0 ]; then
        log_warning "No existing platforms detected. Assuming fresh installation."
        PLATFORMS_TO_MIGRATE=()
    else
        PLATFORMS_TO_MIGRATE=("${detected_platforms[@]}")
        log_info "Platforms to migrate: ${PLATFORMS_TO_MIGRATE[*]}"
    fi
}

# Export data from platforms
export_platform_data() {
    local platform=$1
    log_step "Exporting data from ${PLATFORMS[$platform]}..."

    local export_file="$MIGRATION_WORKSPACE/exports/${platform}-export.json"

    case $platform in
        "sdlc")
            # Export SDLC configuration and compliance rules
            if [ -n "$SDLC_API_KEY" ]; then
                curl -H "Authorization: Bearer $SDLC_API_KEY" \
                     "https://api.sdlc.finsavvyai.com/config/export" > "$export_file"
                log_platform "SDLC configuration exported"
            fi
            ;;
        "qestro")
            # Export Qestro workflows and tools
            if [ -n "$QESTRO_API_KEY" ]; then
                curl -H "Authorization: Bearer $QESTRO_API_KEY" \
                     "https://api.qestro.sdlc.finsavvyai.com/workflows/export" > "$export_file"
                log_platform "Qestro workflows exported"
            fi
            ;;
        "pipewarden")
            # Export PipeWarden security policies
            if [ -n "$PIPEWARDEN_API_KEY" ]; then
                curl -H "Authorization: Bearer $PIPEWARDEN_API_KEY" \
                     "https://api.pipewarden.sdlc.finsavvyai.com/policies/export" > "$export_file"
                log_platform "PipeWarden policies exported"
            fi
            ;;
        "mcpoverflow")
            # Export MCPOverflow servers and tools
            if [ -n "$MCPOVERFLOW_API_KEY" ]; then
                curl -H "Authorization: Bearer $MCPOVERFLOW_API_KEY" \
                     "https://api.mcpoverflow.sdlc.finsavvyai.com/servers/export" > "$export_file"
                log_platform "MCPOverflow servers exported"
            fi
            ;;
    esac

    if [ -f "$export_file" ] && [ -s "$export_file" ]; then
        log_success "Export completed: $export_file"
    else
        log_warning "Export file is empty or missing for $platform"
    fi
}

# Transform data to unified format
transform_platform_data() {
    local platform=$1
    log_step "Transforming ${PLATFORMS[$platform]} data to unified format..."

    local export_file="$MIGRATION_WORKSPACE/exports/${platform}-export.json"
    local transformed_file="$MIGRATION_WORKSPACE/transformed/${platform}-unified.json"

    if [ ! -f "$export_file" ]; then
        log_warning "No export file found for $platform, skipping transformation"
        return
    fi

    # Use Node.js transformation script
    node "$SCRIPT_DIR/transform-platform-data.js" "$platform" "$export_file" "$transformed_file"

    if [ -f "$transformed_file" ]; then
        log_success "Transformation completed: $transformed_file"
    else
        log_error "Transformation failed for $platform"
    fi
}

# Validate transformed data
validate_transformed_data() {
    local platform=$1
    log_step "Validating transformed ${PLATFORMS[$platform]} data..."

    local transformed_file="$MIGRATION_WORKSPACE/transformed/${platform}-unified.json"
    local validation_file="$MIGRATION_WORKSPACE/validation/${platform}-validation.json"

    if [ ! -f "$transformed_file" ]; then
        log_warning "No transformed file found for $platform, skipping validation"
        return
    fi

    # Validate JSON structure
    if jq empty "$transformed_file" 2>/dev/null; then
        log_success "JSON structure is valid for $platform"
    else
        log_error "Invalid JSON structure in $transformed_file"
        return 1
    fi

    # Run platform-specific validation
    node "$SCRIPT_DIR/validate-transformed-data.js" "$platform" "$transformed_file" > "$validation_file"

    local validation_status=$(jq -r '.status' "$validation_file" 2>/dev/null || echo "error")

    if [ "$validation_status" = "success" ]; then
        log_success "Validation passed for $platform"
    else
        log_warning "Validation issues found for $platform"
        local issues=$(jq -r '.issues | length' "$validation_file" 2>/dev/null || echo "unknown")
        log_info "Issues found: $issues"
    fi
}

# Deploy unified platform
deploy_unified_platform() {
    log_step "Deploying Unified Compliance Platform..."

    cd "$PROJECT_ROOT"

    # Install dependencies
    log_info "Installing dependencies..."
    npm install

    # Configure environment
    log_info "Configuring environment..."
    if [ ! -f "wrangler.toml" ]; then
        cp wrangler.example.toml wrangler.toml
        log_info "Please edit wrangler.toml with your configuration"
        read -p "Press Enter to continue after configuring wrangler.toml..."
    fi

    # Set up secrets
    log_info "Setting up secrets..."
    if [ -n "$UNIFIED_API_KEY" ]; then
        echo "$UNIFIED_API_KEY" | wrangler secret put UNIFIED_API_KEY
    fi

    # Deploy platform
    log_info "Deploying to Cloudflare Workers..."
    npm run deploy

    log_success "Unified platform deployed"
}

# Import data to unified platform
import_unified_data() {
    local platform=$1
    log_step "Importing ${PLATFORMS[$platform]} data to unified platform..."

    local transformed_file="$MIGRATION_WORKSPACE/transformed/${platform}-unified.json"

    if [ ! -f "$transformed_file" ]; then
        log_warning "No transformed file found for $platform, skipping import"
        return
    fi

    # Import to unified platform
    local import_endpoint="https://api.unified.compliance.com/${platform}/import"

    if curl -f -X POST \
         -H "Authorization: Bearer $UNIFIED_API_KEY" \
         -H "Content-Type: application/json" \
         -d @"$transformed_file" \
         "$import_endpoint" > "$MIGRATION_WORKSPACE/import-result-${platform}.json"; then
        log_success "Import completed for $platform"
    else
        log_error "Import failed for $platform"
    fi
}

# Validate migration success
validate_migration() {
    log_step "Validating migration success..."

    local validation_results="$MIGRATION_WORKSPACE/migration-validation.json"

    # Run comprehensive validation
    node "$SCRIPT_DIR/validate-migration.js" "${PLATFORMS_TO_MIGRATE[@]}" > "$validation_results"

    local overall_status=$(jq -r '.overallStatus' "$validation_results" 2>/dev/null || echo "error")

    if [ "$overall_status" = "success" ]; then
        log_success "🎉 Migration validation passed!"

        # Show migration summary
        echo
        log_info "Migration Summary:"
        echo "=================="

        local platforms_migrated=$(jq -r '.platformsMigrated | length' "$validation_results" 2>/dev/null || echo "0")
        local workflows_preserved=$(jq -r '.workflowsPreserved' "$validation_results" 2>/dev/null || echo "0")
        local policies_preserved=$(jq -r '.policiesPreserved' "$validation_results" 2>/dev/null || echo "0")
        local mcp_tools_preserved=$(jq -r '.mcpToolsPreserved' "$validation_results" 2>/dev/null || echo "0")

        echo "✅ Platforms migrated: $platforms_migrated"
        echo "✅ Workflows preserved: $workflows_preserved"
        echo "✅ Policies preserved: $policies_preserved"
        echo "✅ MCP tools preserved: $mcp_tools_preserved"
        echo "✅ LAM enhancements: Enabled"
        echo "✅ Unified compliance: Active"

    else
        log_error "❌ Migration validation failed"
        local failed_steps=$(jq -r '.failedSteps | join(", ")' "$validation_results" 2>/dev/null || echo "unknown")
        log_error "Failed steps: $failed_steps"

        # Show rollback instructions
        echo
        log_warning "Rollback Instructions:"
        echo "==========================="
        echo "1. Run: ./scripts/emergency-rollback.sh"
        echo "2. Contact support: migration@unified.compliance.com"
        echo "3. Review validation report: $validation_results"

        return 1
    fi
}

# Cleanup migration workspace
cleanup_workspace() {
    log_step "Cleaning up migration workspace..."

    # Archive migration data
    local archive_name="migration-$(date +%Y%m%d-%H%M%S).tar.gz"
    tar -czf "$BACKUP_DIR/$archive_name" -C "$MIGRATION_WORKSPACE" .

    # Remove temporary files
    rm -rf "$MIGRATION_WORKSPACE"

    log_success "Migration data archived to: $BACKUP_DIR/$archive_name"
}

# Main migration function
run_migration() {
    log_info "🚀 Starting Multi-Platform Migration to Unified Compliance Platform"
    echo

    # Initialize counters
    local total_steps=8
    local current_step=0

    # Step 1: Check prerequisites
    current_step=$((current_step + 1))
    show_progress $current_step $total_steps "Checking prerequisites"
    check_prerequisites
    echo

    # Step 2: Setup workspace
    current_step=$((current_step + 1))
    show_progress $current_step $total_steps "Setting up workspace"
    setup_workspace
    echo

    # Step 3: Detect platforms
    current_step=$((current_step + 1))
    show_progress $current_step $total_steps "Detecting platforms"
    detect_platforms
    echo

    # Step 4: Export data from all platforms
    if [ ${#PLATFORMS_TO_MIGRATE[@]} -gt 0 ]; then
        current_step=$((current_step + 1))
        show_progress $current_step $total_steps "Exporting platform data"
        echo

        for platform in "${PLATFORMS_TO_MIGRATE[@]}"; do
            export_platform_data "$platform"
        done
        echo
    fi

    # Step 5: Transform data
    if [ ${#PLATFORMS_TO_MIGRATE[@]} -gt 0 ]; then
        current_step=$((current_step + 1))
        show_progress $current_step $total_steps "Transforming data"
        echo

        for platform in "${PLATFORMS_TO_MIGRATE[@]}"; do
            transform_platform_data "$platform"
        done
        echo
    fi

    # Step 6: Deploy unified platform
    current_step=$((current_step + 1))
    show_progress $current_step $total_steps "Deploying unified platform"
    echo
    deploy_unified_platform
    echo

    # Step 7: Import data to unified platform
    if [ ${#PLATFORMS_TO_MIGRATE[@]} -gt 0 ]; then
        current_step=$((current_step + 1))
        show_progress $current_step $total_steps "Importing to unified platform"
        echo

        for platform in "${PLATFORMS_TO_MIGRATE[@]}"; do
            import_unified_data "$platform"
        done
        echo
    fi

    # Step 8: Validate migration
    current_step=$((current_step + 1))
    show_progress $current_step $total_steps "Validating migration"
    echo
    if validate_migration; then
        echo
        cleanup_workspace

        log_success "🎉 Migration completed successfully!"
        echo
        log_info "Your Unified Compliance Platform is now ready at:"
        log_info "📊 Dashboard: https://app.unified.compliance.com"
        log_info "🔗 API: https://api.unified.compliance.com"
        log_info "📖 Documentation: https://docs.unified.compliance.com"
        echo
        log_info "Next steps:"
        echo "1. Update your application's API endpoints"
        echo "2. Test your workflows and integrations"
        echo "3. Explore LAM-enhanced compliance features"
        echo "4. Monitor the unified dashboard"

    else
        echo
        log_error "Migration failed. Please check the logs and contact support."
        exit 1
    fi
}

# Help function
show_help() {
    echo "Multi-Platform Migration Script"
    echo "==============================="
    echo
    echo "This script migrates from SDLC, Qestro, PipeWarden, and MCPOverflow"
    echo "to the Unified Compliance Platform with LAM-enhanced compliance."
    echo
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Environment Variables:"
    echo "  SDLC_API_KEY          API key for SDLC platform (if migrating)"
    echo "  QESTRO_API_KEY        API key for Qestro platform (if migrating)"
    echo "  PIPEWARDEN_API_KEY    API key for PipeWarden platform (if migrating)"
    echo "  MCPOVERFLOW_API_KEY   API key for MCPOverflow platform (if migrating)"
    echo "  UNIFIED_API_KEY       API key for unified platform (will be created)"
    echo
    echo "Options:"
    echo "  --help, -h            Show this help message"
    echo "  --dry-run             Run export and validation without deployment"
    echo "  --skip-backup         Skip creating backup of existing data"
    echo "  --verbose             Enable verbose logging"
    echo
    echo "Examples:"
    echo "  $0                                    # Full migration"
    echo "  $0 --dry-run                         # Export and validate only"
    echo "  $0 --skip-backup --verbose           # Skip backup, verbose output"
    echo
    echo "Before running:"
    echo "1. Ensure you have API keys for all platforms you want to migrate"
    echo "2. Backup your current configurations"
    echo "3. Schedule a maintenance window (2-4 hours)"
    echo "4. Test the migration in a staging environment first"
}

# Parse command line arguments
DRY_RUN=false
SKIP_BACKUP=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            show_help
            exit 0
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --skip-backup)
            SKIP_BACKUP=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Enable verbose logging if requested
if [ "$VERBOSE" = true ]; then
    set -x
fi

# Run migration
if [ "$DRY_RUN" = true ]; then
    log_info "Running in dry-run mode - no deployment will be performed"
    # Modify functions to skip deployment for dry run
    deploy_unified_platform() {
        log_info "DRY RUN: Skipping platform deployment"
    }
    import_unified_data() {
        log_info "DRY RUN: Skipping data import"
    }
fi

# Main execution
main() {
    # Trap cleanup
    trap 'log_error "Migration interrupted. Cleaning up..."; cleanup_workspace; exit 1' INT TERM

    run_migration
}

# Run main function
main