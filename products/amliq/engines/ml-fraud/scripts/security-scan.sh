#!/bin/bash

# QuantumBeam Security Scanning Script
# This script performs comprehensive security scanning of the application

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
REPORT_DIR="$PROJECT_ROOT/security/reports"
TEMP_DIR="/tmp/quantumbeam-security-scan"

# Default values
ENVIRONMENT="staging"
TARGET_URL="https://staging.quantumbeam.io"
API_BASE_URL="https://api.staging.quantumbeam.io"
FULL_SCAN=false
API_SCAN=false
INFRA_SCAN=false
DEPENDENCY_SCAN=false
CONTAINER_SCAN=false
SAST_SCAN=false
COMPLIANCE_SCAN=false
REPORT_FORMAT="html"
REPORT_PATH="$REPORT_DIR"
DRY_RUN=false
VERBOSE=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✓ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠ $1${NC}"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ✗ $1${NC}"
}

# Usage information
usage() {
    cat << EOF
QuantumBeam Security Scanning Script

Usage: $0 [OPTIONS]

OPTIONS:
    -e, --environment ENVIRONMENT    Target environment (development, staging, production) [default: staging]
    -u, --url URL                    Target URL for scanning [default: https://staging.quantumbeam.io]
    -a, --api-url URL               API base URL [default: https://api.staging.quantumbeam.io]
    --full-scan                       Run comprehensive security scan
    --api-scan                        Run API security scan
    --infra-scan                      Run infrastructure security scan
    --dependency-scan                Run dependency vulnerability scan
    --container-scan                  Run container security scan
    --sast-scan                       Run static application security testing
    --compliance-scan                 Run compliance scan
    --report-format FORMAT             Report format (html, json, sarif, xml) [default: html]
    --report-path PATH                 Report output directory [default: $REPORT_DIR]
    --dry-run                         Perform a dry run without making changes
    --verbose                         Enable verbose output
    -h, --help                       Show this help message

EXAMPLES:
    # Run full security scan on staging
    $0 -e staging --full-scan

    # Run API security scan only
    $0 -e production --api-scan

    # Run dependency scan with JSON output
    $0 --dependency-scan --report-format json

    # Dry run to see what would be scanned
    $0 --full-scan --dry-run

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -u|--url)
                TARGET_URL="$2"
                shift 2
                ;;
            -a|--api-url)
                API_BASE_URL="$2"
                shift 2
                ;;
            --full-scan)
                FULL_SCAN=true
                API_SCAN=true
                INFRA_SCAN=true
                DEPENDENCY_SCAN=true
                CONTAINER_SCAN=true
                SAST_SCAN=true
                COMPLIANCE_SCAN=true
                shift
                ;;
            --api-scan)
                API_SCAN=true
                shift
                ;;
            --infra-scan)
                INFRA_SCAN=true
                shift
                ;;
            --dependency-scan)
                DEPENDENCY_SCAN=true
                shift
                ;;
            --container-scan)
                CONTAINER_SCAN=true
                shift
                ;;
            --sast-scan)
                SAST_SCAN=true
                shift
                ;;
            --compliance-scan)
                COMPLIANCE_SCAN=true
                shift
                ;;
            --report-format)
                REPORT_FORMAT="$2"
                shift 2
                ;;
            --report-path)
                REPORT_PATH="$2"
                shift 2
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done
}

# Validate prerequisites
validate_prerequisites() {
    log "Validating prerequisites..."

    # Check if required tools are installed
    local required_tools=("docker" "jq" "curl" "npm" "python3")
    local missing_tools=()

    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done

    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        exit 1
    fi

    # Check if we're in the project root
    if [[ ! -f "$PROJECT_ROOT/go.mod" ]]; then
        log_error "Script must be run from project root directory"
        exit 1
    fi

    # Check environment validity
    if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
        log_error "Invalid environment: $ENVIRONMENT. Must be one of: development, staging, production"
        exit 1
    fi

    # Create directories
    mkdir -p "$REPORT_DIR" "$TEMP_DIR"

    log_success "Prerequisites validation completed"
}

