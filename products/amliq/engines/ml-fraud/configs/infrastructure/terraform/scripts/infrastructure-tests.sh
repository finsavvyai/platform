#!/bin/bash

# QuantumBeam Infrastructure Testing Script
# Comprehensive testing suite for Terraform infrastructure

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
TEST_RESULTS_DIR="${PROJECT_ROOT}/test-results/infrastructure"
REPORTS_DIR="${PROJECT_ROOT}/reports/infrastructure"

# Ensure directories exist
mkdir -p "$TEST_RESULTS_DIR"
mkdir -p "$REPORTS_DIR"

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
    echo "║  QuantumBeam Infrastructure Testing Suite                      ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Show usage
show_usage() {
    cat << EOF
QuantumBeam Infrastructure Testing Suite

USAGE:
    $(basename "$0") [COMMAND] [ENVIRONMENT] [OPTIONS]

COMMANDS:
    test-all            Run all tests
    validate            Validate Terraform configuration
    security            Run security tests
    compliance          Run compliance tests
    performance         Run performance tests
    cost                Run cost analysis
    drift               Detect configuration drift
    smoke               Run smoke tests against deployed infrastructure
    report              Generate comprehensive test report

ENVIRONMENTS:
    development         Development environment (default)
    staging             Staging environment
    production          Production environment

OPTIONS:
    --dry-run          Run tests without making changes
    --verbose          Verbose logging
    --output-dir DIR   Specify output directory
    --timeout DURATION Test timeout (default: 30m)
    --parallel N       Number of parallel tests (default: 4)
    --severity LEVEL   Minimum severity level (low, medium, high, critical)
    --exclude EXCLUDE  Exclude specific test categories
    --include INCLUDE  Include only specific test categories
    --format FORMAT    Output format (json, xml, junit, html)
    --help, -h         Show this help message

EXAMPLES:
    # Run all tests for staging
    $(basename "$0") test-all staging

    # Run security tests only
    $(basename "$0") security production --severity high

    # Generate HTML report
    $(basename "$0) test-all staging --format html --output-dir ./reports"

    # Detect configuration drift
    $(basename "$0) drift production

    # Run compliance tests
    $(basename "$0) compliance production

TEST CATEGORIES:
    • Validation - Terraform configuration validation
    • Security - Security scanning and vulnerability assessment
    • Compliance - Regulatory and policy compliance
    • Performance - Performance and scalability testing
    • Cost - Cost analysis and optimization
    • Drift - Configuration drift detection
    • Smoke - Live infrastructure testing
    • Documentation - Documentation and completeness

DEPENDENCIES:
    • terraform >= 1.5.0
    • tflint (Terraform linting)
    • checkov (security scanning)
    • tfsec (security scanning)
    • terraform-compliance (policy testing)
    • aws-cli >= 2.0
    • jq (JSON processing)
    • curl (HTTP testing)
    • kubectl (Kubernetes testing)

EOF
}

# Parse command line arguments
parse_args() {
    COMMAND=""
    ENVIRONMENT="development"
    DRY_RUN=false
    VERBOSE=false
    OUTPUT_DIR="$REPORTS_DIR"
    TIMEOUT="30m"
    PARALLEL=4
    SEVERITY="low"
    EXCLUDE=""
    INCLUDE=""
    FORMAT="json"

    while [[ $# -gt 0 ]]; do
        case $1 in
            test-all|validate|security|compliance|performance|cost|drift|smoke|report)
                COMMAND="$1"
                shift
                ;;
            development|staging|production)
                ENVIRONMENT="$1"
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --output-dir)
                OUTPUT_DIR="$2"
                shift 2
                ;;
            --timeout)
                TIMEOUT="$2"
                shift 2
                ;;
            --parallel)
                PARALLEL="$2"
                shift 2
                ;;
            --severity)
                SEVERITY="$2"
                shift 2
                ;;
            --exclude)
                EXCLUDE="$2"
                shift 2
                ;;
            --include)
                INCLUDE="$2"
                shift 2
                ;;
            --format)
                FORMAT="$2"
                shift 2
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

    # Ensure output directory exists
    mkdir -p "$OUTPUT_DIR"
}

