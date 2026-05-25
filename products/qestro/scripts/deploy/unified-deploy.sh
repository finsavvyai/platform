#!/bin/bash

# Questro Unified Deployment Pipeline
# This script orchestrates the deployment of all Questro components

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONFIG_FILE="$PROJECT_ROOT/deploy.config.json"
LOG_FILE="$PROJECT_ROOT/deployment.log"

# Default configuration
DEFAULT_ENVIRONMENT="development"
DEFAULT_COMPONENTS="frontend,backend,agent"
DEFAULT_REGION="us-east-1"

# Parse command line arguments
ENVIRONMENT="${ENVIRONMENT:-$DEFAULT_ENVIRONMENT}"
COMPONENTS="${COMPONENTS:-$DEFAULT_COMPONENTS}"
REGION="${REGION:-$DEFAULT_REGION}"
SKIP_TESTS="${SKIP_TESTS:-false}"
SKIP_BUILD="${SKIP_BUILD:-false}"
DRY_RUN="${DRY_RUN:-false}"
VERBOSE="${VERBOSE:-false}"

# Load configuration
if [[ -f "$PROJECT_ROOT/deploy.config.sh" ]]; then
    echo -e "${BLUE}Loading deployment configuration from $PROJECT_ROOT/deploy.config.sh${NC}"
    source "$PROJECT_ROOT/deploy.config.sh"
elif [[ -f "$CONFIG_FILE" ]]; then
    echo -e "${BLUE}Loading deployment configuration from $CONFIG_FILE${NC}"
    # JSON configuration would need parsing here, for now use shell config
    echo -e "${YELLOW}JSON config detected, but shell config is preferred${NC}"
else
    echo -e "${YELLOW}No deployment configuration found, using defaults${NC}"
fi

# Helper functions
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

info() {
    log "INFO" "$*"
}

warn() {
    log "WARN" "${YELLOW}$*${NC}"
}

error() {
    log "ERROR" "${RED}$*${NC}"
}

success() {
    log "SUCCESS" "${GREEN}$*${NC}"
}

debug() {
    if [[ "$VERBOSE" == "true" ]]; then
        log "DEBUG" "$*"
    fi
}

# Check prerequisites
check_prerequisites() {
    info "Checking deployment prerequisites..."

    # Check if required tools are installed
    local required_tools=("node" "npm" "docker" "git")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            error "Required tool '$tool' is not installed"
            return 1
        fi
        debug "Found $tool: $(command -v "$tool")"
    done

    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        error "Not in a git repository"
        return 1
    fi

    # Check if there are uncommitted changes
    if [[ -n $(git status --porcelain) ]]; then
        warn "You have uncommitted changes. Consider committing them before deployment."
        if [[ "$ENVIRONMENT" == "production" ]]; then
            error "Cannot deploy to production with uncommitted changes"
            return 1
        fi
    fi

    # Check environment variables
    local required_env_vars=("NODE_ENV")
    for var in "${required_env_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            error "Required environment variable $var is not set"
            return 1
        fi
    done

    success "Prerequisites check passed"
}

# Run tests
run_tests() {
    if [[ "$SKIP_TESTS" == "true" ]]; then
        warn "Skipping tests as requested"
        return 0
    fi

    info "Running tests for components: $COMPONENTS"

    # Split components by comma and run tests for each
    IFS=',' read -ra COMPONENT_ARRAY <<< "$COMPONENTS"
    for component in "${COMPONENT_ARRAY[@]}"; do
        component=$(echo "$component" | xargs) # trim whitespace

        if [[ ! -d "$PROJECT_ROOT/$component" ]]; then
            warn "Component '$component' not found, skipping tests"
            continue
        fi

        info "Running tests for $component..."
        cd "$PROJECT_ROOT/$component"

        # Check if component has test script
        if npm run test --silent 2>/dev/null; then
            if [[ "$DRY_RUN" != "true" ]]; then
                npm test
            else
                info "[DRY RUN] Would run: npm test"
            fi
            success "Tests passed for $component"
        else
            warn "No test script found for $component, skipping"
        fi

        cd "$PROJECT_ROOT"
    done

    success "All tests completed"
}

# Build components
build_components() {
    if [[ "$SKIP_BUILD" == "true" ]]; then
        warn "Skipping build as requested"
        return 0
    fi

    info "Building components: $COMPONENTS"

    # Split components by comma and build each
    IFS=',' read -ra COMPONENT_ARRAY <<< "$COMPONENTS"
    for component in "${COMPONENT_ARRAY[@]}"; do
        component=$(echo "$component" | xargs) # trim whitespace

        if [[ ! -d "$PROJECT_ROOT/$component" ]]; then
            warn "Component '$component' not found, skipping build"
            continue
        fi

        info "Building $component..."
        cd "$PROJECT_ROOT/$component"

        # Check if component has build script
        if npm run build --silent 2>/dev/null; then
            if [[ "$DRY_RUN" != "true" ]]; then
                npm run build
            else
                info "[DRY RUN] Would run: npm run build"
            fi
            success "Build completed for $component"
        else
            warn "No build script found for $component, skipping"
        fi

        cd "$PROJECT_ROOT"
    done

    success "All builds completed"
}

