# Contributing to SDLC.ai

Thank you for your interest in contributing to SDLC.ai! This document provides guidelines and instructions for contributing.

## 🚀 Quick Start

1. Fork the repository
2. Clone your fork
3. Create a feature branch
4. Make your changes
5. Submit a pull request

## 📋 Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help create a welcoming environment

## 🛠️ Development Setup

### Prerequisites
- Node.js 20+
- Go 1.24+
- Python 3.11+
- Docker (for local testing)

### Installation
```bash
# Clone the repository
git clone https://github.com/finsavvyai/sdlc-platform.git
cd platform

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration
```

## 📝 Pull Request Process

1. **Update documentation** if you're changing functionality
2. **Add tests** for new features
3. **Follow the code style** (use linters)
4. **Write clear commit messages**
5. **Reference related issues**

### Commit Message Format
```
type(scope): brief description

Detailed explanation of changes.

Fixes #123
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## 🧪 Testing

```bash
# Run all tests
npm test

# Test specific service
npm run test:gateway
npm run test:rag

# Lint code
npm run lint
```

## 🏗️ Project Structure

```
/
├── services/          # Backend services (Go, Python, Rust)
├── landing-page/      # Next.js landing page
├── docs/             # Documentation
├── packages/         # Shared packages and SDKs
└── .github/          # GitHub workflows and templates
```

## 🐛 Reporting Bugs

Use the bug report template when creating issues:
- Clear description
- Steps to reproduce
- Expected vs actual behavior
- Environment details

## 💡 Feature Requests

Use the feature request template:
- Clear use case
- Proposed solution
- Alternatives considered

## 🔒 Security Issues

**DO NOT** open public issues for security vulnerabilities.

Email: security@finsavvyai.com

## 📄 License

By contributing, you agree that your contributions will be licensed under AGPL-3.0-or-later (the project's open-source license — see [LICENSE](LICENSE)) and that the project maintainers may relicense your contribution to commercial-license customers under the terms in [COMMERCIAL.md](COMMERCIAL.md). A CLA bot will request your signature on first PR.

## 🙏 Recognition

Contributors will be recognized in:
- CONTRIBUTORS.md file
- Release notes
- Project documentation

## 📞 Questions?

- GitHub Discussions: https://github.com/finsavvyai/sdlc-platform/discussions
- Email: info@finsavvyai.com

Thank you for contributing to SDLC.ai! 🚀