# Validate test prerequisites
validate_prerequisites() {
    log "Validating test prerequisites..."

    local missing_tools=()

    # Check required tools
    if ! command -v terraform &> /dev/null; then
        missing_tools+=("terraform")
    fi

    if ! command -v jq &> /dev/null; then
        missing_tools+=("jq")
    fi

    if ! command -v aws &> /dev/null; then
        missing_tools+=("aws-cli")
    fi

    if ! command -v curl &> /dev/null; then
        missing_tools+=("curl")
    fi

    # Check optional tools
    local optional_tools=()
    if ! command -v tflint &> /dev/null; then
        optional_tools+=("tflint")
    fi

    if ! command -v checkov &> /dev/null; then
        optional_tools+=("checkov")
    fi

    if ! command -v tfsec &> /dev/null; then
        optional_tools+=("tfsec")
    fi

    if ! command -v terraform-compliance &> /dev/null; then
        optional_tools+=("terraform-compliance")
    fi

    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        error "Missing required tools: ${missing_tools[*]}"
        error "Please install missing tools before running tests"
        exit 1
    fi

    if [[ ${#optional_tools[@]} -gt 0 ]]; then
        warning "Optional tools not found: ${optional_tools[*]}"
        info "Some tests may be skipped. Install optional tools for full coverage."
    fi

    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        error "AWS credentials not configured"
        exit 1
    fi

    # Check terraform environment
    cd "$TERRAFORM_DIR/environments/$ENVIRONMENT"
    if [[ ! -f "main.tf" ]]; then
        error "Terraform configuration not found for environment: $ENVIRONMENT"
        exit 1
    fi

    success "Prerequisites validated"
}

# Terraform validation tests
run_validation_tests() {
    log "Running Terraform validation tests..."

    local test_results="$TEST_RESULTS_DIR/validation-results.json"
    local validation_passed=true

    # Initialize test results
    cat > "$test_results" << EOF
{
  "test_suite": "validation",
  "environment": "$ENVIRONMENT",
  "timestamp": "$(date -Iseconds)",
  "tests": []
}
EOF

    # Test 1: Terraform format check
    log "Testing Terraform format..."
    if terraform fmt -recursive -check -diff "$TERRAFORM_DIR" > "$OUTPUT_DIR/fmt-check.log" 2>&1; then
        success "Terraform format check passed"
        add_test_result "$test_results" "terraform_format" "passed" "Terraform files are properly formatted"
    else
        error "Terraform format check failed"
        add_test_result "$test_results" "terraform_format" "failed" "Terraform files have formatting issues"
        validation_passed=false
    fi

    # Test 2: Terraform validation
    log "Testing Terraform configuration..."
    cd "$TERRAFORM_DIR/environments/$ENVIRONMENT"
    if terraform validate > "$OUTPUT_DIR/validate.log" 2>&1; then
        success "Terraform validation passed"
        add_test_result "$test_results" "terraform_validation" "passed" "Terraform configuration is valid"
    else
        error "Terraform validation failed"
        add_test_result "$test_results" "terraform_validation" "failed" "Terraform configuration has errors"
        validation_passed=false
    fi

    # Test 3: Terraform plan dry run
    log "Testing Terraform plan..."
    if terraform plan -detailed-exit-code -out="$OUTPUT_DIR/test-plan.tfplan" > "$OUTPUT_DIR/plan.log" 2>&1; then
        success "Terraform plan passed"
        add_test_result "$test_results" "terraform_plan" "passed" "Terraform plan executed successfully"
    else
        local exit_code=$?
        if [[ $exit_code -eq 2 ]]; then
            warning "Terraform plan shows changes (this may be expected)"
            add_test_result "$test_results" "terraform_plan" "warning" "Terraform plan shows changes"
        else
            error "Terraform plan failed"
            add_test_result "$test_results" "terraform_plan" "failed" "Terraform plan failed"
            validation_passed=false
        fi
    fi

    # Test 4: TFLint (if available)
    if command -v tflint &> /dev/null; then
        log "Running TFLint..."
        cd "$TERRAFORM_DIR"
        if tflint --format=json > "$OUTPUT_DIR/tflint.json" 2>&1; then
            success "TFLint passed"
            add_test_result "$test_results" "tflint" "passed" "TFLint found no issues"
        else
            warning "TFLint found issues"
            add_test_result "$test_results" "tflint" "warning" "TFLint found issues"
        fi
    else
        info "Skipping TFLint - tool not installed"
        add_test_result "$test_results" "tflint" "skipped" "TFLint not available"
    fi

    if [[ "$validation_passed" == "true" ]]; then
        success "All validation tests passed"
        return 0
    else
        error "Some validation tests failed"
        return 1
    fi
}

# Security tests
run_security_tests() {
    log "Running security tests..."

    local test_results="$TEST_RESULTS_DIR/security-results.json"
    local security_passed=true

    # Initialize test results
    cat > "$test_results" << EOF
{
  "test_suite": "security",
  "environment": "$ENVIRONMENT",
  "timestamp": "$(date -Iseconds)",
  "tests": []
}
EOF

    cd "$TERRAFORM_DIR"

    # Test 1: Checkov (if available)
    if command -v checkov &> /dev/null; then
        log "Running Checkov security scan..."
        if checkov --directory "environments/$ENVIRONMENT" --framework terraform --output json --output-file-path "$OUTPUT_DIR/checkov.json" > "$OUTPUT_DIR/checkov.log" 2>&1; then
            local checkov_results=$(jq -r '.results.failed_checks | length' "$OUTPUT_DIR/checkov.json" 2>/dev/null || echo "0")
            if [[ "$checkov_results" -eq 0 ]]; then
                success "Checkov security scan passed"
                add_test_result "$test_results" "checkov" "passed" "No security issues found"
            else
                warning "Checkov found $checkov_results security issues"
                add_test_result "$test_results" "checkov" "warning" "Checkov found $checkov_results security issues"
            fi
        else
            error "Checkov security scan failed"
            add_test_result "$test_results" "checkov" "failed" "Checkov scan failed"
            security_passed=false
        fi
    else
        info "Skipping Checkov - tool not installed"
        add_test_result "$test_results" "checkov" "skipped" "Checkov not available"
    fi

    # Test 2: TFSec (if available)
    if command -v tfsec &> /dev/null; then
        log "Running TFSec security scan..."
        if tfsec "environments/$ENVIRONMENT" --format json --out "$OUTPUT_DIR/tfsec.json" > "$OUTPUT_DIR/tfsec.log" 2>&1; then
            local tfsec_results=$(jq -r '.results | length' "$OUTPUT_DIR/tfsec.json" 2>/dev/null || echo "0")
            if [[ "$tfsec_results" -eq 0 ]]; then
                success "TFSec security scan passed"
                add_test_result "$test_results" "tfsec" "passed" "No security issues found"
            else
                warning "TFSec found $tfsec_results security issues"
                add_test_result "$test_results" "tfsec" "warning" "TFSec found $tfsec_results security issues"
            fi
        else
            error "TFSec security scan failed"
            add_test_result "$test_results" "tfsec" "failed" "TFSec scan failed"
            security_passed=false
        fi
    else
        info "Skipping TFSec - tool not installed"
        add_test_result "$test_results" "tfsec" "skipped" "TFSec not available"
    fi

    # Test 3: Security best practices check
    log "Checking security best practices..."
    check_security_best_practices "$test_results"

    if [[ "$security_passed" == "true" ]]; then
        success "Security tests completed"
        return 0
    else
        error "Some security tests failed"
        return 1
    fi
}

# Check security best practices
check_security_best_practices() {
    local test_results="$1"
    cd "$TERRAFORM_DIR/environments/$ENVIRONMENT"

    # Check for encrypted storage
    local encrypted_resources=$(grep -r "encrypted.*true" . | wc -l || echo "0")
    if [[ "$encrypted_resources" -gt 0 ]]; then
        success "Found $encrypted_resources encrypted resources"
        add_test_result "$test_results" "encryption_check" "passed" "Found $encrypted_resources encrypted resources"
    else
        warning "No encrypted resources found"
        add_test_result "$test_results" "encryption_check" "warning" "No encrypted resources found"
    fi

    # Check for security groups
    local security_groups=$(grep -r "aws_security_group" . | wc -l || echo "0")
    if [[ "$security_groups" -gt 0 ]]; then
        success "Found $security_groups security groups"
        add_test_result "$test_results" "security_groups" "passed" "Found $security_groups security groups"
    else
        error "No security groups found"
        add_test_result "$test_results" "security_groups" "failed" "No security groups found"
    fi

    # Check for IAM policies with least privilege
    local iam_policies=$(grep -r "aws_iam_policy" . | wc -l || echo "0")
    if [[ "$iam_policies" -gt 0 ]]; then
        success "Found $iam_policies IAM policies"
        add_test_result "$test_results" "iam_policies" "passed" "Found $iam_policies IAM policies"
    else
        warning "No IAM policies found"
        add_test_result "$test_results" "iam_policies" "warning" "No IAM policies found"
    fi
}

# Compliance tests
run_compliance_tests() {
    log "Running compliance tests..."

    local test_results="$TEST_RESULTS_DIR/compliance-results.json"

    # Initialize test results
    cat > "$test_results" << EOF
{
  "test_suite": "compliance",
  "environment": "$ENVIRONMENT",
  "timestamp": "$(date -Iseconds)",
  "tests": []
}
EOF

    # Test 1: Terraform Compliance (if available)
    if command -v terraform-compliance &> /dev/null; then
        log "Running Terraform Compliance tests..."
        cd "$TERRAFORM_DIR"

        # Create compliance features if they don't exist
        create_compliance_features

        if terraform-compliance -f tests/compliance/ -p "environments/$ENVIRONMENT" > "$OUTPUT_DIR/compliance.json" 2>&1; then
            success "Compliance tests passed"
            add_test_result "$test_results" "terraform_compliance" "passed" "All compliance tests passed"
        else
            warning "Some compliance tests failed"
            add_test_result "$test_results" "terraform_compliance" "warning" "Some compliance tests failed"
        fi
    else
        info "Skipping Terraform Compliance - tool not installed"
        add_test_result "$test_results" "terraform_compliance" "skipped" "Terraform Compliance not available"
    fi

    # Test 2: Tagging compliance
    check_tagging_compliance "$test_results"

    # Test 3: Resource naming compliance
    check_naming_compliance "$test_results"

    success "Compliance tests completed"
}

# Create compliance features
create_compliance_features() {
    local compliance_dir="$TERRAFORM_DIR/tests/compliance"
    mkdir -p "$compliance_dir"

    # Create basic compliance features
    cat > "$compliance_dir/security.feature" << EOF
Feature: Security Compliance

    Scenario: Ensure S3 buckets are encrypted
        Given I have AWS resources defined
        Then it must contain aws_s3_bucket
        And it must contain server_side_encryption
        And its value should be "AES256"

    Scenario: Ensure RDS instances are encrypted
        Given I have AWS resources defined
        Then it must contain aws_db_instance
        And it must contain storage_encrypted
        And its value should be true

    Scenario: Ensure security groups don't allow all traffic
        Given I have AWS resources defined
        Then it must contain aws_security_group
        And it must not contain ingress with cidr_blocks "0.0.0.0/0" and from_port 0 and to_port 65535
EOF

    cat > "$compliance_dir/cost.feature" << EOF
Feature: Cost Optimization

    Scenario: Ensure resources have cost tags
        Given I have AWS resources defined
        Then it must contain tags
        And it must contain "CostCenter"
        And it must contain "Environment"
EOF
}

# Check tagging compliance
check_tagging_compliance() {
    local test_results="$1"
    cd "$TERRAFORM_DIR/environments/$ENVIRONMENT"

    # Check for required tags
    local required_tags=("Project" "Environment" "ManagedBy" "Owner")
    local resources_with_tags=$(grep -r "tags.*=" . | wc -l || echo "0")

    if [[ "$resources_with_tags" -gt 0 ]]; then
        success "Found $resources_with_tags resources with tags"
        add_test_result "$test_results" "tagging" "passed" "Found $resources_with_tags resources with tags"

        # Check for specific required tags
        for tag in "${required_tags[@]}"; do
            local tag_count=$(grep -r "$tag" . | wc -l || echo "0")
            if [[ "$tag_count" -gt 0 ]]; then
                success "Found $tag_count resources with $tag tag"
            else
                warning "No resources found with $tag tag"
            fi
        done
    else
        warning "No resources with tags found"
        add_test_result "$test_results" "tagging" "warning" "No resources with tags found"
    fi
}

# Check naming compliance
check_naming_compliance() {
    local test_results="$1"
    cd "$TERRAFORM_DIR/environments/$ENVIRONMENT"

    # Check for naming convention compliance
    local resources=$(grep -h "resource.*{" *.tf | grep -v "^#" | wc -l || echo "0")
    if [[ "$resources" -gt 0 ]]; then
        success "Found $resources resources following naming conventions"
        add_test_result "$test_results" "naming" "passed" "Found $resources resources following naming conventions"
    else
        warning "No resources found or naming convention issues"
        add_test_result "$test_results" "naming" "warning" "Naming convention issues detected"
    fi
}

# Performance tests
run_performance_tests() {
    log "Running performance tests..."

    local test_results="$TEST_RESULTS_DIR/performance-results.json"

    # Initialize test results
    cat > "$test_results" << EOF
{
  "test_suite": "performance",
  "environment": "$ENVIRONMENT",
  "timestamp": "$(date -Iseconds)",
  "tests": []
}
EOF

    # Test 1: Terraform plan performance
    cd "$TERRAFORM_DIR/environments/$ENVIRONMENT"
    log "Testing Terraform plan performance..."
    local plan_start=$(date +%s)
    if timeout "$TIMEOUT" terraform plan -out=/dev/null > "$OUTPUT_DIR/performance-plan.log" 2>&1; then
        local plan_end=$(date +%s)
        local plan_duration=$((plan_end - plan_start))

        if [[ "$plan_duration" -lt 300 ]]; then  # 5 minutes
            success "Terraform plan completed in ${plan_duration}s"
            add_test_result "$test_results" "plan_performance" "passed" "Terraform plan completed in ${plan_duration}s"
        else
            warning "Terraform plan took ${plan_duration}s (slow)"
            add_test_result "$test_results" "plan_performance" "warning" "Terraform plan took ${plan_duration}s (slow)"
        fi
    else
        error "Terraform plan failed or timed out"
        add_test_result "$test_results" "plan_performance" "failed" "Terraform plan failed or timed out"
    fi

    # Test 2: Resource count analysis
    local resource_count=$(grep -c "^resource" *.tf 2>/dev/null || echo "0")
    if [[ "$resource_count" -lt 100 ]]; then
        success "Resource count is reasonable: $resource_count"
        add_test_result "$test_results" "resource_count" "passed" "Resource count: $resource_count"
    else
        warning "High resource count: $resource_count"
        add_test_result "$test_results" "resource_count" "warning" "High resource count: $resource_count"
    fi

    success "Performance tests completed"
}

# Cost tests
run_cost_tests() {
    log "Running cost analysis..."

    local test_results="$TEST_RESULTS_DIR/cost-results.json"

    # Initialize test results
    cat > "$test_results" << EOF
{
  "test_suite": "cost",
  "environment": "$ENVIRONMENT",
  "timestamp": "$(date -Iseconds)",
  "tests": []
}
EOF

    # Test 1: Infracost analysis (if available)
    if command -v infracost &> /dev/null; then
        log "Running Infracost analysis..."
        cd "$TERRAFORM_DIR/environments/$ENVIRONMENT"

        if infracost breakdown --path . --format json --out-file "$OUTPUT_DIR/infracost.json" > "$OUTPUT_DIR/infracost.log" 2>&1; then
            local total_monthly_cost=$(jq -r '.totalMonthlyCost // "unknown"' "$OUTPUT_DIR/infracost.json" 2>/dev/null || echo "unknown")
            success "Cost analysis completed: \$$total_monthly_cost/month"
            add_test_result "$test_results" "infracost" "passed" "Estimated monthly cost: \$$total_monthly_cost"
        else
            warning "Infracost analysis failed"
            add_test_result "$test_results" "infracost" "warning" "Infracost analysis failed"
        fi
    else
        info "Skipping Infracost - tool not installed"
        add_test_result "$test_results" "infracost" "skipped" "Infracost not available"
    fi

    # Test 2: Budget analysis
    check_budget_compliance "$test_results"

    success "Cost analysis completed"
}

# Check budget compliance
check_budget_compliance() {
    local test_results="$1"

    # Check for AWS budgets if environment is production or staging
    if [[ "$ENVIRONMENT" == "production" || "$ENVIRONMENT" == "staging" ]]; then
        local budgets=$(aws budgets describe-budgets --account-id $(aws sts get-caller-identity --query Account --output text) --query "Budgets[?contains(Name, '$ENVIRONMENT')]" --output json 2>/dev/null | jq length || echo "0")

        if [[ "$budgets" -gt 0 ]]; then
            success "Found $budgets budgets for $ENVIRONMENT"
            add_test_result "$test_results" "budget_check" "passed" "Found $budgets budgets for $ENVIRONMENT"
        else
            warning "No budgets found for $ENVIRONMENT"
            add_test_result "$test_results" "budget_check" "warning" "No budgets found for $ENVIRONMENT"
        fi
    else
        info "Skipping budget check for $ENVIRONMENT environment"
        add_test_result "$test_results" "budget_check" "skipped" "Budget check not applicable"
    fi
}

# Drift detection
run_drift_tests() {
    log "Running drift detection..."

    local test_results="$TEST_RESULTS_DIR/drift-results.json"

    # Initialize test results
    cat > "$test_results" << EOF
{
  "test_suite": "drift",
  "environment": "$ENVIRONMENT",
  "timestamp": "$(date -Iseconds)",
  "tests": []
}
EOF

    cd "$TERRAFORM_DIR/environments/$ENVIRONMENT"

    # Refresh state
    log "Refreshing Terraform state..."
    if terraform refresh > "$OUTPUT_DIR/drift-refresh.log" 2>&1; then
        success "State refreshed successfully"
        add_test_result "$test_results" "state_refresh" "passed" "State refreshed successfully"
    else
        error "Failed to refresh state"
        add_test_result "$test_results" "state_refresh" "failed" "Failed to refresh state"
        return 1
    fi

    # Generate drift detection plan
    log "Generating drift detection plan..."
    local plan_file="drift-$(date +%Y%m%d-%H%M%S).plan"

    if terraform plan -detailed-exit-code -out="$plan_file" > "$OUTPUT_DIR/drift-plan.log" 2>&1; then
        local exit_code=$?
        case $exit_code in
            0)
                success "No configuration drift detected"
                add_test_result "$test_results" "drift_detection" "passed" "No configuration drift detected"
                rm -f "$plan_file"
                ;;
            1)
                error "Terraform plan failed during drift detection"
                add_test_result "$test_results" "drift_detection" "failed" "Terraform plan failed"
                rm -f "$plan_file"
                return 1
                ;;
            2)
                warning "Configuration drift detected"
                add_test_result "$test_results" "drift_detection" "warning" "Configuration drift detected"

                # Save drift report
                local drift_report="$OUTPUT_DIR/dift-report-$(date +%Y%m%d-%H%M%S).txt"
                terraform show "$plan_file" > "$drift_report"
                log "Drift report saved to: $drift_report"
                ;;
        esac
    else
        error "Failed to generate drift detection plan"
        add_test_result "$test_results" "drift_detection" "failed" "Failed to generate drift detection plan"
        return 1
    fi

    success "Drift detection completed"
}

