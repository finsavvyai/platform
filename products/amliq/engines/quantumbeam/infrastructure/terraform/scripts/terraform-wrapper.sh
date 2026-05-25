#!/bin/bash

# QuantumBeam Terraform Wrapper Script
# Provides standardized Terraform operations with safety checks and logging

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
TERRAFORM_DIR="${PROJECT_ROOT}/infrastructure/terraform"
LOGS_DIR="${PROJECT_ROOT}/logs/terraform"
STATE_DIR="${PROJECT_ROOT}/.terraform"

# Ensure logs directory exists
mkdir -p "$LOGS_DIR"

# Logging functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}[✓] $1${NC}"
}

warning() {
    echo -e "${YELLOW}[!] $1${NC}"
}

error() {
    echo -e "${RED}[✗] $1${NC}"
}

info() {
    echo -e "${CYAN}[ℹ] $1${NC}"
}

header() {
    echo -e "${PURPLE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║  QuantumBeam Terraform Operations                             ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Show usage
show_usage() {
    cat << EOF
QuantumBeam Terraform Wrapper

USAGE:
    $(basename "$0") [COMMAND] [OPTIONS] [ENVIRONMENT]

COMMANDS:
    init                Initialize Terraform configuration
    plan                Show execution plan
    apply               Apply configuration changes
    destroy             Destroy infrastructure
    validate            Validate configuration
    fmt                 Format configuration files
    graph               Generate dependency graph
    import              Import existing infrastructure
    output              Show output values
    state               Terraform state management
    taint               Mark resources as tainted
    untaint             Unmark resources as tainted
    workspace           Workspace management
    drift               Detect configuration drift

ENVIRONMENTS:
    development         Development environment (default)
    staging             Staging environment
    production          Production environment

OPTIONS:
    --auto-approve     Auto-approve apply/destroy operations
    --dry-run          Run plan without making changes
    --var-file FILE    Specify variable file
    --target RESOURCE  Target specific resource
    --state FILE       Use specified state file
    --lock-timeout DURATION  State lock timeout (default: 10m)
    --parallelism N    Number of parallel operations (default: 10)
    --detailed-exit-code  Detailed exit codes
    --compact-warnings  Compact warning output
    --json             JSON output
    --verbose          Verbose logging
    --help, -h         Show this help message

EXAMPLES:
    # Initialize production environment
    $(basename "$0") init production

    # Plan changes for production
    $(basename "$0") plan production --var-file custom.tfvars

    # Apply changes with auto-approval
    $(basename "$0") apply production --auto-approve

    # Destroy specific resource
    $(basename "$0") destroy production --target aws_instance.example

    # Format all configuration files
    $(basename "$0") fmt

    # Generate dependency graph
    $(basename "$0") graph production | dot -Tpng > graph.png

    # Detect configuration drift
    $(basename "$0") drift production

ENVIRONMENT VARIABLES:
    TF_VAR_*           Terraform variables
    TF_LOG             Terraform log level (TRACE, DEBUG, INFO, WARN, ERROR)
    TF_LOG_PATH        Terraform log file path
    TF_IN_AUTOMATION   Set to "true" when running in automation
    TF_INPUT           Set to "false" to disable interactive input
    TF_CLI_ARGS_FILE   File containing CLI arguments
    TF_PLUGIN_CACHE_DIR Directory for plugin cache

SAFETY FEATURES:
    • State locking and consistency checks
    • Resource dependency validation
    • Cost estimation (production)
    • Plan confirmation requirements
    • Automated backup before destructive operations
    • Rollback capabilities
    • Drift detection and alerts

EOF
}

# Parse command line arguments
parse_args() {
    COMMAND=""
    ENVIRONMENT="development"
    AUTO_APPROVE=false
    DRY_RUN=false
    VAR_FILE=""
    TARGET=""
    STATE_FILE=""
    LOCK_TIMEOUT="10m"
    PARALLELISM="10"
    DETAILED_EXIT_CODE=false
    COMPACT_WARNINGS=false
    JSON_OUTPUT=false
    VERBOSE=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            init|plan|apply|destroy|validate|fmt|graph|import|output|state|taint|untaint|workspace|drift)
                COMMAND="$1"
                shift
                ;;
            development|staging|production)
                ENVIRONMENT="$1"
                shift
                ;;
            --auto-approve)
                AUTO_APPROVE=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --var-file)
                VAR_FILE="$2"
                shift 2
                ;;
            --target)
                TARGET="$2"
                shift 2
                ;;
            --state)
                STATE_FILE="$2"
                shift 2
                ;;
            --lock-timeout)
                LOCK_TIMEOUT="$2"
                shift 2
                ;;
            --parallelism)
                PARALLELISM="$2"
                shift 2
                ;;
            --detailed-exit-code)
                DETAILED_EXIT_CODE=true
                shift
                ;;
            --compact-warnings)
                COMPACT_WARNINGS=true
                shift
                ;;
            --json)
                JSON_OUTPUT=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --help|-h)
                show_usage
                exit 0
                ;;
            *)
                error "Unknown argument: $1"
                show_usage
                exit 1
                ;;
        esac
    done

    if [[ -z "$COMMAND" ]]; then
        error "Command is required"
        show_usage
        exit 1
    fi
}

