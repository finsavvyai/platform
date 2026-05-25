#!/bin/bash

# Questro AI-Powered Testing Automation Platform
# Release Management Script
#
# Comprehensive release automation with semantic versioning,
# changelog generation, release notes creation, and rollback capabilities.

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$PROJECT_ROOT/logs/release-$(date +%Y%m%d-%H%M%S).log"
CHANGELOG_FILE="$PROJECT_ROOT/CHANGELOG.md"
RELEASE_NOTES_DIR="$PROJECT_ROOT/docs/release-notes"

# Create necessary directories
mkdir -p "$PROJECT_ROOT/logs"
mkdir -p "$RELEASE_NOTES_DIR"

# Version configuration
CURRENT_VERSION=$(node -p "require('$PROJECT_ROOT/package.json').version")
RELEASE_TYPE=""
FORCE_BUMP=false
SKIP_TESTS=false
CREATE_RELEASE=true
PUSH_TO_GITHUB=true

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    case $level in
        "INFO")  echo -e "${GREEN}[INFO]${NC}  $message" ;;
        "WARN")  echo -e "${YELLOW}[WARN]${NC}  $message" ;;
        "ERROR") echo -e "${RED}[ERROR]${NC} $message" ;;
        "DEBUG") echo -e "${BLUE}[DEBUG]${NC} $message" ;;
        "SUCCESS") echo -e "${PURPLE}[SUCCESS]${NC} $message" ;;
        *)       echo -e "${CYAN}[LOG]${NC}   $message" ;;
    esac

    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

# Error handling
error_exit() {
    log "ERROR" "$1"
    log "ERROR" "Release process failed. Check logs at $LOG_FILE"
    exit 1
}

# Success message
success_exit() {
    log "SUCCESS" "Release process completed successfully!"
    log "INFO" "Release logs available at: $LOG_FILE"
    exit 0
}

# Show usage information
show_usage() {
    cat << EOF
Questro Release Manager

Usage: $0 [OPTIONS] COMMAND [ARGS]

Commands:
  major                   Create a major release (1.0.0 -> 2.0.0)
  minor                   Create a minor release (1.0.0 -> 1.1.0)
  patch                   Create a patch release (1.0.0 -> 1.0.1)
  prerelease <type>       Create a prerelease (1.0.0 -> 1.0.1-alpha.1)
  rollback <version>      Rollback to a specific version
  current                 Show current version
  help                    Show this help message

Options:
  -f, --force            Force version bump without confirmation
  -s, --skip-tests       Skip test suite execution
  -r, --no-release       Skip GitHub release creation
  -p, --no-push          Skip pushing to GitHub
  -v, --verbose          Enable verbose output
  -h, --help             Show this help message

Examples:
  $0 patch               # Create patch release with all checks
  $0 minor --force       # Force minor release without confirmation
  $0 prerelease beta     # Create beta prerelease
  $0 rollback 1.2.3      # Rollback to version 1.2.3

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -f|--force)
                FORCE_BUMP=true
                shift
                ;;
            -s|--skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            -r|--no-release)
                CREATE_RELEASE=false
                shift
                ;;
            -p|--no-push)
                PUSH_TO_GITHUB=false
                shift
                ;;
            -v|--verbose)
                set -x
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            major|minor|patch|prerelease|rollback|current|help)
                if [[ "$1" != "help" ]]; then
                    RELEASE_TYPE="$1"
                fi
                shift
                ;;
            *)
                if [[ -n "$RELEASE_TYPE" && "$RELEASE_TYPE" == "prerelease" ]]; then
                    PRERELEASE_TYPE="$1"
                    shift
                elif [[ -n "$RELEASE_TYPE" && "$RELEASE_TYPE" == "rollback" ]]; then
                    ROLLBACK_VERSION="$1"
                    shift
                else
                    error_exit "Unknown argument: $1"
                fi
                ;;
        esac
    done
}

# Validate prerequisites
validate_prerequisites() {
    log "INFO" "Validating release prerequisites..."

    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        error_exit "Not in a git repository"
    fi

    # Check if working directory is clean (unless force is enabled)
    if [[ "$FORCE_BUMP" != "true" ]]; then
        if [[ -n $(git status --porcelain) ]]; then
            error_exit "Working directory is not clean. Commit or stash changes before release."
        fi
    fi

    # Check if we're on the correct branch
    local current_branch=$(git rev-parse --abbrev-ref HEAD)
    if [[ "$current_branch" != "main" && "$current_branch" != "production-deploy" ]]; then
        error_exit "Must be on main or production-deploy branch to create release"
    fi

    # Check if required tools are installed
    local required_tools=("node" "npm" "git" "gh")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            error_exit "Required tool not found: $tool"
        fi
    done

    # Check if GitHub CLI is authenticated
    if ! gh auth status &> /dev/null; then
        error_exit "GitHub CLI not authenticated. Run 'gh auth login'"
    fi

    log "SUCCESS" "Prerequisites validation passed"
}

