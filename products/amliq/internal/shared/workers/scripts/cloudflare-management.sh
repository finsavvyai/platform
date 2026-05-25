#!/bin/bash

# FinTech Suite Cloudflare Management Script
# Comprehensive CLI tool for managing your deployed resources

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Helper functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_section() { echo -e "${PURPLE}=== $1 ===${NC}"; }

# Configuration
WORKER_NAME="finsavvy-ai-suite"
DOMAIN="finsavvyai.com"

# Navigate to workers directory
cd "$(dirname "$0")/.."

# Show menu
show_menu() {
    clear
    echo -e "${CYAN}"
    cat << "EOF"
╔══════════════════════════════════════════════════════════════╗
║                    🚀 FINTECH SUITE CLI MANAGER 🚀                 ║
║                      Cloudflare Resource Management                  ║
╚══════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
    echo -e "${YELLOW}Choose an option:${NC}"
    echo ""
    echo "📊 Database Management:"
    echo "  1) List D1 databases"
    echo "  2) Show database status"
    echo "  3) Execute SQL query"
    echo "  4) Backup databases"
    echo ""
    echo "🗂️  Storage Management:"
    echo "  5) List KV namespaces"
    echo "  6) List R2 buckets"
    echo "  7) Upload file to R2"
    echo ""
    echo "⚡ Worker Management:"
    echo "  8) Show worker status"
    echo "  9) View worker logs"
    echo "10) Deploy worker"
    echo "11) Test worker endpoints"
    echo ""
    echo "🔐 Security Management:"
    echo "12) List secrets"
    echo "13) Add new secret"
    echo ""
    echo "🌐 Domain & DNS:"
    echo "14) Show custom domains"
    echo "15) Test domain accessibility"
    echo ""
    echo "📈 Monitoring:"
    echo "16) Health check all services"
    echo "17) Performance test"
    echo ""
    echo "🔧 Advanced:"
    echo "18) Full system status"
    echo "19) Clean up resources"
    echo "20) Generate report"
    echo ""
    echo "0) Exit"
    echo ""
    echo -n "${CYAN}Enter your choice [0-20]: ${NC}"
}

# Database functions
list_databases() {
    log_section "D1 Database List"
    log_info "Retrieving all D1 databases..."
    if wrangler d1 list 2>/dev/null; then
        log_success "Databases retrieved successfully"
    else
        log_error "Failed to retrieve databases. Check your Cloudflare account ID in .env.local"
    fi
}

show_database_status() {
    log_section "Database Status Check"
    local databases=("finsavvy-primary" "finsavvy-secondary" "finsavvy-compliance")

    for db in "${databases[@]}"; do
        log_info "Checking database: $db"
        if wrangler d1 info "$db" 2>/dev/null; then
            log_success "✅ $db is accessible"
        else
            log_warning "⚠️  $db is not accessible"
        fi
    done
}

execute_sql() {
    log_section "SQL Query Executor"
    echo "Available databases:"
    echo "1) finsavvy-primary"
    echo "2) finsavvy-secondary"
    echo "3) finsavvy-compliance"
    echo ""
    read -p "Select database [1-3]: " db_choice

    case $db_choice in
        1) db="finsavvy-primary" ;;
        2) db="finsavvy-secondary" ;;
        3) db="finsavvy-compliance" ;;
        *) log_error "Invalid choice"; return ;;
    esac

    read -p "Enter SQL query: " sql_query
    log_info "Executing query on $db..."
    wrangler d1 execute "$db" --command="$sql_query"
}

backup_databases() {
    log_section "Database Backup"
    local backup_dir="backups/$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$backup_dir"

    log_info "Creating backup directory: $backup_dir"

    local databases=("finsavvy-primary" "finsavvy-secondary" "finsavvy-compliance")

    for db in "${databases[@]}"; do
        log_info "Backing up $db..."
        if wrangler d1 export "$db" --output="$backup_dir/$db.sql"; then
            log_success "✅ $db backed up successfully"
        else
            log_warning "⚠️  Failed to backup $db"
        fi
    done

    log_success "Backup completed in $backup_dir"
}