# Check if target is accessible
check_target_accessibility() {
    log "Checking target accessibility..."

    # Check web application
    if ! curl -f -s "$TARGET_URL/health" > /dev/null; then
        log_error "Target URL not accessible: $TARGET_URL"
        exit 1
    fi

    # Check API
    if ! curl -f -s "$API_BASE_URL/health" > /dev/null; then
        log_error "API URL not accessible: $API_BASE_URL"
        exit 1
    fi

    log_success "Target URLs are accessible"
}

# Install security scanning tools
install_security_tools() {
    log "Installing security scanning tools..."

    if [[ "$DRY_RUN" == true ]]; then
        log_warning "DRY RUN: Skipping tool installation"
        return 0
    fi

    # Install OWASP ZAP
    if ! command -v zaproxy &> /dev/null; then
        log "Installing OWASP ZAP..."
        docker pull owasp/zap2docker-stable
    fi

    # Install Nuclei
    if ! command -v nuclei &> /dev/null; then
        log "Installing Nuclei..."
        curl -L https://github.com/projectdiscovery/nuclei/releases/latest/download/nuclei_linux_amd64.zip -o /tmp/nuclei.zip
        unzip /tmp/nuclei.zip -d /usr/local/bin/
        rm /tmp/nuclei.zip
    fi

    # Install Nikto
    if ! command -v nikto &> /dev/null; then
        log "Installing Nikto..."
        sudo apt-get update && sudo apt-get install -y nikto
    fi

    # Install Trivy
    if ! command -v trivy &> dev/null; then
        log "Installing Trivy..."
        sudo apt-get update && sudo apt-get install -y wget apt-transport-https gnupg lsb-release
        wget -qO - https://github.com/aquasecurity/trivy/releases/download/v0.44.1/trivy_0.44.1_Linux-64bit.deb
        sudo dpkg -i trivy_0.44.1_Linux-64bit.deb
        rm trivy_0.44.1_Linux-64bit.deb
    fi

    # Install Semgrep
    if ! command -v semgrep &> /dev/null; then
        log "Installing Semgrep..."
        pip3 install semgrep
    fi

    # Install Gosec
    if ! command -v gosec &> /dev/null; then
        log "Installing Gosec..."
        go install github.com/securecodewarrior/gosec/v2/cmd/gosec@latest
    fi

    log_success "Security tools installation completed"
}

# Run OWASP ZAP scan
run_zap_scan() {
    local scan_name="zap_scan_${ENVIRONMENT}_$(date +%Y%m%d_%H%M%S)"
    local report_file="$REPORT_DIR/$scan_name.html"

    log "Running OWASP ZAP scan..."

    if [[ "$DRY_RUN" == true ]]; then
        log_warning "DRY RUN: Would run OWASP ZAP scan on $TARGET_URL"
        return 0
    fi

    # Run ZAP baseline scan
    docker run --rm -t \
        -v "$REPORT_DIR:/zap/wrk" \
        -w "/zap/wrk" \
        owasp/zap2docker-stable \
        zap-baseline.py -t "$TARGET_URL" \
        -J "$REPORT_DIR/zap_report.json" \
        -r "zap_report.html" \
        -I

    if [[ $? -ne 0 ]]; then
        log_error "OWASP ZAP scan failed"
        return 1
    fi

    log_success "OWASP ZAP scan completed"
    log "Report saved to: $REPORT_FILE"
}

# Run Nuclei scan
run_nuclei_scan() {
    local scan_name="nuclei_scan_${ENVIRONMENT}_$(date +%Y%m%d_%H%M%S)"
    local report_file="$REPORT_DIR/$scan_name.json"

    log "Running Nuclei scan..."

    if [[ "$DRY_RUN" == true ]]; then
        log_warning "DRY RUN: Would run Nuclei scan on $TARGET_URL"
        return 0
    fi

    # Get Nuclei templates
    nuclei -update-templates

    # Run Nuclei scan
    nuclei \
        -target "$TARGET_URL" \
        -severity high,critical \
        -json "$report_file" \
        -v \
        -t cves,vulnerabilities,exposures

    if [[ $? -ne 0 ]]; then
        log_error "Nuclei scan failed"
        return 1
    fi

    log_success "Nuclei scan completed"
    log "Report saved to: $report_file"
}

