# Qestro CLI - Professional Testing Automation

Command-line interface for Qestro, the AI-powered testing automation platform. Generate, run, and manage tests from your terminal across browsers, mobile, and APIs.

## Installation

```bash
npm install -g qestro-cli
```

Or use in your project:

```bash
npm install --save-dev @qestro/cli
npx qestro --help
```

## Quick Start

### 1. Initialize Your Project

```bash
qestro init
```

This creates a `qestro.config.ts` file and sets up your project configuration interactively.

### 2. Generate Tests with AI

```bash
# From a website URL
qestro generate --url https://example.com

# From natural language description
qestro generate --description "Test login flow with email and password"

# From OpenAPI spec
qestro generate --api https://api.example.com/openapi.json

# Interactive mode with prompts
qestro generate --interactive
```

### 3. Run Your Tests

```bash
# Run all tests
qestro run

# Run specific test
qestro run test-abc123

# Run test suite
qestro run --suite smoke-tests

# Parallel execution
qestro run --parallel

# Watch mode (rerun on changes)
qestro run --watch
```

### 4. Auto-Heal Failures

```bash
# Get AI-powered suggestions for failing tests
qestro heal --run-id run-abc123

# Interactive approval mode
qestro heal --run-id run-abc123 --interactive

# Auto-apply high-confidence fixes
qestro heal --run-id run-abc123 --auto
```

### 5. View Project Status

```bash
# Quick status overview
qestro status

# Detailed statistics
qestro status --full

# JSON output
qestro status --json
```

## Commands Reference

### Core Commands

#### `init` - Initialize Project
```bash
qestro init
```

Interactive setup wizard. Creates `qestro.config.ts` with:
- Project configuration
- API authentication
- Framework selection (Playwright/Cypress)
- Test directory structure

#### `generate` - AI Test Generation
```bash
qestro generate [OPTIONS]

Options:
  --url <url>              Website URL to generate tests for
  --description <text>     Natural language test description
  --api <spec>             OpenAPI spec URL or file path
  --output <path>          Output directory (default: ./tests)
  --framework <fw>         playwright|cypress (default: playwright)
  --type <type>            e2e|api|visual (default: e2e)
  -i, --interactive        Interactive mode with prompts
```

**Examples:**
```bash
# Generate e2e tests from website
qestro generate --url https://example.com --framework playwright

# Generate API tests from OpenAPI
qestro generate --api ./openapi.json --type api

# Interactive generation
qestro generate --interactive
```

#### `run` - Execute Tests
```bash
qestro run [test-id] [OPTIONS]

Options:
  [test-id]          Specific test ID to run (optional)
  --suite <name>     Run specific test suite
  --parallel         Execute tests in parallel
  --timeout <ms>     Test timeout (default: 60000)
  -w, --watch        Watch mode - rerun on changes
  --fail-fast        Stop on first failure
  --bail             Stop on first failure (alias)
```

**Examples:**
```bash
# Run all tests
qestro run

# Run specific test
qestro run test-login-flow

# Run suite with options
qestro run --suite smoke-tests --parallel --timeout 30000

# Watch mode for development
qestro run --watch
```

#### `heal` - Auto-Repair Tests
```bash
qestro heal [OPTIONS]

Options:
  --run-id <id>        Heal failures from specific run
  --test-id <id>       Heal specific test
  -i, --interactive    Approve each fix individually
  -a, --auto           Auto-apply high-confidence fixes
```

**Examples:**
```bash
# Get suggestions for failed run
qestro heal --run-id run-abc123

# Interactive approval mode
qestro heal --run-id run-abc123 --interactive

# Auto-apply fixes with 80%+ confidence
qestro heal --run-id run-abc123 --auto
```

#### `status` - Project Health Dashboard
```bash
qestro status [OPTIONS]

Options:
  --full             Show detailed statistics
  --json             JSON output
```

**Examples:**
```bash
# Quick status
qestro status

# Detailed view with flaky tests and slowest tests
qestro status --full

# Machine-readable output
qestro status --json
```

### Global Options

All commands support these options:

```bash
qestro [COMMAND] [OPTIONS]

Global Options:
  -v, --version        Show version number
  -h, --help           Show help
  --verbose            Enable verbose logging
  --quiet              Suppress non-error output
  --no-color           Disable colored output
  --format <fmt>       json|yaml|table (default: table)
  --profile <name>     Use specific config profile
  --region <region>    AWS region (default: us-east-1)
```

