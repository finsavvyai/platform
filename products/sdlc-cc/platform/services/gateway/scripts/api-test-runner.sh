#!/bin/bash

# API Test Runner for SDLC.ai Platform
# This script runs comprehensive API tests using Newman (Postman CLI)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
API_COLLECTION="$ROOT_DIR/api/postman-config.json"
ENVIRONMENT_FILE="$ROOT_DIR/api/test-environment.json"
REPORTS_DIR="$ROOT_DIR/test-reports"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Test environments
DEV_ENV="development"
STAGING_ENV="staging"
PROD_ENV="production"

# Default environment
ENV=${1:-$DEV_ENV}

# Parse command line arguments
VERBOSE=false
PARALLEL=false
REPORT_FORMAT="html"
COLLECTION_ONLY=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENV="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -p|--parallel)
            PARALLEL=true
            shift
            ;;
        -f|--format)
            REPORT_FORMAT="$2"
            shift 2
            ;;
        -c|--collection)
            COLLECTION_ONLY="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS] [ENVIRONMENT]"
            echo ""
            echo "Options:"
            echo "  -e, --environment ENV   Set test environment (development|staging|production)"
            echo "  -v, --verbose           Enable verbose output"
            echo "  -p, --parallel          Run tests in parallel"
            echo "  -f, --format FORMAT     Report format (html|json|junit)"
            echo "  -c, --collection NAME   Run specific collection only"
            echo "  -h, --help              Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                      # Run tests with development environment"
            echo "  $0 staging              # Run tests with staging environment"
            echo "  $0 -v -p production    # Run verbose parallel tests on production"
            exit 0
            ;;
        *)
            if [[ ! $1 =~ ^- ]]; then
                ENV="$1"
            fi
            shift
            ;;
    esac
done

# Validate environment
case $ENV in
    $DEV_ENV|$STAGING_ENV|$PROD_ENV)
        ;;
    *)
        echo -e "${RED}Error: Invalid environment '$ENV'. Use: $DEV_ENV, $STAGING_ENV, or $PROD_ENV${NC}"
        exit 1
        ;;
esac

# Print header
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  SDLC.ai API Test Runner${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Environment: ${YELLOW}$ENV${NC}"
echo -e "Timestamp: ${YELLOW}$TIMESTAMP${NC}"
echo -e "Report Format: ${YELLOW}$REPORT_FORMAT${NC}"
echo ""

# Check dependencies
check_dependencies() {
    echo -e "${BLUE}Checking dependencies...${NC}"

    if ! command -v node &> /dev/null; then
        echo -e "${RED}Error: Node.js is not installed${NC}"
        exit 1
    fi

    if ! command -v npm &> /dev/null; then
        echo -e "${RED}Error: npm is not installed${NC}"
        exit 1
    fi

    if ! command -v newman &> /dev/null; then
        echo -e "${YELLOW}Installing Newman...${NC}"
        npm install -g newman newman-reporter-html newman-reporter-json newman-reporter-junit
    fi

    echo -e "${GREEN}✓ All dependencies satisfied${NC}"
}

# Setup test environment
setup_environment() {
    echo -e "${BLUE}Setting up test environment...${NC}"

    # Create reports directory
    mkdir -p "$REPORTS_DIR"

    # Create environment file if it doesn't exist
    if [[ ! -f "$ENVIRONMENT_FILE" ]]; then
        echo -e "${YELLOW}Creating test environment file...${NC}"

        # Load base URL based on environment
        BASE_URL=""
        case $ENV in
            $DEV_ENV)
                BASE_URL="http://localhost:8080/v1"
                ;;
            $STAGING_ENV)
                BASE_URL="https://staging-api.sdlc.cc/v1"
                ;;
            $PROD_ENV)
                BASE_URL="https://api.sdlc.cc/v1"
                ;;
        esac

        # Create environment file
        cat > "$ENVIRONMENT_FILE" << EOF
{
  "id": "sdlc-test-env-$ENV",
  "name": "SDLC $ENV Test Environment",
  "values": [
    {
      "key": "base_url",
      "value": "$BASE_URL",
      "enabled": true
    },
    {
      "key": "tenant_id",
      "value": "123e4567-e89b-12d3-a456-426614174000",
      "enabled": true
    },
    {
      "key": "user_email",
      "value": "test@sdlc.cc",
      "enabled": true
    },
    {
      "key": "user_password",
      "value": "TestPass123!",
      "enabled": true
    }
  ],
  "_postman_variable_scope": "environment"
}
EOF
    fi

    echo -e "${GREEN}✓ Test environment setup complete${NC}"
}

# Run health check
run_health_check() {
    echo -e "${BLUE}Running health check...${NC}"

    # Extract base URL from environment file
    BASE_URL=$(jq -r '.values[] | select(.key == "base_url") | .value' "$ENVIRONMENT_FILE")

    # Check if API is accessible
    if curl -s -f "$BASE_URL/health" > /dev/null; then
        echo -e "${GREEN}✓ API health check passed${NC}"
    else
        echo -e "${RED}✗ API health check failed${NC}"
        echo -e "${RED}Please ensure the API server is running at $BASE_URL${NC}"
        exit 1
    fi
}

