#!/bin/bash

# Cloudflare Queues Setup Script
# Creates all queues for the FinTech suite

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

log_info "Setting up Cloudflare Queues for FinTech suite..."

# Create queues
log_info "Creating service queues..."
wrangler queues create finsavvy-billing-queue || log_warning "Queue finsavvy-billing-queue may already exist"
wrangler queues create finsavvy-compliance-queue || log_warning "Queue finsavvy-compliance-queue may already exist"
wrangler queues create finsavvy-intelligence-queue || log_warning "Queue finsavvy-intelligence-queue may already exist"
wrangler queues create finsavvy-risk-queue || log_warning "Queue finsavvy-risk-queue may already exist"
wrangler queues create finsavvy-notification-queue || log_warning "Queue finsavvy-notification-queue may already exist"

log_success "Cloudflare Queues setup completed!"
log_info "Run 'wrangler queues list' to see all your queues"
log_info "Configure queue settings (dead-letter queues, retention) in Cloudflare dashboard"