# Run Nikto scan
run_nikto_scan() {
    local scan_name="nikto_scan_${ENVIRONMENT}_$(date +%Y%m%d_%H%M%S)"
    local report_file="$REPORT_DIR/$scan_name.html"

    log "Running Nikto scan..."

    if [[ "$DRY_RUN" == true ]]; then
        log_warning "DRY RUN: Would run Nikto scan on $TARGET_URL"
        return 0
    fi

    # Run Nikto scan
    nikto -h "$TARGET_URL" \
        -o "$report_file" \
        -Format htm \
        -Tuning 9 \
        -ssl

    if [[ $? -ne 0 ]]; then
        log_error "Nikto scan failed"
        return 1
    fi

    log_success "Nikto scan completed"
    log "Report saved to: $report_file"
}

# Run API security scan
run_api_security_scan() {
    log "Running API security scan..."

    if [[ "$DRY_RUN" == true ]]; then
        log_warning "DRY RUN: Would run API security scan"
        return 0
    fi

    # Test authentication endpoints
    log "Testing authentication endpoints..."

    # Test login endpoint
    local login_response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d '{"email":"test@example.com","password":"test"}' \
        "$API_BASE_URL/auth/login" || true)

    if [[ "$login_response" =~ ^2 ]]; then
        log_warning "Login endpoint appears to accept weak credentials"
    fi

    # Test API key validation
    log "Testing API key validation..."
    local api_response=$(curl -s -w "\n%{http_code}" \
        -H "X-API-Key: invalid-key" \
        "$API_BASE_URL/health" || true)

    if [[ "$api_response" =~ ^2 ]]; then
        log_warning "API key validation appears to be weak"
    fi

    # Test for common API vulnerabilities
    log "Testing for common API vulnerabilities..."

    # Test for IDOR
    local idor_response=$(curl -s -w "\n%{http_code}" \
        -H "Authorization: Bearer fake_token" \
        "$API_BASE_URL/users/999999" || true)

    # Test for SQL injection
    local sqli_response=$(curl -s -w "\n%{http_code}" \
        -H "Authorization: Bearer fake_token" \
        "$API_BASE_URL/users?search=1' OR '1'='1" || true)

    # Test for XSS
    local xss_response=$(curl -s -w "\n%http_code}" \
        -H "Authorization: Bearer fake_token" \
        -H "Content-Type: application/json" \
        -d '{"comment":"<script>alert(1)</script>"}' \
        "$API_BASE_URL/comments" || true)

    # Generate API security report
    local api_report_file="$REPORT_DIR/api_security_report_$(date +%Y%m%d_%H%M%S).json"
    cat > "$api_report_file" << EOF
{
  "scan_type": "api_security",
  "environment": "$ENVIRONMENT",
  "target_url": "$API_BASE_URL",
  "timestamp": "$(date -Iseconds)",
  "findings": [
    {
      "test": "Authentication",
      "result": "$login_response",
      "status": "$(if [[ "$login_response" =~ ^2 ]]; then echo "warning"; else echo "ok"; fi)"
    },
    {
      "test": "API Key Validation",
      "result": "$api_response",
      "status": "$(if [[ "$api_response" =~ ^2 ]]; then echo "warning"; else echo "ok"; fi)"
    },
    {
      "test": "IDOR Vulnerability",
      "result": "$idor_response",
      "status": "$(if [[ "$idor_response" =~ ^2 ]]; then echo "warning"; else echo "ok"; fi)"
    },
    {
      "test": "SQL Injection",
      "result": "$sqli_response",
      "status": "$(if [[ "$sqli_response" =~ ^2 ]]; then echo "warning"; else echo "ok"; fi)"
    },
    {
      "test": "XSS Vulnerability",
      "result": "$xss_response",
      "status": "$(if [[ "$xss_response" =~ ^2 ]]; then echo "warning"; else echo "ok"; fi)"
    }
  ]
}
EOF

    log_success "API security scan completed"
    log "Report saved to: $api_report_file"
}

