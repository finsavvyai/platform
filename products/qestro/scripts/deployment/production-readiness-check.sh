#!/bin/bash

# Production Readiness Check
# Comprehensive validation before production deployment

set -e

echo "🔍 Running production readiness checks..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNINGS=0

# Test result tracking
track_test() {
    local result="$1"
    ((TOTAL_CHECKS++))

    case "$result" in
        "PASS")
            ((PASSED_CHECKS++))
            ;;
        "FAIL")
            ((FAILED_CHECKS++))
            ;;
        "WARN")
            ((WARNINGS++))
            ;;
    esac
}

# Environment validation
validate_environment() {
    log_info "Validating environment configuration..."

    # Check required environment variables
    local required_vars=(
        "NODE_ENV"
        "DATABASE_URL"
        "JWT_SECRET"
        "CORS_ORIGIN"
    )

    local optional_vars=(
        "REDIS_URL"
        "OPENAI_API_KEY"
        "SLACK_WEBHOOK_URL"
        "AWS_ACCESS_KEY_ID"
    )

    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            log_error "Required environment variable not set: $var"
            track_test "FAIL"
        else
            log_success "Environment variable set: $var"
            track_test "PASS"
        fi
    done

    for var in "${optional_vars[@]}"; do
        if [ -z "${!var}" ]; then
            log_warning "Optional environment variable not set: $var"
            track_test "WARN"
        else
            log_success "Environment variable set: $var"
            track_test "PASS"
        fi
    done

    # Validate NODE_ENV
    if [ "$NODE_ENV" = "production" ]; then
        log_success "NODE_ENV is set to production"
        track_test "PASS"
    else
        log_error "NODE_ENV must be set to 'production' for production deployment"
        track_test "FAIL"
    fi
}

# Code quality checks
check_code_quality() {
    log_info "Checking code quality..."

    # Backend TypeScript compilation
    log_info "Checking TypeScript compilation..."
    cd backend
    if npm run type-check >/dev/null 2>&1; then
        log_success "TypeScript compilation passed"
        track_test "PASS"
    else
        log_error "TypeScript compilation failed"
        track_test "FAIL"
    fi
    cd ..

    # Frontend build
    log_info "Checking frontend build..."
    cd frontend
    if npm run build >/dev/null 2>&1; then
        log_success "Frontend build successful"
        track_test "PASS"
    else
        log_error "Frontend build failed"
        track_test "FAIL"
    fi
    cd ..

    # Linting
    log_info "Running linter..."
    if npm run lint >/dev/null 2>&1; then
        log_success "Linting passed"
        track_test "PASS"
    else
        log_warning "Linting issues found (review warnings)"
        track_test "WARN"
    fi
}

# Security checks
check_security() {
    log_info "Performing security checks..."

    # Dependency vulnerability scan
    log_info "Scanning for vulnerable dependencies..."
    if npm audit --audit-level=moderate >/dev/null 2>&1; then
        log_success "No critical vulnerabilities found"
        track_test "PASS"
    else
        log_warning "Vulnerabilities found in dependencies"
        track_test "WARN"
    fi

    # Check for hardcoded secrets
    log_info "Checking for hardcoded secrets..."
    local sensitive_patterns=(
        "password"
        "secret"
        "token"
        "api_key"
        "private_key"
    )

    local secrets_found=false
    for pattern in "${sensitive_patterns[@]}"; do
        if grep -r -i "$pattern" src/ --include="*.ts" --include="*.js" | grep -v "node_modules" | grep -v "test" >/dev/null 2>&1; then
            if ! grep -r "process.env\.$pattern" src/ --include="*.ts" --include="*.js" >/dev/null 2>&1; then
                log_warning "Potential hardcoded $pattern found in source code"
                secrets_found=true
            fi
        fi
    done

    if [ "$secrets_found" = false ]; then
        log_success "No hardcoded secrets detected"
        track_test "PASS"
    else
        log_warning "Review potential hardcoded secrets"
        track_test "WARN"
    fi

    # Check file permissions
    log_info "Checking file permissions..."
    local insecure_files=$(find . -type f -name "*.sh" ! -perm 755 2>/dev/null | wc -l)
    if [ "$insecure_files" -eq 0 ]; then
        log_success "Shell scripts have correct permissions"
        track_test "PASS"
    else
        log_warning "Some shell scripts may need permission review"
        track_test "WARN"
    fi
}

