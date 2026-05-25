#!/bin/bash

# Install pre-commit hooks for QuantumBeam.io

set -e

echo "🚀 Installing pre-commit hooks for QuantumBeam.io..."

# Check if pre-commit is installed
if ! command -v pre-commit &> /dev/null; then
    echo "Installing pre-commit..."
    pip install pre-commit
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required to install pre-commit hooks"
    exit 1
fi

# Install Go tools
echo "Installing Go tools..."
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
go install github.com/securecodewarrior/gosec/v2/cmd/gosec@latest
go install github.com/securecodewarrior/nancy@latest

# Install hadolint for Dockerfile linting
if command -v brew &> /dev/null; then
    echo "Installing hadolint via Homebrew..."
    brew install hadolint
elif command -v docker &> /dev/null; then
    echo "Installing hadolint via Docker..."
    echo "alias hadolint='docker run --rm -i hadolint/hadolint'" >> ~/.bashrc
    echo "alias hadolint='docker run --rm -i hadolint/hadolint'" >> ~/.zshrc
else
    echo "⚠️ Please install hadolint manually: https://github.com/hadolint/hadolint#installation"
fi

# Install shellcheck
if command -v brew &> /dev/null; then
    echo "Installing shellcheck via Homebrew..."
    brew install shellcheck
elif command -v apt-get &> /dev/null; then
    echo "Installing shellcheck via apt-get..."
    sudo apt-get update && sudo apt-get install -y shellcheck
else
    echo "⚠️ Please install shellcheck manually: https://github.com/koalaman/shellcheck#installing"
fi

# Install pre-commit hooks
echo "Installing pre-commit hooks..."
pre-commit install
pre-commit install --hook-type commit-msg

# Initialize secrets baseline
echo "Initializing secrets baseline..."
detect-secrets scan --baseline .secrets.baseline

# Create initial configuration files if they don't exist
if [ ! -f .secrets.baseline ]; then
    echo "Creating .secrets.baseline..."
    detect-secrets scan --baseline .secrets.baseline
fi

echo ""
echo "✅ Pre-commit hooks installed successfully!"
echo ""
echo "📋 What's been set up:"
echo "   • Go formatting (gofmt)"
echo "   • Go linting (golangci-lint)"
echo "   • Go security scanning (gosec)"
echo "   • Dockerfile linting (hadolint)"
echo "   • Shell script linting (shellcheck)"
echo "   • Secrets detection (detect-secrets)"
echo "   • Conventional commit message validation"
echo "   • Unit tests execution"
echo ""
echo "🔧 To run all hooks manually:"
echo "   pre-commit run --all-files"
echo ""
echo "🔧 To run specific hook:"
echo "   pre-commit run gofmt"
echo ""
echo "🔧 To skip hooks (not recommended):"
echo "   git commit --no-verify -m 'message'"
echo ""
echo "📖 For more information, see:"
echo "   • docs/development/git-branching-strategy.md"
echo "   • https://pre-commit.com/"