**Examples:**
```bash
# Verbose output
qestro run --verbose

# JSON output
qestro status --format json

# Quiet mode (errors only)
qestro run --quiet

# No colors (CI/CD friendly)
qestro run --no-color
```

## Configuration

### Config File Location

The CLI looks for configuration in this order:
1. `qestro.config.ts` (TypeScript)
2. `qestro.config.js` (JavaScript)
3. `.qestrorc` (JSON)
4. Environment variables

### Example Configuration

```typescript
// qestro.config.ts
export default {
  projectName: 'My Test Suite',
  api: {
    url: process.env.QESTRO_API_URL,
    key: process.env.QESTRO_API_KEY,
  },
  framework: 'playwright',
  testDir: './tests',
  baseUrl: 'https://example.com',
  execution: {
    parallel: true,
    maxWorkers: 4,
    timeout: 60000,
  },
  selfHealing: {
    enabled: true,
    autoApplyHighConfidence: false,
  },
};
```

See `qestro.config.example.ts` for full configuration options.

### Environment Variables

```bash
# Required
QESTRO_API_KEY=sk_live_xxx
QESTRO_API_URL=https://api.qestro.io

# Optional
DEBUG=true                    # Enable debug logging
NO_COLOR=true                 # Disable colored output
QESTRO_VERBOSE=true          # Verbose output
BASE_URL=https://example.com # Override baseUrl
```

## Workflows

### Continuous Integration (GitHub Actions)

```yaml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18

      - run: npm ci
      - run: npx qestro run --no-color
        env:
          QESTRO_API_KEY: ${{ secrets.QESTRO_API_KEY }}

      - name: Auto-heal failures
        if: failure()
        run: npx qestro heal --run-id ${{ github.run_id }} --auto
        env:
          QESTRO_API_KEY: ${{ secrets.QESTRO_API_KEY }}

      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: test-results/
```

### Development Workflow

```bash
# Watch mode for development
qestro run --watch

# Generate new tests
qestro generate --description "Test checkout flow"

# Review and auto-heal failures
qestro heal --interactive

# Check project health
qestro status --full
```

### Pre-commit Hook

```bash
#!/bin/bash
# .husky/pre-commit
npx qestro run --fail-fast --quiet
```

## Troubleshooting

### Authentication Issues

```bash
# Verify API key
qestro status

# Re-authenticate
qestro init

# Check environment
echo $QESTRO_API_KEY
```

### Test Generation Issues

```bash
# Verbose generation
qestro generate --url https://example.com --verbose

# Check API connectivity
qestro status --verbose
```

### Execution Problems

```bash
# Debug mode with detailed output
qestro run --verbose

# Increase timeout
qestro run --timeout 120000

# Single-threaded execution
qestro run --parallel false
```

## Advanced Usage

### Custom Test Suites

Define in `qestro.config.ts`:

```typescript
suites: {
  smoke: {
    include: ['tests/smoke/**/*.spec.ts'],
    timeout: 30000,
  },
  regression: {
    include: ['tests/**/*.spec.ts'],
    exclude: ['tests/slow/**'],
  },
}
```

Run with:
```bash
qestro run --suite smoke
```

### Performance Optimization

```bash
# Parallel execution with worker control
qestro run --parallel --max-workers 8

# Increase timeout for slow tests
qestro run --timeout 120000

# Fail fast mode (stop on first failure)
qestro run --fail-fast
```

### Reporting & Analysis

```bash
# Generate reports
qestro run

# View results
qestro status --full

# Export as JSON
qestro status --format json > report.json

# Export as CSV
qestro status --format csv > report.csv
```

## Performance Tips

1. Use `--parallel` for faster execution
2. Enable self-healing to reduce maintenance
3. Use `--fail-fast` in CI/CD to save time
4. Set appropriate `--timeout` values
5. Monitor flaky tests with `qestro status --full`

## Security Best Practices

1. Never commit `QESTRO_API_KEY` to version control
2. Use environment variables or `.env` files
3. Rotate API keys regularly
4. Use `--quiet` mode in CI/CD logs to hide sensitive info
5. Enable audit logging in config

## Support & Documentation

- GitHub: https://github.com/qestro/qestro-cli
- Docs: https://docs.qestro.io/cli
- Issues: https://github.com/qestro/qestro-cli/issues
- Email: support@qestro.io

## License

MIT - See LICENSE file
