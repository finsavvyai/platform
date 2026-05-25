#!/bin/bash

# QuantumBeam.io Git Repository Setup Script
# This script configures the Git repository with proper branch strategy and hooks

set -e

echo "🚀 Setting up QuantumBeam.io Git repository configuration..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "This directory is not a Git repository"
    exit 1
fi

print_info "Configuring Git repository for QuantumBeam.io..."

# Set up Git configuration for the repository
git config core.autocrlf input
git config core.safecrlf warn
git config pull.rebase false
git config init.defaultBranch main

print_status "Git configuration updated"

# Create Git hooks directory if it doesn't exist
HOOKS_DIR=".git/hooks"
mkdir -p "$HOOKS_DIR"

print_info "Installing Git hooks..."

# Pre-commit hook for code quality
cat > "$HOOKS_DIR/pre-commit" << 'EOF'
#!/bin/bash

# QuantumBeam.io Pre-commit Hook
# Ensures code quality before commits

echo "🔍 Running pre-commit checks..."

# Check for Go files and run go fmt if needed
if command -v go &> /dev/null; then
    # Format Go code
    if [ -n "$(git diff --cached --name-only --diff-filter=d | grep '\.go$')" ]; then
        echo "Formatting Go code..."
        go fmt ./...
        git add -A
    fi

    # Run go vet
    if [ -n "$(git diff --cached --name-only --diff-filter=d | grep '\.go$')" ]; then
        echo "Running go vet..."
        if ! go vet ./...; then
            echo "❌ go vet failed"
            exit 1
        fi
    fi
fi

# Check for basic security issues
echo "Checking for potential security issues..."
if git diff --cached --name-only | grep -E '\.(env|key|pem|p12)$'; then
    echo "❌ Attempting to commit potentially sensitive file"
    echo "   Please ensure .env, .key, .pem, .p12 files are in .gitignore"
    exit 1
fi

# Check for common secret patterns
if git diff --cached --text | grep -E '(password|secret|key|token)\s*[:=]\s*["\'][^"\']+["\']'; then
    echo "❌ Potential secret detected in staged changes"
    echo "   Please review and remove any hardcoded secrets"
    exit 1
fi

echo "✅ Pre-commit checks passed"
EOF

# Pre-push hook to ensure branch protection
cat > "$HOOKS_DIR/pre-push" << 'EOF'
#!/bin/bash

# QuantumBeam.io Pre-push Hook
# Validates branch before push

echo "🚀 Validating branch before push..."

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
PUSH_BRANCH=$1

# Prevent direct push to main
if [ "$CURRENT_BRANCH" = "main" ]; then
    echo "❌ Direct push to main is not allowed"
    echo "   Create a release branch and submit a pull request instead"
    exit 1
fi

# Prevent direct push to develop (unless it's a merge)
if [ "$CURRENT_BRANCH" = "develop" ] && [ "$PUSH_BRANCH" != "develop" ]; then
    echo "❌ Direct push to develop is not allowed"
    echo "   Create a feature branch and submit a pull request instead"
    exit 1
fi

# Validate branch naming for feature branches
if [[ "$CURRENT_BRANCH" =~ ^(feature|bugfix|hotfix|release)/ ]]; then
    # Check if branch follows naming convention
    if [[ ! "$CURRENT_BRANCH" =~ ^(feature|bugfix|hotfix|release)/[A-Z0-9]+-.+$ ]]; then
        echo "⚠️  Branch name should follow convention: type/ticket-number-description"
        echo "   Examples: feature/123-add-quantum-encryption"
        echo "             bugfix/456-fix-memory-leak"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
fi

echo "✅ Branch validation passed"
EOF

# Commit message hook
cat > "$HOOKS_DIR/commit-msg" << 'EOF'
#!/bin/bash

# QuantumBeam.io Commit Message Hook
# Ensures conventional commit format

COMMIT_MSG_FILE=$1
COMMIT_MSG=$(cat "$COMMIT_MSG_FILE")

# Skip if it's a merge commit
if [[ "$COMMIT_MSG" =~ ^Merge ]]; then
    exit 0
fi

# Regex for conventional commits
CONVENTIONAL_COMMIT_REGEX="^(feat|fix|docs|style|refactor|test|chore|perf|ci|build)(\(.+\))?: .{1,72}"

if [[ ! "$COMMIT_MSG" =~ $CONVENTIONAL_COMMIT_REGEX ]]; then
    echo "❌ Invalid commit message format"
    echo ""
    echo "Expected format: type(scope): description"
    echo ""
    echo "Types: feat, fix, docs, style, refactor, test, chore, perf, ci, build"
    echo "Scope: (optional) component affected"
    echo "Description: what the commit does, in imperative mood, max 72 characters"
    echo ""
    echo "Examples:"
    echo "  feat(api): add transaction fraud detection endpoint"
    echo "  fix(quantum): resolve circuit optimization issue"
    echo "  docs(readme): update installation instructions"
    echo "  test(validator): add unit tests for input validation"
    exit 1