# Calculate next version
calculate_next_version() {
    local current_version="$1"
    local release_type="$2"
    local prerelease_type="${3:-}"

    # Parse current version
    local major minor patch prerelease
    IFS='.-' read -r major minor patch prerelease <<< "$current_version"

    case "$release_type" in
        "major")
            echo "$((major + 1)).0.0"
            ;;
        "minor")
            echo "${major}.$((minor + 1)).0"
            ;;
        "patch")
            echo "${major}.${minor}.$((patch + 1))"
            ;;
        "prerelease")
            if [[ -n "$prerelease" ]]; then
                if [[ -n "$prerelease_type" ]]; then
                    echo "${major}.${minor}.$((patch + 1))-${prerelease_type}.1"
                else
                    echo "${major}.${minor}.$((patch + 1))-alpha.1"
                fi
            else
                # Increment existing prerelease
                local prerelease_number=$(echo "$prerelease" | grep -o '[0-9]*$' || echo "0")
                local prerelease_name=$(echo "$prerelease" | sed 's/[0-9]*$//')
                echo "${major}.${minor}.${patch}-${prerelease_name}$((prerelease_number + 1))"
            fi
            ;;
        *)
            error_exit "Unknown release type: $release_type"
            ;;
    esac
}

# Run test suite
run_tests() {
    if [[ "$SKIP_TESTS" == "true" ]]; then
        log "WARN" "Skipping test suite execution"
        return 0
    fi

    log "INFO" "Running test suite..."

    cd "$PROJECT_ROOT"

    # Run unit tests
    log "INFO" "Running unit tests..."
    npm run test:unit || error_exit "Unit tests failed"

    # Run integration tests
    log "INFO" "Running integration tests..."
    npm run test:integration || error_exit "Integration tests failed"

    # Run E2E tests
    log "INFO" "Running E2E tests..."
    npm run test:e2e || error_exit "E2E tests failed"

    # Run security tests
    log "INFO" "Running security tests..."
    npm run test:security || error_exit "Security tests failed"

    # Run performance tests
    log "INFO" "Running performance tests..."
    npm run test:performance || error_exit "Performance tests failed"

    log "SUCCESS" "All tests passed"
}

# Generate changelog
generate_changelog() {
    local previous_version="$1"
    local current_version="$2"

    log "INFO" "Generating changelog..."

    # Get commit messages since last release
    local commits
    commits=$(git log --pretty=format:"%h|%s|%an|%ad" --date=short "v$previous_version..HEAD" || echo "")

    if [[ -z "$commits" ]]; then
        log "WARN" "No commits found since last release"
        return 0
    fi

    # Create temporary changelog file
    local temp_changelog="/tmp/changelog-$$.md"

    cat > "$temp_changelog" << EOF
## [$current_version] - $(date +%Y-%m-%d)

### ✨ Features
$(echo "$commits" | grep -i "feat\|feature" | cut -d'|' -f2 | sed 's/^/- /' || echo "No new features")

### 🐛 Bug Fixes
$(echo "$commits" | grep -i "fix\|bugfix" | cut -d'|' -f2 | sed 's/^/- /' || echo "No bug fixes")

### 🔧 Improvements
$(echo "$commits" | grep -i "chore\|refactor\|perf" | cut -d'|' -f2 | sed 's/^/- /' || echo "No improvements")

### 🔒 Security
$(echo "$commits" | grep -i "security\|vulnerability" | cut -d'|' -f2 | sed 's/^/- /' || echo "No security updates")

### 📚 Documentation
$(echo "$commits" | grep -i "docs\|documentation" | cut -d'|' -f2 | sed 's/^/- /' || echo "No documentation updates")

### 🏗️ Infrastructure
$(echo "$commits" | grep -i "ci\|cd\|build\|deploy" | cut -d'|' -f2 | sed 's/^/- /' || echo "No infrastructure changes")

### 🙋 Contributors
$(echo "$commits" | cut -d'|' -f3 | sort -u | sed 's/^/- /' || echo "No contributors")

EOF

    # Update main changelog
    if [[ -f "$CHANGELOG_FILE" ]]; then
        # Insert new release at the top
        sed -i "/# Changelog/r $temp_changelog" "$CHANGELOG_FILE"
    else
        # Create new changelog
        cat > "$CHANGELOG_FILE" << EOF
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

EOF
        cat "$temp_changelog" >> "$CHANGELOG_FILE"
    fi

    rm -f "$temp_changelog"

    log "SUCCESS" "Changelog generated successfully"
}