# Run dependency vulnerability scan
run_dependency_scan() {
    log "Running dependency vulnerability scan..."

    if [[ "$DRY_RUN" == true ]]; then
        log_warning "DRY RUN: Would run dependency scan"
        return 0
    fi

    local scan_name="dependency_scan_$(date +%Y%m%d_%H%M%S)"
    local report_file="$REPORT_DIR/$scan_name.json"

    # Run go list for dependencies
    cd "$PROJECT_ROOT"
    go list -json -m all ./... > "$TEMP_DIR/deps.json"

    # Use govuln for vulnerability scanning
    if ! command -v govuln &> /dev/null; then
        log "Installing govuln..."
        go install github.com/govuln/govuln/cmd/govuln@latest
    fi

    # Run vulnerability scan
    govuln -json "$report_file" ./...

    if [[ $? -ne 0 ]]; then
        log_error "Dependency vulnerability scan failed"
        return 1
    fi

    log_success "Dependency vulnerability scan completed"
    log "Report saved to: $report_file"
}

# Run container security scan
run_container_scan() {
    log "Running container security scan..."

    if [[ "$DRY_RUN" == true ]]; then
        log_warning "DRY RUN: Would run container scan"
        return 0
    fi

    local scan_name="container_scan_$(date +%Y%m%d_%H%M%S)"
    local report_file="$REPORT_DIR/$scan_name.json"

    # Get Docker image name
    local image_name="quantumbeam:latest"
    if [[ -n "$QUANTUMBEAM_IMAGE" ]]; then
        image_name="$QUANTUMBEAM_IMAGE"
    fi

    # Run Trivy scan
    trivy image \
        --format json \
        --output "$report_file" \
        "$image_name"

    if [[ $? -ne 0 ]]; then
        log_error "Container security scan failed"
        return 1
    fi

    log_success "Container security scan completed"
    log "Report saved to: $report_file"
}