fi

# Check if description is too short
DESCRIPTION=$(echo "$COMMIT_MSG" | sed -E 's/^[^:]+: //')
if [ ${#DESCRIPTION} -lt 10 ]; then
    echo "❌ Commit message description is too short"
    echo "   Please provide a more descriptive message (at least 10 characters)"
    exit 1
fi

echo "✅ Commit message validation passed"
EOF

# Make hooks executable
chmod +x "$HOOKS_DIR/pre-commit"
chmod +x "$HOOKS_DIR/pre-push"
chmod +x "$HOOKS_DIR/commit-msg"

print_status "Git hooks installed and made executable"

# Create branch configuration file
cat > .git/branches << 'EOF'
# QuantumBeam.io Branch Configuration
# This file defines the branch structure and permissions

# Main branches
main
develop

# Feature branches pattern
feature/*

# Release branches pattern
release/*

# Hotfix branches pattern
hotfix/*

# Bugfix branches pattern
bugfix/*
EOF

print_status "Branch configuration created"

# Create template files for branch creation
mkdir -p .git/templates/branches

cat > .git/templates/branches/feature << 'EOF'
#!/bin/bash

# Template for creating feature branches
# Usage: git feature <ticket-number> <description>

if [ $# -ne 2 ]; then
    echo "Usage: git feature <ticket-number> <description>"
    echo "Example: git feature 123 add-quantum-encryption"
    exit 1
fi

TICKET=$1
DESCRIPTION=$2
BRANCH_NAME="feature/$TICKET-$DESCRIPTION"

echo "Creating feature branch: $BRANCH_NAME"
git checkout develop
git pull origin develop
git checkout -b "$BRANCH_NAME"

echo "✅ Feature branch '$BRANCH_NAME' created successfully"
echo "   Don't forget to: git push -u origin '$BRANCH_NAME'"
EOF

chmod +x .git/templates/branches/feature

# Set up Git aliases for common operations
git config alias.feature '!bash .git/templates/branches/feature'
git config alias.co 'checkout'
git config alias.br 'branch'
git config alias.ci 'commit'
git config alias.st 'status'
git config alias.unstage 'reset HEAD --'
git config alias.last 'log -1 HEAD'
git config alias.visual '!gitk'
git config alias.graph 'log --oneline --graph --decorate --all'
git config alias.amend 'commit --amend'
git config alias.tree "log --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit"

print_status "Git aliases configured"

# Create .gitattributes file for proper line endings and file handling
cat > .gitattributes << 'EOF'
# QuantumBeam.io Git Attributes

# Handle line endings
* text=auto eol=lf
*.sh text eol=lf
*.yml text eol=lf
*.yaml text eol=lf
*.json text eol=lf
*.md text eol=lf
*.go text eol=lf
*.py text eol=lf
*.js text eol=lf
*.ts text eol=lf
*.tsx text eol=lf
*.css text eol=lf
*.html text eol=lf

# Binary files
*.png binary
*.jpg binary
*.jpeg binary
*.gif binary
*.ico binary
*.pdf binary
*.zip binary
*.tar.gz binary

# Large files - use Git LFS if available
*.sql text diff=sql
*.sql linguist-language=SQL

# Merge drivers
*.json merge=union
*.yml merge=union
*.yaml merge=union

# Export settings
*.sh export-subst
*.md export-subst

# Language detection
*.go linguist-language=Go
*.py linguist-language=Python
*.js linguist-language=JavaScript
*.ts linguist-language=TypeScript
*.tsx linguist-language=TypeScript
*.rs linguist-language=Rust
*.sql linguist-language=SQL
*.dockerfile linguist-language=Dockerfile
Dockerfile* linguist-language=Dockerfile
EOF

print_status "Git attributes configured"

# Verify main and develop branches exist
if ! git show-ref --verify --quiet refs/heads/main; then
    print_warning "main branch not found - this might be expected for new repositories"
fi

if ! git show-ref --verify --quiet refs/heads/develop; then
    print_warning "develop branch not found - creating from main"
    if git show-ref --verify --quiet refs/heads/main; then
        git checkout -b develop main
        print_status "develop branch created from main"
    fi
fi

print_info "Git repository setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Configure a remote repository: git remote add origin <url>"
echo "   2. Push branches: git push -u origin main && git push -u origin develop"
echo "   3. Set up branch protection rules in your GitHub repository settings"
echo "   4. Start developing: git feature 123 your-feature-description"
echo ""
echo "🔗 For detailed branch strategy, see: .github/REPOSITORY_POLICY.md"