# Run tests
run_tests() {
    echo -e "${BLUE}Running API tests...${NC}"

    # Build Newman command
    NEWMAN_CMD="newman run"

    # Add collection
    if [[ -n "$COLLECTION_ONLY" ]]; then
        # Create a temporary collection with only the specified folder
        TEMP_COLLECTION="/tmp/sdlc-collection-$TIMESTAMP.json"
        jq --arg folder "$COLLECTION_ONLY" 'del(.item[] | select(.name != $folder))' "$API_COLLECTION" > "$TEMP_COLLECTION"
        NEWMAN_CMD="$NEWMAN_CMD $TEMP_COLLECTION"
    else
        NEWMAN_CMD="$NEWMAN_CMD $API_COLLECTION"
    fi

    # Add environment
    NEWMAN_CMD="$NEWMAN_CMD -e $ENVIRONMENT_FILE"

    # Add reporters
    REPORT_FILE="$REPORTS_DIR/api-test-report-$TIMESTAMP"
    NEWMAN_CMD="$NEWMAN_CMD -r cli,$REPORT_FORMAT"

    case $REPORT_FORMAT in
        html)
            NEWMAN_CMD="$NEWMAN_CMD --reporter-html-export $REPORT_FILE.html"
            ;;
        json)
            NEWMAN_CMD="$NEWMAN_CMD --reporter-json-export $REPORT_FILE.json"
            ;;
        junit)
            NEWMAN_CMD="$NEWMAN_CMD --reporter-junit-export $REPORT_FILE.xml"
            ;;
    esac

    # Add parallel execution if requested
    if [[ "$PARALLEL" == "true" ]]; then
        NEWMAN_CMD="$NEWMAN_CMD --parallel"
    fi

    # Add verbose output if requested
    if [[ "$VERBOSE" == "true" ]]; then
        NEWMAN_CMD="$NEWMAN_CMD --verbose"
    fi

    # Set timeout
    NEWMAN_CMD="$NEWMAN_CMD --timeout-request 30000"

    # Ignore redirects
    NEWMAN_CMD="$NEWMAN_CMD --ignore-redirects"

    # Colorize output
    NEWMAN_CMD="$NEWMAN_CMD --color on"

    # Execute Newman command
    echo -e "${BLUE}Executing: $NEWMAN_CMD${NC}"
    echo ""

    if eval $NEWMAN_CMD; then
        echo ""
        echo -e "${GREEN}✓ All tests passed successfully!${NC}"
        TEST_SUCCESS=true
    else
        echo ""
        echo -e "${RED}✗ Some tests failed${NC}"
        TEST_SUCCESS=false
    fi

    # Clean up temporary collection file
    if [[ -n "$COLLECTION_ONLY" && -f "$TEMP_COLLECTION" ]]; then
        rm -f "$TEMP_COLLECTION"
    fi
}

# Generate test summary
generate_summary() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  Test Summary${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo -e "Environment: ${YELLOW}$ENV${NC}"
    echo -e "Timestamp: ${YELLOW}$TIMESTAMP${NC}"
    echo -e "Status: $([ "$TEST_SUCCESS" == "true" ] && echo -e "${GREEN}PASSED${NC}" || echo -e "${RED}FAILED${NC}")"

    if [[ -f "$REPORT_FILE.html" ]]; then
        echo -e "HTML Report: ${YELLOW}file://$REPORT_FILE.html${NC}"
    fi

    if [[ -f "$REPORT_FILE.json" ]]; then
        echo -e "JSON Report: ${YELLOW}file://$REPORT_FILE.json${NC}"

        # Extract test statistics
        STATS=$(jq -r '.run.stats' "$REPORT_FILE.json")
        TOTAL=$(echo "$STATS" | jq -r '.total')
        PASSED=$(echo "$STATS" | jq -r '.passed')
        FAILED=$(echo "$STATS" | jq -r '.failed')

        echo ""
        echo -e "Total Tests: ${YELLOW}$TOTAL${NC}"
        echo -e "Passed: ${GREEN}$PASSED${NC}"
        echo -e "Failed: ${RED}$FAILED${NC}"
    fi

    if [[ -f "$REPORT_FILE.xml" ]]; then
        echo -e "JUnit Report: ${YELLOW}file://$REPORT_FILE.xml${NC}"
    fi
}

# Cleanup old reports
cleanup_reports() {
    echo -e "${BLUE}Cleaning up old reports...${NC}"

    # Keep only the last 10 reports
    find "$REPORTS_DIR" -name "api-test-report-*.*" -type f | sort -r | tail -n +11 | xargs -r rm

    echo -e "${GREEN}✓ Cleanup complete${NC}"
}

# Send notifications (optional)
send_notification() {
    if [[ -n "$SLACK_WEBHOOK_URL" ]]; then
        echo -e "${BLUE}Sending Slack notification...${NC}"

        COLOR="good"
        MESSAGE="API tests passed successfully"

        if [[ "$TEST_SUCCESS" != "true" ]]; then
            COLOR="danger"
            MESSAGE="API tests failed"
        fi

        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$MESSAGE\", \"attachments\":[{\"color\":\"$COLOR\", \"fields\":[{\"title\":\"Environment\",\"value\":\"$ENV\",\"short\":true},{\"title\":\"Timestamp\",\"value\":\"$TIMESTAMP\",\"short\":true}]}]}" \
            "$SLACK_WEBHOOK_URL"
    fi
}

# Main execution
main() {
    check_dependencies
    setup_environment
    run_health_check
    run_tests
    generate_summary
    cleanup_reports
    send_notification

    # Exit with appropriate code
    if [[ "$TEST_SUCCESS" == "true" ]]; then
        exit 0
    else
        exit 1
    fi
}

# Run main function
main
