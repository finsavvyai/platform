#!/bin/bash

# 🚀 Ultimate Universal Database Manager - Version Management Script
# ================================================================
# This script handles version bumping, changelog generation, building, and publishing
# for the VS Code extension.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
PACKAGE_JSON="package.json"
CHANGELOG="CHANGELOG.md"
EXTENSION_NAME="ultimate-db-manager-vscode"

# Helper functions
print_header() {
    echo -e "${PURPLE}🚀 $1${NC}"
    echo -e "${PURPLE}$(printf '=%.0s' {1..60})${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Get current version from package.json
get_current_version() {
    node -p "require('./package.json').version"
}

# Bump version using npm version
bump_version() {
    local bump_type=$1
    local current_version=$(get_current_version)
    
    print_info "Current version: $current_version"
    print_info "Bumping version: $bump_type"
    
    # Use npm version to bump and create git tag
    npm version $bump_type --no-git-tag-version
    
    local new_version=$(get_current_version)
    print_success "Version bumped to: $new_version"
    echo $new_version
}

# Generate or update changelog
update_changelog() {
    local version=$1
    local date=$(date +"%Y-%m-%d")
    
    if [ ! -f "$CHANGELOG" ]; then
        print_info "Creating new changelog..."
        cat > "$CHANGELOG" << EOF
# Changelog

All notable changes to the Ultimate Universal Database Manager VS Code extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [$version] - $date

### Added
- Initial release of Ultimate Universal Database Manager
- Multi-database support (PostgreSQL, MongoDB, Redis, Oracle)
- AI-powered query assistance and optimization
- Visual database explorer with tree view
- Connection management with secure credential storage
- Query execution with results visualization
- Data export/import capabilities
- Real-time health monitoring
- Performance analytics and optimization suggestions
- Natural language query interface
- Schema diagram generation
- Query history and saved queries
- Integration with desktop GUI applications

### Changed
- N/A

### Deprecated
- N/A

### Removed
- N/A

### Fixed
- N/A

### Security
- Secure credential storage with encryption
- SSL/TLS connection support

EOF
    else
        print_info "Updating existing changelog..."
        # Create a temporary file with the new version entry
        local temp_file=$(mktemp)
        
        # Add new version entry after the [Unreleased] section
        awk -v version="$version" -v date="$date" '
        /^## \[Unreleased\]/ {
            print $0
            print ""
            print "## [" version "] - " date
            print ""
            print "### Added"
            print "- "
            print ""
            print "### Changed"
            print "- "
            print ""
            print "### Fixed"
            print "- "
            print ""
            next
        }
        { print }
        ' "$CHANGELOG" > "$temp_file"
        
        mv "$temp_file" "$CHANGELOG"
    fi
    
    print_success "Changelog updated for version $version"
}

# Build and compile the extension
build_extension() {
    print_header "Building Extension"
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        print_info "Installing dependencies..."
        npm install
    fi
    
    # Compile TypeScript
    print_info "Compiling TypeScript..."
    npm run compile
    
    # Run linting
    print_info "Running linter..."
    if npm run lint; then
        print_success "Linting passed"
    else
        print_warning "Linting found issues, but continuing build..."
    fi
    
    print_success "Extension built successfully"
}

# Package the extension
package_extension() {
    local version=$1
    print_header "Packaging Extension"
    
    print_info "Creating VSIX package..."
    npm run package
    
    local vsix_file="${EXTENSION_NAME}-${version}.vsix"
    if [ -f "$vsix_file" ]; then
        print_success "Extension packaged: $vsix_file"
        return 0
    else
        print_error "Failed to create VSIX package"
        return 1
    fi
}

# Create git commit and tag
create_git_commit() {
    local version=$1
    local commit_message="chore: bump version to $version"
    
    print_header "Git Operations"
    
    # Check if git repo exists
    if [ ! -d ".git" ]; then
        print_warning "Not a git repository. Skipping git operations."
        return 0
    fi
    
    # Check for uncommitted changes (excluding the files we just modified)
    if git diff --quiet HEAD -- . ':!package.json' ':!CHANGELOG.md' ':!package-lock.json'; then
        print_info "Adding version changes to git..."
        git add package.json CHANGELOG.md package-lock.json 2>/dev/null || true
        git commit -m "$commit_message"
        
        print_info "Creating git tag: v$version"
        git tag -a "v$version" -m "Release version $version"
        
        print_success "Git commit and tag created"
        print_info "To push changes: git push && git push --tags"
    else
        print_warning "Uncommitted changes detected. Please commit or stash them first."
        return 1
    fi
}