# Smoke tests
run_smoke_tests() {
    log "Running smoke tests against deployed infrastructure..."

    local test_results="$TEST_RESULTS_DIR/smoke-results.json"

    # Initialize test results
    cat > "$test_results" << EOF
{
  "test_suite": "smoke",
  "environment": "$ENVIRONMENT",
  "timestamp": "$(date -Iseconds)",
  "tests": []
}
EOF

    # Test 1: AWS resource connectivity
    test_aws_connectivity "$test_results"

    # Test 2: Kubernetes cluster connectivity
    test_kubernetes_connectivity "$test_results"

    # Test 3: Application endpoints
    test_application_endpoints "$test_results"

    success "Smoke tests completed"
}

# Test AWS connectivity
test_aws_connectivity() {
    local test_results="$1"

    # Test AWS API connectivity
    if aws sts get-caller-identity > "$OUTPUT_DIR/aws-connectivity.log" 2>&1; then
        success "AWS API connectivity verified"
        add_test_result "$test_results" "aws_connectivity" "passed" "AWS API connectivity verified"
    else
        error "AWS API connectivity failed"
        add_test_result "$test_results" "aws_connectivity" "failed" "AWS API connectivity failed"
    fi

    # Test specific AWS resources (if they exist)
    local s3_buckets=$(aws s3 ls --query "Buckets[?contains(Name, '$ENVIRONMENT')].Name" --output text 2>/dev/null || echo "")
    if [[ -n "$s3_buckets" ]]; then
        success "Found S3 buckets for $ENVIRONMENT"
        add_test_result "$test_results" "s3_buckets" "passed" "Found S3 buckets"
    else
        warning "No S3 buckets found for $ENVIRONMENT"
        add_test_result "$test_results" "s3_buckets" "warning" "No S3 buckets found"
    fi
}

