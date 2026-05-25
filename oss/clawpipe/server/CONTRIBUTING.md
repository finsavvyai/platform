# Contributing to FinSavvyAI

Thank you for investing your time in contributing! All contributions — bug reports, feature requests, documentation improvements, and pull requests — are welcome.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Definition of Done](#definition-of-done)
- [Commit Style](#commit-style)
- [Pull Request Process](#pull-request-process)

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold it. Report unacceptable behaviour to security@finsavvyai.com.

## Getting Started

1. **Fork** the repository and clone your fork.
2. Copy `.env.example` → `.env` and fill in at least one provider key.
3. Install dependencies: `pip install -r requirements.txt`
4. Run the test suite: `pytest tests/ -x`
5. Run the doctor: `python -m src.cli.finsavvyai_cli doctor`

## How to Contribute

### Bug Reports

Open a [Bug Report issue](https://github.com/finsavvyai/finsavvyai/issues/new?template=bug_report.md) with:
- OS and Python version
- Steps to reproduce
- Expected vs actual behaviour
- Relevant log output

### Feature Requests

Open a [Feature Request issue](https://github.com/finsavvyai/finsavvyai/issues/new?template=feature_request.md) describing the problem you want to solve and your proposed solution.

### Provider Requests

Want a new LLM provider? Open a [Provider Request](https://github.com/finsavvyai/finsavvyai/issues/new?template=provider_request.md) with the provider's API docs link.

## Development Setup

```bash
# Clone your fork
git clone https://github.com/<you>/finsavvyai.git
cd finsavvyai

# Create a virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install all dependencies (including dev)
pip install -r requirements.txt
pip install -r requirements-dev.txt   # if present

# Copy environment config
cp .env.example .env

# Run tests
pytest tests/ --cov=src --cov-report=term-missing

# Run the gateway locally
python -m src.api.gateway
```

## Definition of Done

Every PR must satisfy:

- [ ] All existing tests pass (`pytest tests/`)
- [ ] New code has unit tests (≥ 95% coverage for changed modules)
- [ ] No new source file exceeds 200 lines
- [ ] Security: no hardcoded secrets, no new critical CVEs
- [ ] `finsavvyai doctor` reports all checks pass
- [ ] New endpoints return OpenAI-compatible response shapes
- [ ] Docs updated if behaviour changes (README, `docs/`, or inline docstrings)
- [ ] CHANGELOG entry added under `[Unreleased]`

## Commit Style

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(gateway): add streaming support for chat completions
fix(health): handle missing provider gracefully
docs(readme): update quickstart install tab
test(compat): add openai sdk compatibility suite
chore(ci): publish to Docker Hub on semver tag
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `perf`, `security`

## Pull Request Process

1. Create a branch: `git checkout -b feat/my-feature`
2. Make your changes following the Definition of Done above.
3. Push and open a PR against `main`.
4. Fill in the PR template (auto-populated).
5. A maintainer will review within 3 business days.
6. Squash-merge after approval.

## Questions?

Open a [GitHub Discussion](https://github.com/finsavvyai/finsavvyai/discussions) — we're happy to help.