# Publish to marketplace
publish_extension() {
    print_header "Publishing Extension"
    
    print_info "Publishing to VS Code Marketplace..."
    if npm run publish; then
        print_success "Extension published successfully!"
    else
        print_error "Failed to publish extension"
        return 1
    fi
}

# Show usage information
show_usage() {
    echo -e "${CYAN}Usage: $0 [OPTIONS] <bump_type>${NC}"
    echo ""
    echo -e "${CYAN}Bump Types:${NC}"
    echo "  patch     - Bug fixes (1.0.0 -> 1.0.1)"
    echo "  minor     - New features (1.0.0 -> 1.1.0)"
    echo "  major     - Breaking changes (1.0.0 -> 2.0.0)"
    echo "  prerelease- Pre-release version (1.0.0 -> 1.0.1-0)"
    echo ""
    echo -e "${CYAN}Options:${NC}"
    echo "  --no-build    Skip building the extension"
    echo "  --no-package  Skip packaging the extension"
    echo "  --no-git      Skip git operations"
    echo "  --no-publish  Skip publishing to marketplace"
    echo "  --dry-run     Show what would be done without making changes"
    echo "  --help        Show this help message"
    echo ""
    echo -e "${CYAN}Examples:${NC}"
    echo "  $0 patch                    # Bump patch version and do everything"
    echo "  $0 minor --no-publish       # Bump minor version but don't publish"
    echo "  $0 major --dry-run          # Show what would happen for major bump"
    echo "  $0 prerelease --no-git      # Bump prerelease without git operations"
}

# Main function
main() {
    local bump_type=""
    local skip_build=false
    local skip_package=false
    local skip_git=false
    local skip_publish=false
    local dry_run=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --no-build)
                skip_build=true
                shift
                ;;
            --no-package)
                skip_package=true
                shift
                ;;
            --no-git)
                skip_git=true
                shift
                ;;
            --no-publish)
                skip_publish=true
                shift
                ;;
            --dry-run)
                dry_run=true
                shift
                ;;
            --help)
                show_usage
                exit 0
                ;;
            patch|minor|major|prerelease)
                bump_type=$1
                shift
                ;;
            *)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # Validate bump type
    if [ -z "$bump_type" ]; then
        print_error "Bump type is required"
        show_usage
        exit 1
    fi
    
    # Check if package.json exists
    if [ ! -f "$PACKAGE_JSON" ]; then
        print_error "package.json not found in current directory"
        exit 1
    fi
    
    print_header "Ultimate Universal Database Manager - Version Manager"
    
    if [ "$dry_run" = true ]; then
        print_warning "DRY RUN MODE - No changes will be made"
        local current_version=$(get_current_version)
        print_info "Current version: $current_version"
        print_info "Would bump version: $bump_type"
        print_info "Would update changelog"
        [ "$skip_build" = false ] && print_info "Would build extension"
        [ "$skip_package" = false ] && print_info "Would package extension"
        [ "$skip_git" = false ] && print_info "Would create git commit and tag"
        [ "$skip_publish" = false ] && print_info "Would publish to marketplace"
        exit 0
    fi
    
    # Execute the version management workflow
    local new_version=$(bump_version $bump_type)
    update_changelog $new_version
    
    if [ "$skip_build" = false ]; then
        build_extension
    fi
    
    if [ "$skip_package" = false ]; then
        package_extension $new_version
    fi
    
    if [ "$skip_git" = false ]; then
        create_git_commit $new_version
    fi
    
    if [ "$skip_publish" = false ]; then
        print_info "Ready to publish to marketplace..."
        read -p "Do you want to publish now? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            publish_extension
        else
            print_info "Skipping publish. Run 'npm run publish' when ready."
        fi
    fi
    
    print_header "Version Management Complete"
    print_success "Version $new_version is ready!"
    echo ""
    print_info "Next steps:"
    echo "  📦 VSIX file: ${EXTENSION_NAME}-${new_version}.vsix"
    echo "  🔧 Install locally: code --install-extension ${EXTENSION_NAME}-${new_version}.vsix"
    [ "$skip_git" = false ] && echo "  📤 Push changes: git push && git push --tags"
    [ "$skip_publish" = true ] && echo "  🚀 Publish: npm run publish"
}

# Run main function with all arguments
main "$@"
