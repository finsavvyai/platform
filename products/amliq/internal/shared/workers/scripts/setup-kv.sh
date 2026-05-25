#!/bin/bash

# KV Namespace Setup Script
# Creates all KV namespaces for the FinTech suite

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

log_info "Setting up KV namespaces for FinTech suite..."

# Core KV namespaces
log_info "Creating core KV namespaces..."
wrangler kv namespace create "CACHE_KV" || log_warning "KV namespace CACHE_KV may already exist"
wrangler kv namespace create "SESSIONS_KV" || log_warning "KV namespace SESSIONS_KV may already exist"
wrangler kv namespace create "AGENT_MEMORY_KV" || log_warning "KV namespace AGENT_MEMORY_KV may already exist"
wrangler kv namespace create "RATE_LIMITS_KV" || log_warning "KV namespace RATE_LIMITS_KV may already exist"
wrangler kv namespace create "USER_PREFERENCES_KV" || log_warning "KV namespace USER_PREFERENCES_KV may already exist"

log_success "KV namespaces setup completed!"
log_info "Run 'wrangler kv namespace list' to see all your namespaces and their IDs"
log_info "Update your wrangler.toml with the actual namespace IDs"