# Storage functions
list_kv_namespaces() {
    log_section "KV Namespace List"
    log_info "Retrieving KV namespaces..."
    if wrangler kv namespace list 2>/dev/null; then
        log_success "KV namespaces retrieved successfully"
    else
        log_error "Failed to retrieve KV namespaces. Check your Cloudflare account ID"
    fi
}

list_r2_buckets() {
    log_section "R2 Bucket List"
    log_info "Retrieving R2 buckets..."
    if wrangler r2 bucket list 2>/dev/null; then
        log_success "R2 buckets retrieved successfully"
    else
        log_error "Failed to retrieve R2 buckets. Check your Cloudflare account ID"
    fi
}

upload_to_r2() {
    log_section "R2 File Upload"
    read -p "Enter bucket name: " bucket
    read -p "Enter file path: " file_path

    if [ ! -f "$file_path" ]; then
        log_error "File not found: $file_path"
        return
    fi

    local filename=$(basename "$file_path")
    log_info "Uploading $filename to $bucket..."
    if wrangler r2 object put "$bucket" "$filename" "$file_path"; then
        log_success "✅ File uploaded successfully"
    else
        log_error "Failed to upload file"
    fi
}

# Worker functions
show_worker_status() {
    log_section "Worker Status"
    log_info "Checking worker: $WORKER_NAME"

    # Check recent deployments
    log_info "Recent deployments:"
    if wrangler deployments list 2>/dev/null; then
        log_success "Deployment status retrieved"
    else
        log_warning "Could not retrieve deployment status"
    fi

    # Test health endpoint
    log_info "Testing health endpoint..."
    local worker_url="https://$WORKER_NAME.workers.dev/health"
    if curl -sf "$worker_url" >/dev/null 2>&1; then
        log_success "✅ Worker is responding"
    else
        log_warning "⚠️  Worker is not responding at $worker_url"
    fi
}

view_worker_logs() {
    log_section "Worker Logs"
    log_info "Starting log tail for $WORKER_NAME..."
    log_info "Press Ctrl+C to stop"
    wrangler tail "$WORKER_NAME"
}

deploy_worker() {
    log_section "Worker Deployment"
    log_info "Deploying $WORKER_NAME..."

    log_info "Running dry-run check..."
    if wrangler deploy --dry-run; then
        log_success "Dry-run passed"
        log_info "Proceeding with deployment..."

        if wrangler deploy; then
            log_success "🎉 Worker deployed successfully!"
        else
            log_error "❌ Deployment failed"
        fi
    else
        log_error "❌ Dry-run failed, aborting deployment"
    fi
}

test_worker_endpoints() {
    log_section "Worker Endpoint Testing"
    local base_url="https://$WORKER_NAME.workers.dev"

    local endpoints=(
        "/health"
        "/api/status"
        "/"
    )

    for endpoint in "${endpoints[@]}"; do
        log_info "Testing: $base_url$endpoint"

        local start_time=$(date +%s%3N)
        local http_code=$(curl -s -o /tmp/endpoint_response.json -w "%{http_code}" "$base_url$endpoint" 2>/dev/null)
        local end_time=$(date +%s%3N)
        local response_time=$((end_time - start_time))

        if [ "$http_code" = "200" ]; then
            log_success "✅ $endpoint (${response_time}ms)"
            if [ -f /tmp/endpoint_response.json ]; then
                echo "Response: $(head -c 100 /tmp/endpoint_response.json)..."
            fi
        else
            log_warning "⚠️  $endpoint returned HTTP $http_code"
        fi

        rm -f /tmp/endpoint_response.json
        sleep 1
    done
}

# Security functions
list_secrets() {
    log_section "Secrets Management"
    log_info "Retrieving secret names..."
    if wrangler secret list 2>/dev/null; then
        log_success "Secret list retrieved (note: values are hidden for security)"
    else
        log_error "Failed to retrieve secrets"
    fi
}

add_secret() {
    log_section "Add New Secret"
    read -p "Enter secret name: " secret_name
    log_info "You will be prompted to enter the secret value securely..."
    wrangler secret put "$secret_name"
}