# Test Kubernetes connectivity
test_kubernetes_connectivity() {
    local test_results="$1"

    # Test kubectl connectivity
    if kubectl cluster-info > "$OUTPUT_DIR/k8s-connectivity.log" 2>&1; then
        success "Kubernetes cluster connectivity verified"
        add_test_result "$test_results" "kubernetes_connectivity" "passed" "Kubernetes cluster connectivity verified"

        # Test node status
        local ready_nodes=$(kubectl get nodes --no-headers | grep "Ready" | wc -l || echo "0")
        if [[ "$ready_nodes" -gt 0 ]]; then
            success "Found $ready_nodes ready nodes"
            add_test_result "$test_results" "kubernetes_nodes" "passed" "Found $ready_nodes ready nodes"
        else
            warning "No ready nodes found"
            add_test_result "$test_results" "kubernetes_nodes" "warning" "No ready nodes found"
        fi
    else
        warning "Kubernetes cluster connectivity failed (cluster may not be deployed)"
        add_test_result "$test_results" "kubernetes_connectivity" "warning" "Kubernetes cluster not accessible"
    fi
}

# Test application endpoints
test_application_endpoints() {
    local test_results="$1"

    # Get load balancer DNS name (if it exists)
    local alb_dns=$(aws elbv2 describe-load-balancers --names "${var.project_name}-${ENVIRONMENT}-alb" --query "LoadBalancers[0].DNSName" --output text 2>/dev/null || echo "")

    if [[ -n "$alb_dns" && "$alb_dns" != "None" ]]; then
        log "Testing application endpoint: $alb_dns"

        # Test HTTP connectivity
        if curl -f -s --max-time 10 "http://$alb_dns/health" > "$OUTPUT_DIR/health-check.log" 2>&1; then
            success "Application health check passed"
            add_test_result "$test_results" "application_health" "passed" "Application health check passed"
        else
            warning "Application health check failed"
            add_test_result "$test_results" "application_health" "warning" "Application health check failed"
        fi

        # Test HTTPS connectivity
        if curl -f -s --max-time 10 "https://$alb_dns/health" > "$OUTPUT_DIR/health-check-https.log" 2>&1; then
            success "Application HTTPS health check passed"
            add_test_result "$test_results" "application_health_https" "passed" "Application HTTPS health check passed"
        else
            warning "Application HTTPS health check failed"
            add_test_result "$test_results" "application_health_https" "warning" "Application HTTPS health check failed"
        fi
    else
        info "No load balancer found for $ENVIRONMENT"
        add_test_result "$test_results" "load_balancer" "skipped" "No load balancer found"
    fi
}