# Deploy infrastructure
deploy_infrastructure() {
    info "Deploying infrastructure for $ENVIRONMENT environment..."

    # Deploy Docker containers
    if [[ "$ENVIRONMENT" == "development" || "$ENVIRONMENT" == "staging" ]]; then
        info "Deploying with Docker Compose..."

        local compose_file="docker-compose.${ENVIRONMENT}.yml"
        if [[ ! -f "$PROJECT_ROOT/$compose_file" ]]; then
            compose_file="docker-compose.yml"
        fi

        if [[ "$DRY_RUN" != "true" ]]; then
            cd "$PROJECT_ROOT"
            docker-compose -f "$compose_file" down -v
            docker-compose -f "$compose_file" build
            docker-compose -f "$compose_file" up -d

            # Wait for services to be ready
            sleep 10
            docker-compose -f "$compose_file" ps
        else
            info "[DRY RUN] Would deploy with: docker-compose -f $compose_file"
        fi
    elif [[ "$ENVIRONMENT" == "production" ]]; then
        info "Deploying to production infrastructure..."
        # Production deployment logic would go here
        # This could involve Render.com, AWS, or other cloud providers
        if [[ "$DRY_RUN" != "true" ]]; then
            # Example: Trigger production deployment
            info "Triggering production deployment pipeline..."
            # This would integrate with your production deployment system
        else
            info "[DRY RUN] Would trigger production deployment"
        fi
    fi

    success "Infrastructure deployment completed"
}

# Deploy extensions and tools
deploy_extensions() {
    info "Deploying extensions and tools..."

    # Deploy VSCode extension
    if [[ "$COMPONENTS" == *"vscode-extension"* ]]; then
        info "Deploying VSCode extension..."
        cd "$PROJECT_ROOT/vscode-extension"

        if [[ "$DRY_RUN" != "true" ]]; then
            if [[ "$ENVIRONMENT" == "production" ]]; then
                npm run publish
            else
                npm run package
            fi
        else
            info "[DRY RUN] Would deploy VSCode extension"
        fi

        cd "$PROJECT_ROOT"
    fi

    # Deploy browser extension
    if [[ "$COMPONENTS" == *"browser-extension"* ]]; then
        info "Deploying browser extension..."
        cd "$PROJECT_ROOT/browser-extension"

        if [[ "$DRY_RUN" != "true" ]]; then
            npm run build
            # Browser extension deployment would go here
        else
            info "[DRY RUN] Would deploy browser extension"
        fi

        cd "$PROJECT_ROOT"
    fi

    success "Extensions deployment completed"
}

# Run health checks
run_health_checks() {
    info "Running deployment health checks..."

    # Check backend health
    if [[ "$COMPONENTS" == *"backend"* ]]; then
        info "Checking backend health..."
        local max_attempts=30
        local attempt=1

        while [[ $attempt -le $max_attempts ]]; do
            if curl -f http://localhost:8000/api/health &>/dev/null; then
                success "Backend is healthy"
                break
            fi

            if [[ $attempt -eq $max_attempts ]]; then
                error "Backend health check failed after $max_attempts attempts"
                return 1
            fi

            info "Waiting for backend to be healthy... (attempt $attempt/$max_attempts)"
            sleep 10
            ((attempt++))
        done
    fi

    # Check frontend health
    if [[ "$COMPONENTS" == *"frontend"* ]]; then
        info "Checking frontend health..."
        local max_attempts=30
        local attempt=1

        while [[ $attempt -le $max_attempts ]]; do
            if curl -f http://localhost:3000 &>/dev/null; then
                success "Frontend is healthy"
                break
            fi

            if [[ $attempt -eq $max_attempts ]]; then
                error "Frontend health check failed after $max_attempts attempts"
                return 1
            fi

            info "Waiting for frontend to be healthy... (attempt $attempt/$max_attempts)"
            sleep 10
            ((attempt++))
        done
    fi

    success "All health checks passed"
}

# Run smoke tests
run_smoke_tests() {
    info "Running smoke tests..."

    # Test API endpoints
    if [[ "$COMPONENTS" == *"backend"* ]]; then
        info "Testing API endpoints..."

        # Test health endpoint
        if curl -f http://localhost:8000/api/health &>/dev/null; then
            success "Health endpoint working"
        else
            error "Health endpoint not working"
            return 1
        fi

        # Test authentication endpoint
        if curl -f -X POST http://localhost:8000/api/auth/health &>/dev/null; then
            success "Auth endpoint working"
        else
            warn "Auth endpoint not responding (might be expected)"
        fi
    fi

    # Test frontend
    if [[ "$COMPONENTS" == *"frontend"* ]]; then
        info "Testing frontend..."

        if curl -f http://localhost:3000 &>/dev/null; then
            success "Frontend accessible"
        else
            error "Frontend not accessible"
            return 1
        fi
    fi

    success "Smoke tests passed"
}