# Performance checks
check_performance() {
    log_info "Checking performance configuration..."

    # Check for performance monitoring
    if [ -f "backend/src/services/ProductionMonitoringService.ts" ]; then
        log_success "Production monitoring service is implemented"
        track_test "PASS"
    else
        log_warning "Production monitoring service not found"
        track_test "WARN"
    fi

    # Check for caching configuration
    if grep -r "cache" backend/src/ --include="*.ts" | grep -v test >/dev/null 2>&1; then
        log_success "Caching mechanisms are implemented"
        track_test "PASS"
    else
        log_warning "Consider implementing caching for better performance"
        track_test "WARN"
    fi

    # Check for database connection pooling
    if grep -r "pool" backend/src/ --include="*.ts" | grep -i database >/dev/null 2>&1; then
        log_success "Database connection pooling is configured"
        track_test "PASS"
    else
        log_warning "Database connection pooling not explicitly configured"
        track_test "WARN"
    fi
}

# Database checks
check_database() {
    log_info "Checking database configuration..."

    # Test database connectivity
    if [ -n "$DATABASE_URL" ]; then
        if node -e "
        const { Pool } = require('pg');
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        pool.query('SELECT 1')
          .then(() => { console.log('Database connection successful'); process.exit(0); })
          .catch(() => { console.log('Database connection failed'); process.exit(1); });
        " 2>/dev/null; then
            log_success "Database connection successful"
            track_test "PASS"
        else
            log_error "Database connection failed"
            track_test "FAIL"
        fi
    else
        log_error "DATABASE_URL not configured"
        track_test "FAIL"
    fi

    # Check for database migrations
    if [ -f "backend/drizzle.config.ts" ] && [ -d "backend/src/schema" ]; then
        log_success "Database migration system is configured"
        track_test "PASS"
    else
        log_warning "Database migration system may not be fully configured"
        track_test "WARN"
    fi
}

# Infrastructure checks
check_infrastructure() {
    log_info "Checking infrastructure configuration..."

    # Check for deployment configuration
    if [ -f "render.yaml" ]; then
        log_success "Render deployment configuration found"
        track_test "PASS"
    else
        log_error "Render deployment configuration missing"
        track_test "FAIL"
    fi

    # Check for SSL configuration
    if [ -f "scripts/deployment/setup-domains-ssl.sh" ]; then
        log_success "SSL configuration scripts are available"
        track_test "PASS"
    else
        log_warning "SSL configuration scripts not found"
        track_test "WARN"
    fi

    # Check for backup configuration
    if [ -f "scripts/deployment/backup-config.sh" ]; then
        log_success "Backup configuration is available"
        track_test "PASS"
    else
        log_warning "Backup configuration not found"
        track_test "WARN"
    fi

    # Check for monitoring setup
    if [ -f "backend/src/routes/monitoring.ts" ]; then
        log_success "Monitoring routes are implemented"
        track_test "PASS"
    else
        log_warning "Monitoring routes not found"
        track_test "WARN"
    fi
}

# Testing validation
validate_testing() {
    log_info "Validating test coverage..."

    # Check unit tests
    if [ -d "backend/src/__tests__" ] && [ "$(find backend/src/__tests__ -name "*.test.ts" | wc -l)" -gt 0 ]; then
        log_success "Unit tests are available ($(find backend/src/__tests__ -name "*.test.ts" | wc -l) files)"
        track_test "PASS"
    else
        log_warning "Limited unit test coverage"
        track_test "WARN"
    fi

    # Check integration tests
    if [ -d "tests/integration" ] && [ "$(find tests/integration -name "*.test.ts" | wc -l)" -gt 0 ]; then
        log_success "Integration tests are available ($(find tests/integration -name "*.test.ts" | wc -l) files)"
        track_test "PASS"
    else
        log_warning "Integration test coverage may be insufficient"
        track_test "WARN"
    fi

    # Run unit tests
    log_info "Running unit tests..."
    if npm test >/dev/null 2>&1; then
        log_success "Unit tests passed"
        track_test "PASS"
    else
        log_warning "Some unit tests failed"
        track_test "WARN"
    fi
}