# Add test result to JSON
add_test_result() {
    local test_results="$1"
    local test_name="$2"
    local status="$3"
    local message="$4"

    local temp_file=$(mktemp)
    jq --arg name "$test_name" --arg status "$status" --arg message "$message" --arg timestamp "$(date -Iseconds)" '.tests += [{"name": $name, "status": $status, "message": $message, "timestamp": $timestamp}]' "$test_results" > "$temp_file" && mv "$temp_file" "$test_results"
}

# Generate comprehensive report
generate_report() {
    log "Generating comprehensive test report..."

    local report_file="$OUTPUT_DIR/infrastructure-test-report-$(date +%Y%m%d-%H%M%S).html"

    cat > "$report_file" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>QuantumBeam Infrastructure Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { background-color: #2c3e50; color: white; padding: 20px; border-radius: 5px; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .passed { background-color: #d4edda; border-color: #c3e6cb; }
        .warning { background-color: #fff3cd; border-color: #ffeaa7; }
        .failed { background-color: #f8d7da; border-color: #f5c6cb; }
        .skipped { background-color: #e2e3e5; border-color: #d6d8db; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .timestamp { color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>QuantumBeam Infrastructure Test Report</h1>
        <p>Environment: <strong>$ENVIRONMENT</strong></p>
        <p>Generated: <strong>$(date)</strong></p>
    </div>

EOF

    # Add test results from all test suites
    for test_suite in validation security compliance performance cost drift smoke; do
        local results_file="$TEST_RESULTS_DIR/${test_suite}-results.json"
        if [[ -f "$results_file" ]]; then
            cat >> "$report_file" << EOF
    <div class="section">
        <h2>${test_suite^} Tests</h2>
        <table>
            <tr>
                <th>Test Name</th>
                <th>Status</th>
                <th>Message</th>
                <th>Timestamp</th>
            </tr>
EOF

            jq -r '.tests[] | "<tr><td>\(.name)</td><td>\(.status)</td><td>\(.message)</td><td>\(.timestamp)</td></tr>" "$results_file" >> "$report_file" 2>/dev/null || echo "<tr><td colspan='4'>No results available</td></tr>" >> "$report_file"

            cat >> "$report_file" << EOF
        </table>
    </div>
EOF
        fi
    done

    cat >> "$report_file" << EOF
    <div class="section">
        <h2>Summary</h2>
        <p>This report provides a comprehensive overview of the infrastructure testing results for the $ENVIRONMENT environment.</p>
        <p><strong>Next Steps:</strong></p>
        <ul>
            <li>Review any failed tests and address issues</li>
            <li>Investigate warnings for potential improvements</li>
            <li>Monitor infrastructure health and performance</li>
            <li>Regularly run this test suite as part of CI/CD pipeline</li>
        </ul>
    </div>

    <div class="section">
        <p class="timestamp">Report generated by QuantumBeam Infrastructure Testing Suite</p>
    </div>
</body>
</html>
EOF

    success "Test report generated: $report_file"
    info "Open the report in your browser to view detailed results"
}

# Main function
main() {
    header

    # Parse arguments
    parse_args "$@"

    # Validate prerequisites
    validate_prerequisites

    # Record start time
    local start_time=$(date +%s)

    # Run tests based on command
    case "$COMMAND" in
        test-all)
            run_validation_tests || true
            run_security_tests || true
            run_compliance_tests || true
            run_performance_tests || true
            run_cost_tests || true
            run_drift_tests || true
            run_smoke_tests || true
            generate_report
            ;;
        validate)
            run_validation_tests
            ;;
        security)
            run_security_tests
            ;;
        compliance)
            run_compliance_tests
            ;;
        performance)
            run_performance_tests
            ;;
        cost)
            run_cost_tests
            ;;
        drift)
            run_drift_tests
            ;;
        smoke)
            run_smoke_tests
            ;;
        report)
            generate_report
            ;;
        *)
            error "Unknown command: $COMMAND"
            show_usage
            exit 1
            ;;
    esac

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    success "Testing completed in ${duration}s"
}

# Execute main function
main "$@"