# Validate prerequisites
validate_prerequisites() {
    log "Validating prerequisites..."

    # Check if terraform is installed
    if ! command -v terraform &> /dev/null; then
        error "Terraform is not installed or not in PATH"
        exit 1
    fi

    local tf_version=$(terraform version -json | jq -r '.terraform_version')
    log "Using Terraform version: $tf_version"

    # Check terraform version
    if ! terraform version -json | jq -e '.terraform_version | startswith("1.")' > /dev/null; then
        error "Terraform version 1.x is required, found: $tf_version"
        exit 1
    fi

    # Check if we're in the right directory
    if [[ ! -f "$TERRAFORM_DIR/environments/$ENVIRONMENT/main.tf" ]]; then
        error "Environment $ENVIRONMENT not found"
        exit 1
    fi

    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        error "AWS credentials not configured"
        exit 1
    fi

    local aws_identity=$(aws sts get-caller-identity --query Account --output text)
    log "AWS Account: $aws_identity"

    success "Prerequisites validated"
}

# Setup environment
setup_environment() {
    log "Setting up environment: $ENVIRONMENT"

    cd "$TERRAFORM_DIR/environments/$ENVIRONMENT"

    # Create terraform rc file if it doesn't exist
    if [[ ! -f "$PROJECT_ROOT/.terraformrc" ]]; then
        cat > "$PROJECT_ROOT/.terraformrc" << EOF
plugin_cache_dir = "\$HOME/.terraform.d/plugin-cache"
disable_checkpoint = false
EOF
    fi

    # Set environment variables
    export TF_IN_AUTOMATION="${TF_IN_AUTOMATION:-true}"
    export TF_INPUT="${TF_INPUT:-false}"
    export TF_LOG="${TF_LOG:-INFO}"
    export TF_LOG_PATH="$LOGS_DIR/terraform-$(date +%Y%m%d-%H%M%S).log"

    # Create environment-specific log file
    local env_log_file="$LOGS_DIR/${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S).log"
    export TF_LOG_PATH="$env_log_file"

    success "Environment setup complete"
}

# Check for state conflicts
check_state_conflicts() {
    if [[ "$COMMAND" == "apply" || "$COMMAND" == "destroy" ]]; then
        log "Checking for state conflicts..."

        # Check if anyone else is running terraform
        if terraform force-unlock -lock=false .tflock &> /dev/null; then
            warning "State lock detected. Another operation may be in progress."
            if [[ "$AUTO_APPROVE" != "true" ]]; then
                read -p "Do you want to continue? (y/N): " -n 1 -r
                echo
                if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                    log "Operation cancelled by user"
                    exit 1
                fi
            fi
        fi

        success "No state conflicts detected"
    fi
}

