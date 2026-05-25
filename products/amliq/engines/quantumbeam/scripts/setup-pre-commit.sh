#!/bin/bash

# Setup pre-commit hooks for QuantumBeam.io

set -e

echo "🚀 Setting up pre-commit hooks..."

# Check if pre-commit is installed
if ! command -v pre-commit &> /dev/null; then
    echo "Installing pre-commit..."
    pip install pre-commit
fi

# Install pre-commit hooks
echo "Installing pre-commit hooks..."
pre-commit install

# Install commit-msg hook
echo "Installing commit message hook..."
pre-commit install --hook-type commit-msg

# Create secrets baseline
echo "Creating secrets baseline..."
detect-secrets scan --baseline .secrets.baseline || true

# Install Go tools needed for hooks
echo "Installing Go tools..."
echo "Installing golangci-lint..."
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest

echo "Installing gosec..."
go install github.com/securecodewarrior/gosec/v2/cmd/gosec@latest

echo "Installing goimports..."
go install golang.org/x/tools/cmd/goimports@latest

echo "Installing nancy for dependency security..."
go install github.com/sonatypecommunity/nancy@latest

# Install hadolint for Dockerfile linting
if command -v hadolint &> /dev/null; then
    echo "✅ hadolint already installed"
else
    echo "⚠️  hadolint not found. Install it with:"
    echo "   macOS: brew install hadolint"
    echo "   Ubuntu: snap install hadolint"
    echo "   Or visit: https://github.com/hadolint/hadolint#installation"
fi

# Install shellcheck for shell script linting
if command -v shellcheck &> /dev/null; then
    echo "✅ shellcheck already installed"
else
    echo "⚠️  shellcheck not found. Install it with:"
    echo "   macOS: brew install shellcheck"
    echo "   Ubuntu: sudo apt-get install shellcheck"
    echo "   Or visit: https://github.com/koalaman/shellcheck#installing"
fi

echo ""
echo "✅ Pre-commit hooks setup complete!"
echo ""
echo "To run all hooks manually:"
echo "  pre-commit run --all-files"
echo ""
echo "To skip hooks (not recommended):"
echo "  git commit --no-verify"
echo ""
echo "To update hooks:"
echo "  pre-commit autoupdate"
echo "  pre-commit run --all-files"