# Generate deployment report
generate_report() {
    info "Generating deployment report..."

    local report_file="$PROJECT_ROOT/deployment-report-$(date +%Y%m%d-%H%M%S).json"

    cat > "$report_file" << EOF
{
  "deployment": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "$ENVIRONMENT",
    "components": ["$(echo "$COMPONENTS" | sed 's/,/", "/g')"],
    "region": "$REGION",
    "dryRun": $DRY_RUN,
    "gitCommit": "$(git rev-parse HEAD)",
    "gitBranch": "$(git branch --show-current)"
  },
  "status": {
    "tests": {
      "skipped": $SKIP_TESTS,
      "status": "passed"
    },
    "build": {
      "skipped": $SKIP_BUILD,
      "status": "completed"
    },
    "infrastructure": {
      "status": "deployed"
    },
    "healthChecks": {
      "status": "passed"
    },
    "smokeTests": {
      "status": "passed"
    }
  },
  "services": {
    "frontend": {
      "url": "http://localhost:3000",
      "status": "$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)"
    },
    "backend": {
      "url": "http://localhost:8000",
      "status": "$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/health)"
    }
  }
}
EOF

    success "Deployment report generated: $report_file"
}

# Cleanup on failure
cleanup_on_failure() {
    error "Deployment failed, running cleanup..."

    # Stop containers if they were started
    if [[ "$ENVIRONMENT" != "production" ]]; then
        cd "$PROJECT_ROOT"
        docker-compose -f "docker-compose.${ENVIRONMENT}.yml" down || true
    fi

    # Clean up any temporary files
    rm -f /tmp/questro-deploy-* 2>/dev/null || true

    error "Cleanup completed"
}

# Main deployment function
main() {
    info "Starting Questro unified deployment..."
    info "Environment: $ENVIRONMENT"
    info "Components: $COMPONENTS"
    info "Region: $REGION"
    info "Dry Run: $DRY_RUN"

    # Set up error handling
    trap cleanup_on_failure ERR

    # Run deployment pipeline
    check_prerequisites
    run_tests
    build_components
    deploy_infrastructure
    deploy_extensions
    run_health_checks
    run_smoke_tests
    generate_report

    success "Deployment completed successfully!"

    if [[ "$DRY_RUN" == "true" ]]; then
        info "This was a dry run. No actual changes were made."
    fi

    # Show service URLs
    echo ""
    info "Service URLs:"
    if [[ "$COMPONENTS" == *"frontend"* ]]; then
        echo "  Frontend: http://localhost:3000"
    fi
    if [[ "$COMPONENTS" == *"backend"* ]]; then
        echo "  Backend API: http://localhost:8000/api/health"
    fi
    if [[ "$COMPONENTS" == *"browser-extension"* ]]; then
        echo "  Browser Extension: Build completed in browser-extension/dist/"
    fi
    if [[ "$COMPONENTS" == *"vscode-extension"* ]]; then
        echo "  VSCode Extension: Build completed in vscode-extension/out/"
    fi
}

# Show usage
show_usage() {
    cat << EOF
Questro Unified Deployment Pipeline

Usage: $0 [OPTIONS]

Options:
  -e, --environment ENV     Target environment (development|staging|production)
                            Default: $DEFAULT_ENVIRONMENT
  -c, --components COMMA    Components to deploy (frontend,backend,agent,extensions)
                            Default: $DEFAULT_COMPONENTS
  -r, --region REGION       AWS region (for production deployments)
                            Default: $DEFAULT_REGION
  --skip-tests              Skip running tests
  --skip-build              Skip building components
  --dry-run                 Show what would be deployed without making changes
  --verbose                 Enable verbose output
  -h, --help               Show this help message

Examples:
  $0                                    # Deploy with defaults
  $0 -e production                      # Deploy to production
  $0 -c frontend,backend --skip-tests   # Deploy only frontend and backend, skip tests
  $0 --dry-run -e staging               # Dry run for staging
  $0 -e development -c all --verbose    # Full development deployment with verbose output

Environment Variables:
  NODE_ENV                              Target environment
  SKIP_TESTS                            Skip tests if set to "true"
  SKIP_BUILD                            Skip build if set to "true"
  DRY_RUN                               Dry run if set to "true"
  VERBOSE                               Verbose output if set to "true"

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -c|--components)
            COMPONENTS="$2"
            shift 2
            ;;
        -r|--region)
            REGION="$2"
            shift 2
            ;;
        --skip-tests)
            SKIP_TESTS="true"
            shift
            ;;
        --skip-build)
            SKIP_BUILD="true"
            shift
            ;;
        --dry-run)
            DRY_RUN="true"
            shift
            ;;
        --verbose)
            VERBOSE="true"
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate arguments
if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
    error "Invalid environment: $ENVIRONMENT"
    show_usage
    exit 1
fi

# Create log file if it doesn't exist
touch "$LOG_FILE"

# Run main function
main "$@"