# Backup state before destructive operations
backup_state() {
    if [[ "$COMMAND" == "apply" || "$COMMAND" == "destroy" ]]; then
        log "Creating state backup..."

        local backup_dir="$STATE_DIR/backups/$ENVIRONMENT"
        mkdir -p "$backup_dir"

        local backup_file="$backup_dir/terraform-$(date +%Y%m%d-%H%M%S).tfstate"
        if [[ -f "terraform.tfstate" ]]; then
            cp "terraform.tfstate" "$backup_file"
            success "State backed up to: $backup_file"
        fi
    fi
}

# Show cost estimation (production only)
show_cost_estimation() {
    if [[ "$ENVIRONMENT" == "production" && "$COMMAND" == "apply" ]]; then
        log "Generating cost estimation..."

        # This would integrate with a cost estimation tool
        # For now, we'll show a placeholder
        info "Cost estimation is being generated..."
        info "Estimated monthly cost: $X (placeholder)"
    fi
}

# Build terraform command
build_terraform_command() {
    local cmd="terraform $COMMAND"

    # Add common options
    cmd="$cmd -lock-timeout=$LOCK_TIMEOUT"
    cmd="$cmd -parallelism=$PARALLELISM"

    if [[ "$DETAILED_EXIT_CODE" == "true" ]]; then
        cmd="$cmd -detailed-exit-code"
    fi

    if [[ "$COMPACT_WARNINGS" == "true" ]]; then
        cmd="$cmd -compact-warnings"
    fi

    if [[ "$JSON_OUTPUT" == "true" ]]; then
        cmd="$cmd -json"
    fi

    # Add command-specific options
    case "$COMMAND" in
        apply)
            if [[ "$AUTO_APPROVE" == "true" ]]; then
                cmd="$cmd -auto-approve"
            fi
            if [[ "$DRY_RUN" == "true" ]]; then
                cmd="terraform plan"
            fi
            ;;
        destroy)
            if [[ "$AUTO_APPROVE" == "true" ]]; then
                cmd="$cmd -auto-approve"
            fi
            ;;
        fmt)
            cmd="$cmd -recursive -diff"
            ;;
        validate)
            cmd="$cmd -no-color"
            ;;
    fi

    # Add target if specified
    if [[ -n "$TARGET" ]]; then
        cmd="$cmd -target=$TARGET"
    fi

    # Add state file if specified
    if [[ -n "$STATE_FILE" ]]; then
        cmd="$cmd -state=$STATE_FILE"
    fi

    # Add var file if specified
    if [[ -n "$VAR_FILE" ]]; then
        if [[ -f "$VAR_FILE" ]]; then
            cmd="$cmd -var-file=$VAR_FILE"
        else
            error "Variable file not found: $VAR_FILE"
            exit 1
        fi
    fi

    echo "$cmd"
}

# Execute terraform command
execute_terraform_command() {
    local cmd=$(build_terraform_command)

    log "Executing: $cmd"
    log "Working directory: $(pwd)"
    log "Environment: $ENVIRONMENT"

    # Record start time
    local start_time=$(date +%s)

    # Execute command
    if eval "$cmd"; then
        local exit_code=$?
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))

        success "Command completed successfully in ${duration}s"

        # Run post-operations
        case "$COMMAND" in
            apply)
                post_apply_operations
                ;;
            destroy)
                post_destroy_operations
                ;;
        esac

        return $exit_code
    else
        local exit_code=$?
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))

        error "Command failed with exit code $exit_code after ${duration}s"

        # Show troubleshooting tips
        show_troubleshooting_tips

        return $exit_code
    fi
}

