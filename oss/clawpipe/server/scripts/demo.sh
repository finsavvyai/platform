#!/usr/bin/env bash
#
# FinSavvyAI Demo Script
#
# This script demonstrates the key features of FinSavvyAI in sequence.
# Useful for live demos, screen recordings, and testing.
#
# Usage:
#   ./scripts/demo.sh                    # Interactive demo
#   ./scripts/demo.sh --non-interactive   # Run without prompts
#   ./scripts/demo.sh --help              # Show options

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
GATEWAY_URL="${FINSAVVYAI_GATEWAY_URL:-http://localhost:8080}"
MASTER_URL="${FINSAVVYAI_MASTER_URL:-http://localhost:8000}"
WORKER_URL="${FINSAVVYAI_WORKER_URL:-http://localhost:8001}"
API_KEY="${FINSAVVYAI_API_KEY:-}"

# Options
INTERACTIVE=true
SKIP_SLOW=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --non-interactive)
            INTERACTIVE=false
            shift
            ;;
        --skip-slow)
            SKIP_SLOW=true
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --non-interactive    Run without prompts"
            echo "  --skip-slow          Skip slow operations"
            echo "  --help               Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Helper functions
print_section() {
    echo ""
    echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_step() {
    echo ""
    echo -e "${BLUE}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

print_json() {
    echo "$1" | python3 -m json.tool 2>/dev/null || echo "$1"
}

wait_for_user() {
    if [ "$INTERACTIVE" = true ]; then
        echo ""
        read -p "Press Enter to continue..."
    fi
}

check_service() {
    local url=$1
    local name=$2
    if curl -s -f "$url/health" > /dev/null 2>&1; then
        print_success "$name is running"
        return 0
    else
        print_error "$name is not accessible at $url"
        return 1
    fi
}

# Demo sections
demo_intro() {
    print_section "FinSavvyAI Demo"

    echo -e "${MAGENTA}FinSavvyAI v1.0.0${NC} - Distributed AI Cluster Management System"
    echo ""
    echo "This demo showcases the core features:"
    echo "  • Distributed cluster architecture"
    echo "  • OpenAI-compatible API"
    echo "  • Intelligent request routing"
    echo "  • Real-time monitoring"
    echo "  • Production features (circuit breakers, rate limiting, metrics)"
    echo ""

    if [ "$INTERACTIVE" = true ]; then
        echo "Configuration:"
        echo "  Gateway: $GATEWAY_URL"
        echo "  Master:  $MASTER_URL"
        echo "  Worker:  $WORKER_URL"
        echo ""
        read -p "Press Enter to start the demo..."
        echo ""
    fi
}

demo_health_check() {
    print_section "1. Health Checks"

    print_step "Checking API Gateway..."
    if check_service "$GATEWAY_URL" "API Gateway"; then
        curl -s "$GATEWAY_URL/health" | print_json
    fi
    wait_for_user

    print_step "Checking Master Server..."
    if check_service "$MASTER_URL" "Master Server"; then
        curl -s "$MASTER_URL/health" | print_json
    fi
    wait_for_user

    print_step "Checking Worker Node..."
    if check_service "$WORKER_URL" "Worker Node"; then
        curl -s "$WORKER_URL/health" | print_json
    fi
    wait_for_user
}

demo_cluster_status() {
    print_section "2. Cluster Status"

    print_step "Fetching cluster information from Master..."
    local cluster_status=$(curl -s "$MASTER_URL/cluster/status" 2>/dev/null)
    if [ -n "$cluster_status" ]; then
        print_success "Cluster status retrieved"
        echo "$cluster_status" | print_json
    else
        print_error "Failed to retrieve cluster status"
    fi
    wait_for_user

    print_step "Listing registered worker nodes..."
    local nodes=$(curl -s "$MASTER_URL/cluster/nodes" 2>/dev/null)
    if [ -n "$nodes" ]; then
        echo "$nodes" | print_json
        local node_count=$(echo "$nodes" | python3 -c "import sys, json; print(len(json.load(sys.stdin).get('nodes', [])))" 2>/dev/null || echo "?")
        print_success "Cluster has $node_count worker node(s)"
    else
        print_error "Failed to retrieve node list"
    fi
    wait_for_user
}

demo_models() {
    print_section "3. Model Discovery"

    print_step "Fetching available models via Gateway..."
    local models=$(curl -s "$GATEWAY_URL/v1/models" 2>/dev/null)
    if [ -n "$models" ]; then
        echo "$models" | print_json
        local model_count=$(echo "$models" | python3 -c "import sys, json; print(len(json.load(sys.stdin).get('data', [])))" 2>/dev/null || echo "?")
        print_success "Gateway has discovered $model_count model(s)"
    else
        print_error "Failed to retrieve models"
    fi
    wait_for_user
}

demo_api_versions() {
    print_section "4. API Versioning"

    print_step "Fetching API version information..."
    local versions=$(curl -s "$GATEWAY_URL/api/versions" 2>/dev/null)
    if [ -n "$versions" ]; then
        echo "$versions" | print_json
        print_success "API versioning is enabled"
    else
        print_error "Failed to retrieve version information"
    fi
    wait_for_user
}

demo_chat_completion() {
    print_section "5. Chat Completions (OpenAI-Compatible)"

    print_step "Sending a simple chat request..."
    print_info "Request: Explain quantum computing in one sentence"

    local auth_header=""
    if [ -n "$API_KEY" ]; then
        auth_header="-H 'Authorization: Bearer $API_KEY'"
    fi

    local response=$(curl -s -X POST "$GATEWAY_URL/v1/chat/completions" \
        -H "Content-Type: application/json" \
        $auth_header \
        -d '{
            "model": "gpt-3.5-turbo-sim",
            "messages": [
                {"role": "user", "content": "Explain quantum computing in one sentence."}
            ]
        }' 2>/dev/null)

    if [ -n "$response" ]; then
        echo "$response" | print_json
        print_success "Chat completion successful"

        # Extract and display the response
        local content=$(echo "$response" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d['choices'][0]['message']['content'] if 'choices' in d and d['choices'] else 'No response')" 2>/dev/null)
        if [ -n "$content" ] && [ "$content" != "No response" ]; then
            echo ""
            print_info "Response: $content"
        fi
    else
        print_error "Chat completion failed"
    fi
    wait_for_user
}

demo_streaming() {
    if [ "$SKIP_SLOW" = true ]; then
        return
    fi

    print_section "6. Streaming Responses"

    print_step "Sending a streaming chat request..."
    print_info "Request: Count to 10"

    local auth_header=""
    if [ -n "$API_KEY" ]; then
        auth_header="-H 'Authorization: Bearer $API_KEY'"
    fi

    echo ""
    curl -s -X POST "$GATEWAY_URL/v1/chat/completions" \
        -H "Content-Type: application/json" \
        $auth_header \
        -d '{
            "model": "gpt-3.5-turbo-sim",
            "messages": [
                {"role": "user", "content": "Count from 1 to 10."}
            ],
            "stream": true
        }' | while read -r line; do
            if [[ $line == data:* ]]; then
                local data="${line:5}"
                if [[ $data != "[DONE]" ]]; then
                    local content=$(echo "$data" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('choices', [{}])[0].get('delta', {}).get('content', ''))" 2>/dev/null)
                    if [ -n "$content" ]; then
                        echo -n "$content"
                    fi
                fi
            fi
        done
    echo ""
    echo ""
    print_success "Streaming response complete"
    wait_for_user
}

demo_metrics() {
    print_section "7. Metrics (Prometheus)"

    print_step "Fetching Prometheus metrics..."
    local metrics=$(curl -s "$GATEWAY_URL/metrics" 2>/dev/null)
    if [ -n "$metrics" ]; then
        echo "$metrics" | head -30
        echo "..."
        print_success "Metrics endpoint is available"
    else
        print_error "Failed to retrieve metrics"
    fi
    wait_for_user
}

demo_gateway_info() {
    print_section "8. Gateway Information"

    print_step "Fetching gateway root endpoint..."
    local info=$(curl -s "$GATEWAY_URL/" 2>/dev/null)
    if [ -n "$info" ]; then
        echo "$info" | print_json
        print_success "Gateway information retrieved"
    else
        print_error "Failed to retrieve gateway info"
    fi
    wait_for_user
}

demo_features() {
    print_section "9. Production Features"

    echo "FinSavvyAI includes these production-ready features:"
    echo ""
    echo -e "${GREEN}✓${NC} Circuit Breaker Pattern - Prevents cascading failures"
    echo -e "${GREEN}✓${NC} Rate Limiting - Sliding window algorithm"
    echo -e "${GREEN}✓${NC} Request Tracking - Correlation IDs for debugging"
    echo -e "${GREEN}✓${NC} Connection Pooling - Efficient HTTP connections"
    echo -e "${GREEN}✓${NC} Request Caching - Reduced latency for repeated requests"
    echo -e "${GREEN}✓${NC} API Versioning - Backward-compatible API evolution"
    echo -e "${GREEN}✓${NC} Prometheus Metrics - Production monitoring"
    echo -e "${GREEN}✓${NC} Structured Logging - JSON logs with correlation"
    echo -e "${GREEN}✓${NC} Distributed Tracing - W3C Trace Context support"
    echo -e "${GREEN}✓${NC} Audit Logging - Security event tracking"
    echo ""
    wait_for_user
}

demo_outro() {
    print_section "Demo Complete"

    echo -e "${MAGENTA}Thank you for exploring FinSavvyAI!${NC}"
    echo ""
    echo "Next Steps:"
    echo "  • Read the full documentation: docs/"
    echo "  • Deploy to production: scripts/install_systemd.sh"
    echo "  • Run tests: python -m pytest tests/"
    echo "  • Try the desktop app: open desktop-app/"
    echo ""
    echo "Learn more:"
    echo "  • GitHub: https://github.com/finsavvyai/finsavvyai"
    echo "  • Documentation: https://docs.finsavvyai.com"
    echo ""
}

# Main demo flow
main() {
    demo_intro
    demo_health_check
    demo_cluster_status
    demo_models
    demo_api_versions
    demo_chat_completion
    demo_streaming
    demo_metrics
    demo_gateway_info
    demo_features
    demo_outro
}

main