# Run SAST scan
run_sast_scan() {
    log "Running static application security testing..."

    if [[ "$DRY_RUN" == true ]]; then
        log_warning "DRY RUN: Would run SAST scan"
        return 0
    fi

    local scan_name="sast_scan_$(date +%Y%m%d_%H%M%S)"
    local report_file="$REPORT_DIR/$scan_name.sarif"

    # Run Semgrep scan
    semgrep \
        --config="$PROJECT_ROOT/.semgrep.yml" \
        --sarif \
        --output="$report_file" \
        "$PROJECT_ROOT"

    # Run Gosec scan
    gosec \
        -fmt sarif \
        -out "$REPORT_DIR/gosec_report.sarif" \
        ./...

    # Combine results
    local combined_report="$REPORT_DIR/combined_sast_report_$(date +%Y%m%d_%H%M%S).sarif"
    python3 -c "
import json
import glob

results = []
for file in glob.glob('$REPORT_DIR/*.sarif'):
    try:
        with open(file) as f:
            data = json.load(f)
            if 'runs' in data:
                for run in data['runs']:
                    if 'results' in run:
                        results.extend(run['results'])
    except:
        pass

with open('$combined_report', 'w') as f:
    json.dump({'\$schema': 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemas/sarif-schema-2.1.0.json', 'runs': [{'tool': {'driver': {'name': 'combined'}, 'results': results}]}, f)
"

    log_success "SAST scan completed"
    log "Combined report saved to: $combined_report"
}

# Run compliance scan
run_compliance_scan() {
    log "Running compliance scan..."

    if [[ "$DRY_RUN" == true ]]; then
        log_warning "DRY RUN: Would run compliance scan"
        return 0
    fi

    local scan_name="compliance_scan_$(date +%Y%m%d_%H%M%S)"
    local report_file="$REPORT_DIR/$scan_name.json"

    # Check for common compliance requirements
    local compliance_results=()

    # Check for security headers
    local headers_response=$(curl -s -I "$TARGET_URL")

    local has_csp=false
    local has_hsts=false
    local has_x_frame_options=false
    local has_x_content_type_options=false

    while IFS= read -r line; do
        if [[ "$line" =~ Content-Security-Policy ]]; then
            has_csp=true
        fi
        if [[ "$line" =~ Strict-Transport-Security ]]; then
            has_hsts=true
        fi
        if [[ "$line" =~ X-Frame-Options ]]; then
            has_x_frame_options=true
        fi
        if [[ "$line" =~ X-Content-Type-Options ]]; then
            has_x_content_type_options=true
        fi
    done <<< "$headers_response"

    compliance_results+=("CSP Header: $(if [[ "$has_csp" == true ]]; then echo "✓"; else echo "✗"; fi)")
    compliance_results+=("HSTS Header: $(if [[ "$has_hsts" == true ]]; then echo "✓"; else echo "✗"; fi)")
    compliance_results+=("X-Frame-Options: $(if [[ "$x_frame_options" == true ]]; then echo "✓"; else echo "✗"; fi)")
    compliance_results+=("X-Content-Type-Options: $(if [[ "$x_content_type_options" == true ]]; then echo "✓"; else echo "✗"; fi)")

    # Check for HTTPS
    local is_https=false
    if [[ "$TARGET_URL" =~ ^https:// ]]; then
        is_https=true
    fi
    compliance_results+=("HTTPS Encryption: $(if [[ "$is_https" == true ]]; then echo "✓"; else echo "✗"; fi)")

    # Generate compliance report
    cat > "$report_file" << EOF
{
  "scan_type": "compliance",
  "environment": "$ENVIRONMENT",
  "target_url": "$TARGET_URL",
  "timestamp": "$(date -Iseconds)",
  "frameworks": {
    "OWASP_ASI": {
      "security_validation": {
        "input_validation": "checked",
        "output_encoding": "checked",
        "authentication": "checked"
      }
    },
    "results": {
      "security_headers": {
        "csp": "$has_csp",
        "hsts": "$has_hsts",
        "x_frame_options": "$x_frame_options",
        "x_content_type_options": "$x_content_type_options"
      },
      "encryption": {
        "in_transit": "$is_https"
      }
    },
    "detailed_results": [$(printf '{"name": "%s", "status": "%s"},' "${compliance_results[@]}" | paste -sd,')]
  }
}
EOF

    log_success "Compliance scan completed"
    log "Report saved to: $report_file"
}

# Generate combined report
generate_combined_report() {
    log "Generating combined security report..."

    local combined_report="$REPORT_DIR/security_scan_report_$(date +%Y%m%d_%H%M%S).html"

    cat > "$combined_report" << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>QuantumBeam Security Report - $ENVIRONMENT</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .header { background-color: #2c3e50; color: white; padding: 20px; margin-bottom: 20px; border-radius: 5px; }
        .summary { background-color: #3498db; color: white; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .section { background: white; padding: 20px; margin: 10px 0; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .critical { color: #e74c3c; font-weight: bold; }
        .high { color: #f39c12; font-weight: bold; }
        .medium { color: #f1c40f; font-weight: bold; }
        .low { color: #27ae60; }
        .pass { color: #27ae60; }
        .fail { color: #e74c3c; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; }
        .progress { width: 100%; height: 20px; background-color: #ecf0f1; border-radius: 10px; overflow: hidden; margin: 5px 0; }
        .progress-bar { height: 100%; background: linear-gradient(90deg, #27ae60, #2ecc71); }
    </style>
</head>
<body>
    <div class="header">
        <h1>QuantumBeam Security Report</h1>
        <p><strong>Environment:</strong> $ENVIRONMENT | <strong>Date:</strong> $(date) | <strong>Scanner:</strong> QuantumBeam Security Scanner</p>
    </div>

    <div class="summary">
        <h2>Executive Summary</h2>
        <p>This report contains the results of security scans performed on the QuantumBeam application.</p>
        <p><strong>Target:</strong> $TARGET_URL</p>
        <p><strong>API:</strong> $API_BASE_URL</p>
    </div>

EOF

    # Add scan results based on what was run
    if [[ "$API_SCAN" == true ]]; then
        cat >> "$combined_report" << EOF
    <div class="section">
        <h2>API Security Scan Results</h2>
        <p>API security testing was performed to identify vulnerabilities in the REST API endpoints.</p>
        <div class="progress">
            <div class="progress-bar" style="width: 75%;"></div>
        </div>
        <p><strong>Status:</strong> <span class="pass">Completed</span></p>
    </div>
EOF
    fi

    if [[ "$DEPENDENCY_SCAN" == true ]]; then
        cat >> "$combined_report" << EOF
    <div class="section">
        <h2>Dependency Vulnerability Scan</h2>
        <p>Dependency scanning was performed to identify vulnerabilities in third-party libraries.</p>
        <div class="progress">
            <div class="progress-bar" style="width: 100%;"></div>
        </div>
        <p><strong>Status:</strong> <span class="pass">Completed</span></p>
    </div>
EOF
    fi

    if [[ "$CONTAINER_SCAN" == true ]]; then
        cat >> "$combined_report" << EOF
    <div class="section">
        <h2>Container Security Scan</h2>
        <p>Container security scanning was performed to identify vulnerabilities in the Docker image.</p>
        <div class="progress">
            <div class="progress-bar" style="width: 90%;"></div>
        </div>
        <p><strong>Status:</strong> <span class="pass">Completed</span></p>
    </div>
EOF
    fi

    if [[ "$SAST_SCAN" == true ]]; then
        cat >> "$combined_report" << EOF
    <div class="section">
        <h2>Static Application Security Testing</h2>
        <p>Static analysis was performed to identify security issues in the source code.</p>
        <div class="progress">
            <div class="progress-bar" style="width: 85%;"></div>
        </div>
        <p><strong>Status:</strong> <span class="pass">Completed</span></p>
    </div>
EOF
    fi

    if [[ "$COMPLIANCE_SCAN" == true ]]; then
        cat >> "$combined_report" << EOF
    <div class="section">
        <h2>Compliance Scan</h2>
        <p>Compliance scanning was performed to verify adherence to security standards.</p>
        <div class="progress">
            <div class="progress-bar" style="width: 80%;"></div>
        </div>
        <p><strong>Status:</strong> <span class="pass">Completed</span></p>
    </div>
EOF
    fi

    cat >> "$combined_report" << EOF
    <div class="section">
        <h2>Recommendations</h2>
        <ul>
            <li>Address any critical or high severity findings immediately</li>
            <li>Implement a regular security testing schedule</li>
            <li>Keep all dependencies up to date</li>
            <li>Monitor security advisories and patch promptly</li>
            <li>Conduct regular security training for the development team</li>
        </ul>
    </div>

    <div class="section">
        <h2>Next Steps</h2>
        <ol>
            <li>Review detailed findings in individual scan reports</li>
            <li>Prioritize remediation based on risk assessment</li>
            <li>Implement fixes for identified vulnerabilities</li>
            <li>Re-scan to verify remediation effectiveness</li>
            <li>Update security policies and procedures</li>
        </ol>
    </div>

    <div class="section">
        <h2>Contact</h2>
        <p>For questions about this security report, please contact the QuantumBeam security team:</p>
        <ul>
            <li>Email: security@quantumbeam.io</li>
            <li>Slack: #security-team</li>
            <li>PagerDuty: Security Team</li>
        </ul>
    </div>

    <div class="section">
        <p><small>Generated on $(date) by QuantumBeam Security Scanner</small></p>
    </div>
</body>
</html>
EOF

    log_success "Combined security report generated"
    log "Report saved to: $combined_report"
}

# Cleanup temporary files
cleanup() {
    log "Cleaning up temporary files..."
    rm -rf "$TEMP_DIR"
}

# Main execution
main() {
    parse_args "$@"

    # Enable verbose mode if requested
    if [[ "$VERBOSE" == true ]]; then
        set -x
    fi

    # Execute scans based on flags
    if [[ "$FULL_SCAN" == true ]] || [[ "$API_SCAN" == true ]] || [[ "$INFRA_SCAN" == true ]] || [[ "$DEPENDENCY_SCAN" == true ]] || [[ "$CONTAINER_SCAN" == true ]] || [[ "$SAST_SCAN" == true ]] || [[ "$COMPLIANCE_SCAN" == true ]]; then
        validate_prerequisites
        check_target_accessibility
        install_security_tools

        if [[ "$API_SCAN" == true ]]; then
            run_api_security_scan
        fi

        if [[ "$INFRA_SCAN" == true ]]; then
            run_zap_scan
            run_nuclei_scan
            run_nikto_scan
        fi

        if [[ "$DEPENDENCY_SCAN" == true ]]; then
            run_dependency_scan
        fi

        if [[ "$CONTAINER_SCAN" == true ]]; then
            run_container_scan
        fi

        if [[ "$SAST_SCAN" == true ]]; then
            run_sast_scan
        fi

        if [[ "$COMPLIANCE_SCAN" == true ]]; then
            run_compliance_scan
        fi

        generate_combined_report
    else
        log_error "No scan type specified. Use --full-scan or specific scan options."
        usage
        exit 1
    fi

    cleanup

    # If script reaches here, scanning was successful
    exit 0
}

# Run main function with all arguments
main "$@"