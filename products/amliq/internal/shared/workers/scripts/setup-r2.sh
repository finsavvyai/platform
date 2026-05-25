#!/bin/bash

# R2 Storage Setup Script
# Creates all R2 buckets for the FinTech suite

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

log_info "Setting up R2 buckets for FinTech suite..."

# Create R2 buckets
log_info "Creating R2 storage buckets..."
wrangler r2 bucket create finsavvy-documents || log_warning "Bucket finsavvy-documents may already exist"
wrangler r2 bucket create finsavvy-evidence || log_warning "Bucket finsavvy-evidence may already exist"
wrangler r2 bucket create finsavvy-backups || log_warning "Bucket finsavvy-backups may already exist"
wrangler r2 bucket create finsavvy-ai-models || log_warning "Bucket finsavvy-ai-models may already exist"

log_success "R2 buckets setup completed!"
log_info "Run 'wrangler r2 bucket list' to see all your buckets"
log_info "Configure bucket permissions and lifecycle rules in Cloudflare dashboard"