#!/bin/bash

# D1 Database Setup Script
# Creates all D1 databases for the FinTech suite

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

# Navigate to workers directory
cd "$(dirname "$0")/.."

log_info "Setting up D1 databases for FinTech suite..."

# Billing databases
log_info "Creating billing databases..."
wrangler d1 create finsavvy-billing-us || log_warning "Database finsavvy-billing-us may already exist"
wrangler d1 create finsavvy-billing-eu || log_warning "Database finsavvy-billing-eu may already exist"

# Compliance databases
log_info "Creating compliance databases..."
wrangler d1 create finsavvy-compliance-us || log_warning "Database finsavvy-compliance-us may already exist"
wrangler d1 create finsavvy-compliance-eu || log_warning "Database finsavvy-compliance-eu may already exist"

# Intelligence databases
log_info "Creating intelligence databases..."
wrangler d1 create finsavvy-intelligence-us || log_warning "Database finsavvy-intelligence-us may already exist"
wrangler d1 create finsavvy-intelligence-eu || log_warning "Database finsavvy-intelligence-eu may already exist"

# Risk databases
log_info "Creating risk databases..."
wrangler d1 create finsavvy-risk-us || log_warning "Database finsavvy-risk-us may already exist"
wrangler d1 create finsavvy-risk-eu || log_warning "Database finsavvy-risk-eu may already exist"

log_success "D1 databases setup completed!"
log_info "Run 'wrangler d1 list' to see all your databases and their IDs"