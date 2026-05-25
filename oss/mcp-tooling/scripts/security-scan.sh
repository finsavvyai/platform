#!/bin/bash
# MCPOverflow Security Scan Script
# Runs dependency analysis and static code analysis

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

log_info "Starting Security Scan..."

# 1. Frontend & Package Dependency Audit
log_info "Running NPM Audit..."
if command -v npm &> /dev/null; then
    npm audit --audit-level=high || log_warn "NPM Audit found vulnerabilities!"
else
    log_error "npm not found, skipping dependency check"
fi

# 2. Backend Dependency Audit
log_info "Running Go Vulnerability Check..."
if command -v govulncheck &> /dev/null; then
    cd services/api-service && govulncheck ./... || log_warn "Go vulnerabilities found!"
    cd ../..
elif command -v go &> /dev/null; then
    log_info "govulncheck not found, listing modules..."
    cd services/api-service && go list -m all
    cd ../..
else
    log_error "go not found, skipping backend check"
fi

# 3. Secret Scanning (Basic)
log_info "Scanning for potential hardcoded secrets..."
# Exclude git, lock files, builds, and this script
grep -rE "API_KEY|SECRET|PASSWORD|TOKEN" . \
    --exclude-dir={.git,node_modules,dist,build,.next} \
    --exclude={package-lock.json,yarn.lock,go.sum,*.map,*.svg} \
    | grep -vE "process.env|os.Getenv|Example|test" \
    || log_info "No obvious hardcoded secrets found."

# 4. Static Analysis (ESLint Security)
log_info "Checking for ESLint Security Plugins..."
if [ -f "packages/config/eslint-preset.js" ]; then
    log_info "ESLint config found. Ensure 'eslint-plugin-security' is enabled."
else
    log_warn "ESLint config not verified."
fi

log_info "Security Scan Complete."