# Domain functions
show_custom_domains() {
    log_section "Custom Domains"
    log_info "Checking custom domains for $WORKER_NAME..."
    if wrangler custom-domains list 2>/dev/null; then
        log_success "Custom domains retrieved"
    else
        log_info "No custom domains configured or authentication issue"
    fi
}

test_domain_accessibility() {
    log_section "Domain Accessibility Test"
    local domains=(
        "https://suite.$DOMAIN"
        "https://api.$DOMAIN"
        "https://billing.$DOMAIN"
        "https://compliance.$DOMAIN"
        "https://intelligence.$DOMAIN"
        "https://risk.$DOMAIN"
    )

    for domain in "${domains[@]}"; do
        log_info "Testing: $domain"
        if curl -sf "$domain" >/dev/null 2>&1; then
            log_success "✅ $domain is accessible"
        else
            log_warning "⚠️  $domain is not accessible (may not be configured yet)"
        fi
    done
}

# Monitoring functions
health_check_all() {
    log_section "Complete System Health Check"

    echo -e "${CYAN}Checking all FinTech Suite services...${NC}"

    # Test databases
    log_info "Checking database connectivity..."
    local db_health=0
    local db_total=3
    if wrangler d1 info "finsavvy-primary" >/dev/null 2>&1; then ((db_health++)); fi
    if wrangler d1 info "finsavvy-secondary" >/dev/null 2>&1; then ((db_health++)); fi
    if wrangler d1 info "finsavvy-compliance" >/dev/null 2>&1; then ((db_health++)); fi
    log_success "Databases: $db_health/$db_total healthy"

    # Test worker
    log_info "Checking worker health..."
    if curl -sf "https://$WORKER_NAME.workers.dev/health" >/dev/null 2>&1; then
        log_success "✅ Worker is healthy"
    else
        log_warning "⚠️  Worker is not responding"
    fi

    # Test storage
    log_info "Checking storage services..."
    local storage_health=0
    local storage_total=2

    if wrangler kv namespace list >/dev/null 2>&1; then ((storage_health++)); fi
    if wrangler r2 bucket list >/dev/null 2>&1; then ((storage_health++)); fi
    log_success "Storage: $storage_health/$storage_total healthy"

    log_success "Health check completed!"
}

performance_test() {
    log_section "Performance Test"
    log_info "Running performance test on worker..."

    local base_url="https://$WORKER_NAME.workers.dev"
    local requests=50
    local success_count=0
    local total_time=0

    log_info "Making $requests requests to $base_url/health"

    for i in $(seq 1 $requests); do
        local start_time=$(date +%s%3N)
        local http_code=$(curl -s -o /dev/null -w "%{http_code}" "$base_url/health" 2>/dev/null)
        local end_time=$(date +%s%3N)
        local response_time=$((end_time - start_time))
        total_time=$((total_time + response_time))

        if [ "$http_code" = "200" ]; then
            ((success_count++))
        fi

        if [ $((i % 10)) -eq 0 ]; then
            echo -n "Progress: $i/$requests ($success_count successful)...\r"
        fi
    done

    local avg_response_time=$((total_time / requests))
    local success_rate=$((success_count * 100 / requests))

    echo ""
    log_success "Performance Test Results:"
    log_info "  Requests: $requests"
    log_info "  Successful: $success_count"
    log_info "  Success Rate: ${success_rate}%"
    log_info "  Avg Response Time: ${avg_response_time}ms"

    if [ "$success_rate" -ge 95 ]; then
        log_success "✅ Performance is excellent!"
    elif [ "$success_rate" -ge 80 ]; then
        log_warning "⚠️  Performance is acceptable"
    else
        log_error "❌ Performance needs improvement"
    fi
}