# Documentation checks
check_documentation() {
    log_info "Checking documentation..."

    local required_docs=(
        "README.md"
        "docs/deployment.md"
        "docs/api.md"
        "docs/disaster-recovery/disaster-recovery-plan.md"
    )

    for doc in "${required_docs[@]}"; do
        if [ -f "$doc" ]; then
            log_success "Documentation exists: $doc"
            track_test "PASS"
        else
            log_warning "Missing documentation: $doc"
            track_test "WARN"
        fi
    done

    # Check for API documentation
    if grep -r "@swagger\|@api" backend/src/ --include="*.ts" >/dev/null 2>&1; then
        log_success "API documentation annotations found"
        track_test "PASS"
    else
        log_warning "Consider adding API documentation"
        track_test "WARN"
    fi
}

# Resource checks
check_resources() {
    log_info "Checking resource requirements..."

    # Check package.json scripts
    local required_scripts=(
        "start"
        "build"
        "test"
        "lint"
    )

    for script in "${required_scripts[@]}"; do
        if npm run | grep -q "^  $script$"; then
            log_success "Package script available: $script"
            track_test "PASS"
        else
            log_warning "Missing package script: $script"
            track_test "WARN"
        fi
    done

    # Check for .env.example
    if [ -f ".env.example" ]; then
        log_success "Environment template (.env.example) is available"
        track_test "PASS"
    else
        log_warning "Environment template not found"
        track_test "WARN"
    fi

    # Check for health endpoints
    if [ -f "backend/src/routes/health.ts" ]; then
        log_success "Health check endpoint is implemented"
        track_test "PASS"
    else
        log_warning "Health check endpoint not found"
        track_test "WARN"
    fi
}

# Generate readiness report
generate_report() {
    echo ""
    echo "📊 Production Readiness Report"
    echo "================================"
    echo ""
    echo "Total Checks: $TOTAL_CHECKS"
    echo "Passed: $PASSED_CHECKS"
    echo "Failed: $FAILED_CHECKS"
    echo "Warnings: $WARNINGS"
    echo ""

    local success_rate=$(( (PASSED_CHECKS * 100) / TOTAL_CHECKS ))
    echo "Success Rate: ${success_rate}%"
    echo ""

    # Determine overall status
    if [ $FAILED_CHECKS -eq 0 ]; then
        if [ $WARNINGS -eq 0 ]; then
            echo -e "${GREEN}🎉 READY FOR PRODUCTION DEPLOYMENT${NC}"
            echo "All checks passed successfully!"
            return 0
        else
            echo -e "${YELLOW}⚠️  READY WITH WARNINGS${NC}"
            echo "No critical issues, but review warnings before deployment."
            return 0
        fi
    else
        echo -e "${RED}❌ NOT READY FOR PRODUCTION${NC}"
        echo "Address failed checks before deploying to production."
        return 1
    fi
}

# Main execution
main() {
    echo "🚀 Starting production readiness assessment..."
    echo ""

    validate_environment
    check_code_quality
    check_security
    check_performance
    check_database
    check_infrastructure
    validate_testing
    check_documentation
    check_resources

    echo ""
    generate_report

    if [ $? -eq 0 ]; then
        echo ""
        log_info "Recommended next steps:"
        echo "1. Review any warnings above"
        echo "2. Run final tests: npm test"
        echo "3. Create backup: ./scripts/deployment/backup-config.sh"
        echo "4. Deploy to production"
        echo "5. Monitor deployment health"
    fi
}

# Handle script interruption
trap 'echo -e "\n${RED}❌ Readiness check interrupted${NC}"' INT TERM

# Run main function
main "$@"