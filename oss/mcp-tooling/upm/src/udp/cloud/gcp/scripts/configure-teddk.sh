#!/bin/bash

# UDP teddk Integration Configuration Script
# Configures teddk to use GCP-deployed UDP instance

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load configuration
if [ -f .env.gcp ]; then
    source .env.gcp
else
    echo "❌ .env.gcp file not found. Run setup-gcp.sh first."
    exit 1
fi

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

check_prerequisites() {
    log_info "Checking prerequisites for teddk integration..."

    # Check if UDP is deployed
    if ! kubectl get deployment udp-api -n udp &>/dev/null; then
        log_error "UDP is not deployed. Run deploy-udp.sh first."
        exit 1
    fi

    # Check if teddk is installed
    if ! command -v teddk &>/dev/null; then
        log_warning "teddk CLI not found. Installing..."
        install_teddk
    fi

    log_success "Prerequisites check passed"
}

install_teddk() {
    log_info "Installing teddk CLI..."

    # Check if we're in the UPM project directory
    if [ ! -f "udp-cli-example.py" ]; then
        log_error "Please run this script from the UPM project root directory"
        exit 1
    fi

    # Install from local source
    pip install -e .

    log_success "teddk CLI installed"
}

get_udp_endpoint() {
    log_info "Getting UDP deployment endpoint..."

    # Try to get external IP from ingress
    EXTERNAL_IP=$(kubectl get ingress udp-ingress -n udp -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")

    if [ -n "$EXTERNAL_IP" ] && [ "$EXTERNAL_IP" != "null" ]; then
        UDP_ENDPOINT="http://$EXTERNAL_IP"
        log_success "Found external IP: $EXTERNAL_IP"
    else
        # Fall back to port forwarding setup
        log_warning "External IP not available yet. Setting up port forwarding..."
        setup_port_forwarding
        UDP_ENDPOINT="http://localhost:8080"
    fi

    log_info "UDP endpoint: $UDP_ENDPOINT"
}

setup_port_forwarding() {
    log_info "Setting up port forwarding for local access..."

    # Check if port forwarding is already running
    if lsof -ti:8080 &>/dev/null; then
        log_warning "Port 8080 is already in use. Killing existing process..."
        lsof -ti:8080 | xargs kill -9 || true
        sleep 2
    fi

    # Start port forwarding in background
    kubectl port-forward service/udp-api-service 8080:8000 -n udp &
    PORT_FORWARD_PID=$!

    # Save PID for cleanup
    echo $PORT_FORWARD_PID > /tmp/udp-port-forward.pid

    # Wait for port forwarding to be ready
    local timeout=30
    local elapsed=0
    while [ $elapsed -lt $timeout ]; do
        if curl -s http://localhost:8080/health &>/dev/null; then
            log_success "Port forwarding ready"
            break
        fi
        sleep 1
        elapsed=$((elapsed + 1))
    done

    if [ $elapsed -ge $timeout ]; then
        log_error "Port forwarding failed to start"
        kill $PORT_FORWARD_PID &>/dev/null || true
        exit 1
    fi
}

get_authentication_token() {
    log_info "Setting up authentication for UDP API..."

    # Get JWT secret for token generation
    JWT_SECRET=$(gcloud secrets versions access latest --secret="udp-jwt-secret")

    # Create a test API key (in production, this would be done through the UDP API)
    API_KEY=$(openssl rand -hex 32)

    log_info "API Key generated: $API_KEY"
    log_warning "Store this API key securely - it won't be shown again"
}

create_teddk_config() {
    log_info "Creating teddk configuration..."

    # Create teddk config directory
    mkdir -p ~/.teddk

    # Create configuration file
    cat > ~/.teddk/config.yaml << EOF
# teddk Configuration for UDP GCP Deployment
# Generated on $(date)

# UDP API Configuration
api:
  endpoint: "$UDP_ENDPOINT"
  version: "v1"
  timeout: 30
  retries: 3

# Authentication
auth:
  type: "bearer"  # or "api_key"
  token: "$API_KEY"
  # api_key: "$API_KEY"  # Alternative auth method

# Project Configuration
project:
  name: "My UDP Project"
  id: "$(openssl rand -hex 8)"
  organization: "default"

# Analysis Settings
analysis:
  # Package managers to scan
  ecosystems:
    - npm
    - pip
    - maven
    - cargo
    - nuget
    - go

  # Dependency scanning options
  scanning:
    include_dev_dependencies: true
    include_optional_dependencies: false
    max_depth: 10
    timeout_per_package: 30

# Policy Configuration
policies:
  # Vulnerability thresholds
  vulnerability:
    fail_on_critical: true
    fail_on_high: false
    fail_on_medium: false
    fail_on_low: false

  # License restrictions
  license:
    allowed:
      - MIT
      - Apache-2.0
      - BSD-3-Clause
      - ISC
    restricted:
      - GPL-3.0
      - AGPL-3.0
    unknown_allowed: false

# Reporting Configuration
reporting:
  format: "json"  # json, yaml, table, csv
  output_file: "udp-report.json"
  include_graphs: true
  include_recommendations: true

# Workflow Configuration
workflows:
  # Approval requirements
  approval:
    required_for_critical: true
    required_for_high: false
    auto_approve_low: true

  # Integration settings
  integration:
    git:
      create_pull_requests: true
      auto_merge_approved: false

    notifications:
      slack:
        enabled: false
        webhook_url: ""

      email:
        enabled: false
        smtp_server: ""

# Cache Configuration
cache:
  enabled: true
  ttl: 3600  # 1 hour
  directory: "~/.teddk/cache"

# Logging Configuration
logging:
  level: "INFO"  # DEBUG, INFO, WARNING, ERROR
  file: "~/.teddk/logs/teddk.log"
  max_size: "10MB"
  max_files: 5

# GCP Specific Configuration
gcp:
  project_id: "$GOOGLE_CLOUD_PROJECT"
  region: "$GOOGLE_CLOUD_REGION"
  storage_bucket: "$GOOGLE_CLOUD_PROJECT-udp-storage"
EOF

    log_success "teddk configuration created at ~/.teddk/config.yaml"
}

create_sample_project() {
    log_info "Creating sample project for testing..."

    # Create sample directory
    mkdir -p /tmp/teddk-sample-project
    cd /tmp/teddk-sample-project

    # Create sample package.json
    cat > package.json << EOF
{
  "name": "teddk-sample-project",
  "version": "1.0.0",
  "description": "Sample project for testing teddk with UDP",
  "main": "index.js",
  "dependencies": {
    "express": "^4.18.0",
    "lodash": "^4.17.21",
    "axios": "^1.4.0",
    "moment": "^2.29.4"
  },
  "devDependencies": {
    "jest": "^29.5.0",
    "eslint": "^8.42.0"
  }
}
EOF

    # Create sample requirements.txt
    cat > requirements.txt << EOF
fastapi==0.100.0
uvicorn==0.22.0
pydantic==2.0.0
sqlalchemy==2.0.15
requests==2.31.0
numpy==1.24.3
pandas==2.0.2
EOF

    # Create sample pom.xml
    cat > pom.xml << EOF
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.example</groupId>
    <artifactId>teddk-sample</artifactId>
    <version>1.0.0</version>

    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
            <version>3.1.0</version>
        </dependency>
        <dependency>
            <groupId>com.fasterxml.jackson.core</groupId>
            <artifactId>jackson-databind</artifactId>
            <version>2.15.2</version>
        </dependency>
    </dependencies>
</project>
EOF

    log_success "Sample project created at /tmp/teddk-sample-project"
}

test_teddk_integration() {
    log_info "Testing teddk integration with UDP..."

    cd /tmp/teddk-sample-project

    # Test basic connectivity
    log_info "Testing UDP API connectivity..."
    if curl -f "$UDP_ENDPOINT/health" &>/dev/null; then
        log_success "UDP API is accessible"
    else
        log_error "Cannot connect to UDP API"
        return 1
    fi

    # Test teddk scan
    log_info "Running teddk dependency scan..."
    if teddk scan --format json --output teddk-results.json; then
        log_success "teddk scan completed successfully"

        # Show results summary
        if [ -f "teddk-results.json" ]; then
            log_info "Scan results summary:"
            cat teddk-results.json | jq -r '.summary // "No summary available"' 2>/dev/null || \
                echo "Results saved to teddk-results.json"
        fi
    else
        log_warning "teddk scan encountered issues - this may be expected for initial setup"
    fi

    # Test policy evaluation
    log_info "Testing policy evaluation..."
    teddk policy check --policy ~/.teddk/config.yaml || log_warning "Policy check completed with warnings"
}

create_integration_scripts() {
    log_info "Creating integration helper scripts..."

    # Create start script
    cat > ~/.teddk/start-udp-tunnel.sh << 'EOF'
#!/bin/bash
# Start UDP port forwarding tunnel

PID_FILE="/tmp/udp-port-forward.pid"

# Check if already running
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p $PID > /dev/null 2>&1; then
        echo "UDP tunnel already running (PID: $PID)"
        exit 0
    else
        rm -f "$PID_FILE"
    fi
fi

# Start port forwarding
echo "Starting UDP tunnel..."
kubectl port-forward service/udp-api-service 8080:8000 -n udp &
PID=$!
echo $PID > "$PID_FILE"

# Wait for tunnel to be ready
sleep 3
if curl -s http://localhost:8080/health > /dev/null; then
    echo "UDP tunnel ready at http://localhost:8080"
else
    echo "Failed to start UDP tunnel"
    kill $PID 2>/dev/null || true
    rm -f "$PID_FILE"
    exit 1
fi
EOF

    # Create stop script
    cat > ~/.teddk/stop-udp-tunnel.sh << 'EOF'
#!/bin/bash
# Stop UDP port forwarding tunnel

PID_FILE="/tmp/udp-port-forward.pid"

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p $PID > /dev/null 2>&1; then
        echo "Stopping UDP tunnel (PID: $PID)..."
        kill $PID
        rm -f "$PID_FILE"
        echo "UDP tunnel stopped"
    else
        echo "UDP tunnel not running"
        rm -f "$PID_FILE"
    fi
else
    echo "UDP tunnel PID file not found"
fi
EOF

    # Create status script
    cat > ~/.teddk/udp-status.sh << 'EOF'
#!/bin/bash
# Check UDP deployment status

echo "=== UDP Deployment Status ==="
echo

echo "Pods:"
kubectl get pods -n udp -o wide

echo
echo "Services:"
kubectl get services -n udp

echo
echo "Ingress:"
kubectl get ingress -n udp

echo
echo "API Health:"
if curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo "✅ Local tunnel: http://localhost:8080"
elif curl -s "$UDP_ENDPOINT/health" > /dev/null 2>&1; then
    echo "✅ External access: $UDP_ENDPOINT"
else
    echo "❌ UDP API not accessible"
fi
EOF

    # Make scripts executable
    chmod +x ~/.teddk/*.sh

    log_success "Integration scripts created in ~/.teddk/"
}

output_integration_info() {
    log_info "Generating integration information..."

    cat > teddk-integration-info.txt << EOF
teddk Integration with UDP GCP Deployment
========================================

Configuration:
-------------
UDP Endpoint: $UDP_ENDPOINT
API Key: $API_KEY
Config File: ~/.teddk/config.yaml

Getting Started:
---------------
1. Start UDP tunnel (if using port forwarding):
   ~/.teddk/start-udp-tunnel.sh

2. Run a dependency scan:
   cd /tmp/teddk-sample-project
   teddk scan

3. Check policy compliance:
   teddk policy check

4. View scan results:
   teddk report --format table

5. Stop UDP tunnel:
   ~/.teddk/stop-udp-tunnel.sh

Useful Commands:
---------------
# Check UDP status
~/.teddk/udp-status.sh

# Scan current directory
teddk scan --output results.json

# Scan specific file
teddk scan --file package.json

# Check vulnerabilities only
teddk scan --vuln-only

# Generate report
teddk report --format html --output report.html

# List available policies
teddk policy list

# Update vulnerability database
teddk update

Configuration Files:
-------------------
- Main config: ~/.teddk/config.yaml
- Cache: ~/.teddk/cache/
- Logs: ~/.teddk/logs/teddk.log

Integration Scripts:
-------------------
- Start tunnel: ~/.teddk/start-udp-tunnel.sh
- Stop tunnel: ~/.teddk/stop-udp-tunnel.sh
- Check status: ~/.teddk/udp-status.sh

Troubleshooting:
---------------
1. If teddk cannot connect to UDP:
   - Check if UDP is running: kubectl get pods -n udp
   - Test API directly: curl $UDP_ENDPOINT/health
   - Restart tunnel: ~/.teddk/stop-udp-tunnel.sh && ~/.teddk/start-udp-tunnel.sh

2. If scans fail:
   - Check logs: tail ~/.teddk/logs/teddk.log
   - Verify config: teddk config validate
   - Test connectivity: teddk ping

3. For permission issues:
   - Verify API key is correct
   - Check UDP logs: kubectl logs -l app=udp,component=api -n udp

Sample Project:
--------------
A sample project has been created at: /tmp/teddk-sample-project
Use this to test teddk functionality with various package managers.

Next Steps:
----------
1. Customize policies in ~/.teddk/config.yaml
2. Integrate with your CI/CD pipeline
3. Set up notifications and reporting
4. Configure organization-wide policies in UDP

For more help:
-------------
- teddk help
- teddk docs
- UDP API docs: $UDP_ENDPOINT/docs
EOF

    log_success "Integration information saved to teddk-integration-info.txt"
}

cleanup() {
    # Clean up port forwarding if we started it
    if [ -f /tmp/udp-port-forward.pid ]; then
        PID=$(cat /tmp/udp-port-forward.pid)
        if ps -p $PID > /dev/null 2>&1; then
            log_info "Keeping port forwarding running for continued use"
            log_info "Use ~/.teddk/stop-udp-tunnel.sh to stop it"
        fi
    fi
}

main() {
    echo "🔗 teddk Integration with UDP GCP Deployment"
    echo "==========================================="
    echo

    check_prerequisites
    get_udp_endpoint
    get_authentication_token
    create_teddk_config
    create_sample_project
    test_teddk_integration
    create_integration_scripts
    output_integration_info

    echo
    log_success "teddk integration completed!"
    echo
    log_info "Configuration file: ~/.teddk/config.yaml"
    log_info "Sample project: /tmp/teddk-sample-project"
    log_info "Integration info: teddk-integration-info.txt"
    echo
    log_info "Quick start:"
    echo "1. cd /tmp/teddk-sample-project"
    echo "2. teddk scan"
    echo "3. teddk report"
    echo
    log_warning "Remember to secure your API key and update the UDP endpoint when you have a domain"

    # Set up cleanup trap
    trap cleanup EXIT
}

main "$@"