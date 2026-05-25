#!/bin/bash

# Database Migration Script for Consolidated Architecture
# This script applies the consolidated schema to existing databases

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Navigate to workers directory
cd "$(dirname "$0")/.."

# Check if schema file exists
SCHEMA_FILE="schema/consolidated-schema-simple.sql"
if [ ! -f "$SCHEMA_FILE" ]; then
    log_error "Schema file not found: $SCHEMA_FILE"
    exit 1
fi

log_info "Starting database migration to consolidated architecture..."

# Function to apply schema to a database
apply_schema() {
    local db_name="$1"
    local db_id="$2"
    local description="$3"

    log_info "Applying schema to $description ($db_name)..."

    # Apply schema to remote database
    wrangler d1 execute "$db_name" --file="$SCHEMA_FILE" --remote || {
        log_error "Failed to apply schema to $db_name"
        return 1
    }

    log_success "Schema applied to $description"
}

# Apply consolidated schema to databases
log_info "Applying consolidated schema to databases..."

# Database mappings based on new architecture
apply_schema "finsavvy-primary" "74147f17-042c-4cc3-862b-a2077b381785" "Primary Database (Billing & Intelligence)"
echo ""

apply_schema "finsavvy-secondary" "e86be027-03cd-457d-91a3-4f0b01ab893f" "Secondary Database (Risk & Shared Tables)"
echo ""

apply_schema "finsavvy-compliance" "43db0e30-d750-47fb-99a1-1068b83f0dfb" "Compliance Database"
echo ""

# Verify migrations
log_info "Verifying database migrations..."

verify_database() {
    local db_name="$1"
    local description="$2"

    log_info "Checking tables in $description..."

    # List tables to verify schema was applied
    wrangler d1 execute "$db_name" --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;" || {
        log_warning "Could not verify tables in $db_name"
    }
}

echo ""
verify_database "finsavvy-primary" "Primary Database"
echo ""
verify_database "finsavvy-secondary" "Secondary Database"
echo ""
verify_database "finsavvy-compliance" "Compliance Database"

log_success "Database migration completed!"
echo ""
log_info "Migration Summary:"
echo "- Converted from 8 separate databases to 3 consolidated databases"
echo "- Applied table prefixes for multi-tenancy (billing_us_*, billing_eu_*, etc.)"
echo "- Maintained data isolation with region-based prefixes"
echo "- Reduced database usage from 8/10 to 3/10 account limit"
echo ""
log_info "Architecture Overview:"
echo "DB_PRIMARY (finsavvy-primary):"
echo "  - billing_us_customers, billing_us_invoices, billing_us_payments"
echo "  - billing_eu_customers, billing_eu_invoices, billing_eu_payments"
echo "  - intelligence_us_accounts, intelligence_us_transactions, intelligence_us_analyses"
echo "  - intelligence_eu_accounts, intelligence_eu_transactions, intelligence_eu_analyses"
echo ""
echo "DB_SECONDARY (finsavvy-secondary):"
echo "  - risk_assessments, risk_rules, risk_alerts"
echo "  - organizations, audit_logs, api_keys (shared tables)"
echo ""
echo "DB_COMPLIANCE (finsavvy-compliance):"
echo "  - compliance_us_customers, compliance_us_checks, compliance_us_reports"
echo "  - compliance_eu_customers, compliance_eu_checks"
echo ""
log_info "Next steps:"
echo "1. Test database connections with new schema"
echo "2. Update application code to use new table names"
echo "3. Deploy worker with updated configuration"
echo "4. Monitor performance and optimize queries"