# Advanced functions
full_system_status() {
    log_section "Complete System Status Report"

    echo -e "${CYAN}FinTech Suite - System Status Report${NC}"
    echo -e "${CYAN}Generated on: $(date)${NC}"
    echo ""

    # Account Info
    log_info "Account Information:"
    wrangler whoami 2>/dev/null || echo "  Not authenticated or account ID issue"
    echo ""

    # Worker Status
    log_info "Worker Status:"
    if wrangler deployments list >/dev/null 2>&1; then
        echo "  Last deployment: $(wrangler deployments list 2>/dev/null | head -1 || echo 'No deployments found')"
    fi
    echo ""

    # Database Status
    log_info "Database Status:"
    for db in "finsavvy-primary" "finsavvy-secondary" "finsavvy-compliance"; do
        echo -n "  $db: "
        if wrangler d1 info "$db" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Connected${NC}"
        else
            echo -e "${RED}❌ Disconnected${NC}"
        fi
    done
    echo ""

    # Storage Status
    log_info "Storage Status:"
    echo -n "  KV Namespaces: "
    if wrangler kv namespace list >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Available${NC}"
    else
        echo -e "${RED}❌ Error${NC}"
    fi

    echo -n "  R2 Buckets: "
    if wrangler r2 bucket list >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Available${NC}"
    else
        echo -e "${RED}❌ Error${NC}"
    fi
    echo ""

    # Services Status
    log_info "Services Status:"
    local health_url="https://$WORKER_NAME.workers.dev/health"
    if curl -sf "$health_url" >/dev/null 2>&1; then
        echo -e "  Worker: ${GREEN}✅ Running${NC}"
    else
        echo -e "  Worker: ${RED}❌ Not Responding${NC}"
    fi
    echo ""
}

cleanup_resources() {
    log_section "Resource Cleanup"
    log_warning "This will remove temporary files and clean up the workspace"
    read -p "Are you sure? (y/N): " confirm

    if [[ $confirm =~ ^[Yy]$ ]]; then
        log_info "Cleaning up temporary files..."
        rm -rf /tmp/endpoint_response.json
        log_success "✅ Temporary files cleaned up"

        log_info "Cleaning up log files..."
        # Add any log cleanup here

        log_success "✅ Cleanup completed"
    else
        log_info "Cleanup cancelled"
    fi
}

generate_report() {
    log_section "Generate System Report"
    local report_file="reports/fintech-suite-report-$(date +%Y%m%d-%H%M%S).txt"
    mkdir -p "$(dirname "$report_file")"

    {
        echo "FinTech Suite - Cloudflare Management Report"
        echo "=========================================="
        echo "Generated: $(date)"
        echo ""
        echo "Worker Information:"
        echo "- Name: $WORKER_NAME"
        echo "- Domain: $DOMAIN"
        echo ""
        echo "System Components:"
        echo "- D1 Databases: 3 (primary, secondary, compliance)"
        echo "- KV Namespaces: 5 (cache, sessions, agent_memory, rate_limits, user_preferences)"
        echo "- R2 Buckets: 4 (documents, evidence, backups, ai_models)"
        echo "- AI Services: Enabled"
        echo "- Vectorize Index: 1 (RAG embeddings)"
        echo ""
        echo "Status: $(curl -sf https://$WORKER_NAME.workers.dev/health >/dev/null 2>&1 && echo "Operational" || echo "Issues detected")"
        echo ""
    } > "$report_file"

    log_success "Report generated: $report_file"
}

# Main menu loop
main_menu() {
    while true; do
        show_menu
        read -r choice

        case $choice in
            1) list_databases ;;
            2) show_database_status ;;
            3) execute_sql ;;
            4) backup_databases ;;
            5) list_kv_namespaces ;;
            6) list_r2_buckets ;;
            7) upload_to_r2 ;;
            8) show_worker_status ;;
            9) view_worker_logs ;;
            10) deploy_worker ;;
            11) test_worker_endpoints ;;
            12) list_secrets ;;
            13) add_secret ;;
            14) show_custom_domains ;;
            15) test_domain_accessibility ;;
            16) health_check_all ;;
            17) performance_test ;;
            18) full_system_status ;;
            19) cleanup_resources ;;
            20) generate_report ;;
            0)
                log_info "Exiting FinTech Suite CLI Manager"
                echo "Thank you for using our management tool! 🚀"
                exit 0
                ;;
            *)
                log_error "Invalid choice. Please enter a number between 0 and 20."
                sleep 2
                ;;
        esac

        echo ""
        read -p "Press Enter to continue..."
    done
}

# Start the application
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main_menu
fi