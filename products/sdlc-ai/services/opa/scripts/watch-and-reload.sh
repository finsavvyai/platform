#!/bin/bash

# OPA Policy Watch and Reload Script
# Monitors policy files for changes and triggers OPA reload

set -euo pipefail

# Configuration
OPA_URL="${OPA_URL:-http://localhost:8181}"
POLICIES_DIR="${POLICIES_DIR:-./policies}"
BUNDLE_DIR="${BUNDLE_DIR:-./bundles}"
WATCH_INTERVAL="${WATCH_INTERVAL:-5}"
LOG_LEVEL="${LOG_LEVEL:-info}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    case $level in
        "INFO")
            echo -e "${GREEN}[INFO]${NC} ${timestamp} - $message"
            ;;
        "WARN")
            echo -e "${YELLOW}[WARN]${NC} ${timestamp} - $message"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} ${timestamp} - $message"
            ;;
        "DEBUG")
            if [[ "$LOG_LEVEL" == "debug" ]]; then
                echo -e "${BLUE}[DEBUG]${NC} ${timestamp} - $message"
            fi
            ;;
    esac
}

# Function to check if OPA is healthy
check_opa_health() {
    log "DEBUG" "Checking OPA health at $OPA_URL/health"

    if curl -s -f "$OPA_URL/health" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to calculate file checksum
calculate_checksum() {
    local file=$1
    if [[ -f "$file" ]]; then
        sha256sum "$file" | cut -d' ' -f1
    else
        echo ""
    fi
}

# Function to create policy bundle
create_bundle() {
    log "INFO" "Creating policy bundle..."

    # Create temporary directory
    local temp_dir=$(mktemp -d)
    trap "rm -rf $temp_dir" EXIT

    # Create bundle structure
    mkdir -p "$temp_dir/sdlc"

    # Copy policy files
    find "$POLICIES_DIR" -name "*.rego" -type f | while read -r policy_file; do
        local relative_path=${policy_file#$POLICIES_DIR/}
        local dest_path="$temp_dir/sdlc/$relative_path"

        # Create directory if needed
        mkdir -p "$(dirname "$dest_path")"

        # Copy policy file
        cp "$policy_file" "$dest_path"
        log "DEBUG" "Copied policy: $relative_path"
    done

    # Copy data files
    if [[ -d "$POLICIES_DIR/data" ]]; then
        mkdir -p "$temp_dir/data"
        cp -r "$POLICIES_DIR/data/"* "$temp_dir/data/" 2>/dev/null || true
        log "DEBUG" "Copied data files"
    fi

    # Create manifest
    local manifest=$(cat <<EOF
{
  "revision": $(date +%s),
  "roots": ["sdlc"],
  "metadata": {
    "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "version": "1.0",
    "description": "SDLC.ai Policy Bundle"
  }
}
EOF
)

    echo "$manifest" > "$temp_dir/manifest.json"

    # Create bundle archive
    local bundle_file="$BUNDLE_DIR/sdlc.tar.gz"
    mkdir -p "$BUNDLE_DIR"

    cd "$temp_dir"
    tar -czf "$bundle_file" .
    cd - > /dev/null

    log "INFO" "Bundle created: $bundle_file"

    # Get bundle size
    local bundle_size=$(stat -f%z "$bundle_file" 2>/dev/null || stat -c%s "$bundle_file" 2>/dev/null || echo "unknown")
    log "DEBUG" "Bundle size: $bundle_size bytes"

    echo "$bundle_file"
}

# Function to deploy bundle to OPA
deploy_bundle() {
    local bundle_file=$1

    log "INFO" "Deploying bundle to OPA..."

    # Copy bundle to nginx directory (if exists)
    if [[ -d "./bundles" ]]; then
        cp "$bundle_file" "./bundles/sdlc.tar.gz"
        log "DEBUG" "Bundle copied to nginx directory"
    fi

    # Trigger OPA reload
    log "INFO" "Triggering OPA reload..."

    if curl -s -X POST "$OPA_URL/v1/data" \
        -H "Content-Type: application/json" \
        -d '{}' > /dev/null 2>&1; then
        log "INFO" "OPA reload triggered successfully"
        return 0
    else
        log "ERROR" "Failed to trigger OPA reload"
        return 1
    fi
}

# Function to validate policy syntax
validate_policies() {
    log "DEBUG" "Validating policy syntax..."

    local validation_errors=0

    # Check each policy file
    find "$POLICIES_DIR" -name "*.rego" -type f | while read -r policy_file; do
        # Basic syntax check
        if ! opa check "$policy_file" > /dev/null 2>&1; then
            log "ERROR" "Syntax error in policy: $policy_file"
            opa check "$policy_file" 2>&1 | head -10
            ((validation_errors++))
        else
            log "DEBUG" "Policy syntax OK: $policy_file"
        fi
    done

    return $validation_errors
}

# Function to get current checksums
get_current_checksums() {
    declare -A checksums

    find "$POLICIES_DIR" -name "*.rego" -type f | while read -r policy_file; do
        local checksum=$(calculate_checksum "$policy_file")
        echo "$policy_file:$checksum"
    done
}

# Main watch loop
main() {
    log "INFO" "Starting OPA policy watch and reload service"
    log "INFO" "OPA URL: $OPA_URL"
    log "INFO" "Policies directory: $POLICIES_DIR"
    log "INFO" "Bundle directory: $BUNDLE_DIR"
    log "INFO" "Watch interval: ${WATCH_INTERVAL}s"

    # Check if OPA is running
    if ! check_opa_health; then
        log "ERROR" "OPA is not responding at $OPA_URL"
        log "ERROR" "Please ensure OPA is running before starting this service"
        exit 1
    fi

    log "INFO" "OPA is healthy"

    # Validate policies on startup
    if ! validate_policies; then
        log "ERROR" "Policy validation failed on startup"
        exit 1
    fi

    log "INFO" "Policy validation passed"

    # Create initial bundle
    log "INFO" "Creating initial policy bundle..."
    if ! initial_bundle=$(create_bundle); then
        log "ERROR" "Failed to create initial bundle"
        exit 1
    fi

    # Deploy initial bundle
    if ! deploy_bundle "$initial_bundle"; then
        log "ERROR" "Failed to deploy initial bundle"
        exit 1
    fi

    log "INFO" "Initial bundle deployed successfully"

    # Store current checksums
    declare -A current_checksums
    while IFS=':' read -r file checksum; do
        current_checksums["$file"]="$checksum"
    done < <(get_current_checksums)

    # Watch for changes
    log "INFO" "Watching for policy changes..."

    while true; do
        sleep "$WATCH_INTERVAL"

        # Check for changes
        local changes_detected=false
        declare -A new_checksums

        while IFS=':' read -r file checksum; do
            new_checksums["$file"]="$checksum"

            if [[ -z "${current_checksums[$file]:-}" ]]; then
                log "INFO" "New policy detected: $file"
                changes_detected=true
            elif [[ "${current_checksums[$file]}" != "$checksum" ]]; then
                log "INFO" "Policy changed: $file"
                changes_detected=true
            fi
        done < <(get_current_checksums)

        # Check for deleted files
        for file in "${!current_checksums[@]}"; do
            if [[ -z "${new_checksums[$file]:-}" ]] && [[ -f "$file" ]]; then
                log "INFO" "Policy deleted: $file"
                changes_detected=true
            fi
        done

        # If changes detected, create and deploy new bundle
        if [[ "$changes_detected" == true ]]; then
            log "INFO" "Policy changes detected, updating bundle..."

            # Validate policies
            if ! validate_policies; then
                log "ERROR" "Policy validation failed, skipping update"
                continue
            fi

            # Create new bundle
            if new_bundle=$(create_bundle); then
                # Deploy new bundle
                if deploy_bundle "$new_bundle"; then
                    log "INFO" "Policy bundle updated successfully"
                else
                    log "ERROR" "Failed to deploy updated bundle"
                fi
            else
                log "ERROR" "Failed to create updated bundle"
            fi

            # Update current checksums
            declare -gA current_checksums
            for file in "${!new_checksums[@]}"; do
                current_checksums["$file"]="${new_checksums[$file]}"
            done
        fi

        # Health check
        if ! check_opa_health; then
            log "WARN" "OPA health check failed"
        fi
    done
}

# Handle signals
cleanup() {
    log "INFO" "Shutting down OPA policy watch service..."
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start main function
main "$@"