# Generate release notes
generate_release_notes() {
    local version="$1"
    local previous_version="$2"

    log "INFO" "Generating release notes..."

    local release_notes_file="$RELEASE_NOTES_DIR/v$version.md"

    cat > "$release_notes_file" << EOF
# Questro Platform v$version Release Notes

## 🚀 Overview
Release version $version includes new features, bug fixes, and improvements to the Questro AI-Powered Testing Automation Platform.

## 📋 What's New

### Key Features
$(git log --since="v$previous_version" --pretty=format:"- %s" --grep="feat:" | head -10 || echo "- No major features in this release")

### Bug Fixes
$(git log --since="v$previous_version" --pretty=format:"- %s" --grep="fix:" | head -10 || echo "- No bug fixes in this release")

### Improvements
$(git log --since="v$previous_version" --pretty=format:"- %s" --grep="chore\|refactor\|perf" | head -5 || echo "- No improvements in this release")

## 🛠️ Installation

### Docker
\`\`\`bash
docker pull ghcr.io/qestro/questro:v$version
docker run -p 8000:8000 ghcr.io/qestro/questro:v$version
\`\`\`

### NPM
\`\`\`bash
npm install -g qestro-platform@$version
\`\`\`

### Source
\`\`\`bash
git clone https://github.com/qestro/questro.git
cd questro
git checkout v$version
npm install
npm run build
\`\`\`

## 🔗 Links
- [Documentation](https://docs.qestro.ai/v$version)
- [API Reference](https://api.qestro.ai/v$version/docs)
- [Dashboard](https://app.qestro.ai)
- [GitHub Repository](https://github.com/qestro/questro/tree/v$version)

## 📊 Statistics
- **Commits**: $(git rev-list --count "v$previous_version..v$version" || echo "N/A")
- **Files Changed**: $(git diff --name-only "v$previous_version..v$version" | wc -l || echo "N/A")
- **Contributors**: $(git log --since="v$previous_version" --pretty=format:"%an" | sort -u | wc -l || echo "N/A")

## 🙏 Acknowledgments
Thanks to all contributors who made this release possible!

---

*Release generated on $(date +%Y-%m-%d %H:%M:%S UTC)*
EOF

    log "SUCCESS" "Release notes generated: $release_notes_file"
}

# Create GitHub release
create_github_release() {
    local version="$1"
    local release_notes_file="$RELEASE_NOTES_DIR/v$version.md"

    if [[ "$CREATE_RELEASE" != "true" ]]; then
        log "INFO" "Skipping GitHub release creation"
        return 0
    fi

    log "INFO" "Creating GitHub release..."

    if [[ ! -f "$release_notes_file" ]]; then
        error_exit "Release notes file not found: $release_notes_file"
    fi

    # Create GitHub release
    gh release create "v$version" \
        --title "Questro Platform v$version" \
        --notes-file "$release_notes_file" \
        --latest \
        --generate-notes || error_exit "Failed to create GitHub release"

    log "SUCCESS" "GitHub release created: v$version"
}

# Update package.json version
update_version() {
    local new_version="$1"

    log "INFO" "Updating version to $new_version..."

    cd "$PROJECT_ROOT"
    npm version "$new_version" --no-git-tag-version || error_exit "Failed to update version"

    # Update other package.json files if they exist
    if [[ -f "frontend/package.json" ]]; then
        cd frontend
        npm version "$new_version" --no-git-tag-version || error_exit "Failed to update frontend version"
        cd ..
    fi

    if [[ -f "backend/package.json" ]]; then
        cd backend
        npm version "$new_version" --no-git-tag-version || error_exit "Failed to update backend version"
        cd ..
    fi

    log "SUCCESS" "Version updated to $new_version"
}

# Commit changes and create tag
commit_and_tag() {
    local version="$1"

    if [[ "$PUSH_TO_GITHUB" != "true" ]]; then
        log "INFO" "Skipping commit and tag creation"
        return 0
    fi

    log "INFO" "Committing changes and creating tag..."

    # Add updated files
    git add package.json
    git add frontend/package.json
    git add backend/package.json
    git add CHANGELOG.md
    git add docs/release-notes/

    # Commit changes
    git commit -m "chore(release): bump version to v$version" || error_exit "Failed to commit changes"

    # Create and push tag
    git tag -a "v$version" -m "Release v$version" || error_exit "Failed to create tag"

    log "SUCCESS" "Changes committed and tag created"
}

# Push to GitHub
push_to_github() {
    if [[ "$PUSH_TO_GITHUB" != "true" ]]; then
        log "INFO" "Skipping push to GitHub"
        return 0
    fi

    log "INFO" "Pushing to GitHub..."

    # Push commits and tags
    git push origin main || error_exit "Failed to push commits"
    git push origin "v$version" || error_exit "Failed to push tag"

    log "SUCCESS" "Pushed to GitHub"
}

# Rollback to previous version
rollback() {
    local target_version="$1"

    log "INFO" "Rolling back to version $target_version..."

    # Check if tag exists
    if ! git rev-parse "v$target_version" >/dev/null 2>&1; then
        error_exit "Version v$target_version not found"
    fi

    # Checkout target version
    git checkout "v$target_version" || error_exit "Failed to checkout v$target_version"

    # Create rollback branch
    local rollback_branch="rollback-to-v$target_version-$(date +%Y%m%d-%H%M%S)"
    git checkout -b "$rollback_branch" || error_exit "Failed to create rollback branch"

    # Push rollback branch
    if [[ "$PUSH_TO_GITHUB" == "true" ]]; then
        git push origin "$rollback_branch" || error_exit "Failed to push rollback branch"

        # Create rollback release
        gh release create "v$target_version-rollback" \
            --title "Rollback to v$target_version" \
            --notes "Emergency rollback to v$target_version due to issues with current release." \
            --prerelease || error_exit "Failed to create rollback release"
    fi

    log "SUCCESS" "Rollback to v$target_version completed"
    log "INFO" "Rollback branch: $rollback_branch"
}

# Show current version
show_current_version() {
    echo "Current version: $CURRENT_VERSION"
}

# Main release process
main() {
    log "INFO" "Starting Questro release manager..."
    log "INFO" "Current version: $CURRENT_VERSION"

    # Parse command line arguments
    parse_args "$@"

    # Handle different commands
    case "$RELEASE_TYPE" in
        "major"|"minor"|"patch")
            validate_prerequisites
            run_tests

            local next_version
            next_version=$(calculate_next_version "$CURRENT_VERSION" "$RELEASE_TYPE")

            if [[ "$FORCE_BUMP" != "true" ]]; then
                read -p "Bump version from $CURRENT_VERSION to $next_version? (y/N): " -n 1 -r
                echo
                if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                    log "INFO" "Release cancelled by user"
                    exit 0
                fi
            fi

            update_version "$next_version"
            generate_changelog "$CURRENT_VERSION" "$next_version"
            generate_release_notes "$next_version" "$CURRENT_VERSION"
            commit_and_tag "$next_version"

            if [[ "$PUSH_TO_GITHUB" == "true" ]]; then
                push_to_github
                create_github_release "$next_version" "$CURRENT_VERSION"
            fi

            log "SUCCESS" "Release v$next_version created successfully!"
            ;;

        "prerelease")
            validate_prerequisites
            run_tests

            local next_version
            next_version=$(calculate_next_version "$CURRENT_VERSION" "$RELEASE_TYPE" "$PRERELEASE_TYPE")

            if [[ "$FORCE_BUMP" != "true" ]]; then
                read -p "Create prerelease $next_version? (y/N): " -n 1 -r
                echo
                if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                    log "INFO" "Release cancelled by user"
                    exit 0
                fi
            fi

            update_version "$next_version"
            generate_changelog "$CURRENT_VERSION" "$next_version"
            generate_release_notes "$next_version" "$CURRENT_VERSION"
            commit_and_tag "$next_version"

            if [[ "$PUSH_TO_GITHUB" == "true" ]]; then
                push_to_github
                create_github_release "$next_version" "$CURRENT_VERSION"
            fi

            log "SUCCESS" "Prerelease $next_version created successfully!"
            ;;

        "rollback")
            if [[ -z "$ROLLBACK_VERSION" ]]; then
                error_exit "Rollback version is required"
            fi
            rollback "$ROLLBACK_VERSION"
            ;;

        "current")
            show_current_version
            ;;

        "help"|"")
            show_usage
            ;;

        *)
            error_exit "Unknown command: $RELEASE_TYPE"
            ;;
    esac
}

# Execute main function
main "$@"