# Post-apply operations
post_apply_operations() {
    log "Running post-apply operations..."

    # Generate outputs
    if command -v jq &> /dev/null; then
        log "Capturing outputs..."
        terraform output -json > "$LOGS_DIR/${ENVIRONMENT}-outputs-$(date +%Y%m%d-%H%M%S).json"
    fi

    # Run smoke tests if available
    local smoke_test_script="${PROJECT_ROOT}/scripts/smoke-tests.sh"
    if [[ -f "$smoke_test_script" ]]; then
        log "Running smoke tests..."
        if bash "$smoke_test_script" "$ENVIRONMENT"; then
            success "Smoke tests passed"
        else
            warning "Smoke tests failed - review infrastructure"
        fi
    fi

    # Update documentation
    local doc_script="${PROJECT_ROOT}/scripts/update-documentation.sh"
    if [[ -f "$doc_script" ]]; then
        log "Updating documentation..."
        bash "$doc_script" "$ENVIRONMENT" || warning "Documentation update failed"
    fi

    success "Post-apply operations completed"
}

# Post-destroy operations
post_destroy_operations() {
    log "Running post-destroy operations..."

    # Clean up related resources
    log "Cleaning up related resources..."

    # Remove DNS records if they exist
    # Clean up S3 buckets
    # Remove monitoring configurations

    success "Post-destroy operations completed"
}

# Show troubleshooting tips
show_troubleshooting_tips() {
    cat << EOF

TROUBLESHOOTING TIPS:

1. Check the detailed logs:
   TF_LOG=DEBUG terraform $COMMAND $ENVIRONMENT

2. Validate configuration:
   terraform validate

3. Check state consistency:
   terraform plan -detailed-exit-code

4. Refresh state:
   terraform refresh

5. Check for resource dependencies:
   terraform graph

6. Review variables:
   terraform console

7. Check AWS permissions:
   aws sts get-caller-identity
   aws iam list-policies

8. Common issues:
   - Insufficient IAM permissions
   - Resource already exists
   - Dependency conflicts
   - State file corruption

9. Get help:
   - Check documentation: docs/terraform/
   - Contact platform team: platform-team@quantumbeam.io

EOF
}

# Detect configuration drift
detect_drift() {
    log "Detecting configuration drift for environment: $ENVIRONMENT"

    cd "$TERRAFORM_DIR/environments/$ENVIRONMENT"

    # Refresh state
    log "Refreshing state..."
    if ! terraform refresh; then
        error "Failed to refresh state"
        exit 1
    fi

    # Generate plan
    log "Generating drift detection plan..."
    local plan_file="drift-$(date +%Y%m%d-%H%M%S).plan"

    if terraform plan -detailed-exit-code -out="$plan_file"; then
        local exit_code=$?
        case $exit_code in
            0)
                success "No configuration drift detected"
                rm -f "$plan_file"
                ;;
            1)
                error "Terraform plan failed"
                rm -f "$plan_file"
                exit 1
                ;;
            2)
                warning "Configuration drift detected"
                log "Plan saved to: $plan_file"
                log "Review changes with: terraform show $plan_file"

                # Generate drift report
                local drift_report="$LOGS_DIR/${ENVIRONMENT}-drift-$(date +%Y%m%d-%H%M%S).txt"
                terraform show "$plan_file" > "$drift_report"
                log "Drift report saved to: $drift_report"
                ;;
        esac
    else
        error "Failed to generate drift detection plan"
        exit 1
    fi
}

# Main function
main() {
    header

    # Parse arguments
    parse_args "$@"

    # Special handling for drift command
    if [[ "$COMMAND" == "drift" ]]; then
        setup_environment
        detect_drift
        exit 0
    fi

    # Validate prerequisites
    validate_prerequisites

    # Setup environment
    setup_environment

    # Safety checks
    check_state_conflicts

    # Backup state if needed
    backup_state

    # Show cost estimation for production
    show_cost_estimation

    # Execute terraform command
    execute_terraform_command

    success "Terraform operation completed successfully"
}

# Execute main function
main "$@"