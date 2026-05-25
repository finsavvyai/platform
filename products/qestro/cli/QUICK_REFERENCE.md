# Qestro CLI - Quick Reference

## New Commands Implemented

### 1. `qestro init` - Project Setup
```bash
qestro init
```
Interactive wizard to initialize a new Qestro project.

**Features:**
- Project name input
- API URL and key validation
- Framework selection (Playwright/Cypress)
- Test directory configuration
- Auto-generates `qestro.config.ts`

---

### 2. `qestro generate` - AI Test Creation
```bash
# Generate from website URL
qestro generate --url https://example.com

# Generate from natural language
qestro generate --description "Test checkout flow"

# Generate from OpenAPI spec
qestro generate --api https://api.example.com/openapi.json

# Interactive mode
qestro generate --interactive

# Options
--framework playwright|cypress    # Default: playwright
--type e2e|api|visual             # Default: e2e
--output ./tests                  # Output directory
```

**Features:**
- Multi-source test generation
- Framework selection
- Test type selection
- Automatic file persistence
- Interactive and CLI modes

---

### 3. `qestro run` - Test Execution
```bash
# Run all tests
qestro run

# Run specific test
qestro run <test-id>

# Run test suite
qestro run --suite smoke-tests

# Parallel execution
qestro run --parallel

# Watch mode
qestro run --watch

# Options
--timeout <ms>        # Default: 60000
--fail-fast          # Stop on first failure
--bail               # Alias for --fail-fast
```

**Features:**
- Real-time progress tracking
- Pass/fail/skip statistics
- Execution time metrics
- Parallel execution support
- Development watch mode

---

### 4. `qestro heal` - Auto Test Repair
```bash
# Get healing suggestions for a run
qestro heal --run-id <run-id>

# Heal specific test
qestro heal --test-id <test-id>

# Interactive approval
qestro heal --run-id <run-id> --interactive

# Auto-apply high-confidence fixes
qestro heal --run-id <run-id> --auto
```

**Features:**
- AI-powered failure analysis
- Confidence scoring
- Interactive approval mode
- Auto-apply for 80%+ confidence fixes
- Detailed change diffs

---

### 5. `qestro status` - Project Health
```bash
# Quick status
qestro status

# Detailed view
qestro status --full

# JSON output
qestro status --json
```

**Shows:**
- Test count and pass rate
- Execution statistics
- Flaky tests (top 5)
- Slowest tests (top 5)
- Last run status

---

## Global Options

Available with all commands:

```bash
qestro [COMMAND] [OPTIONS]

--verbose              # Enable verbose logging
--quiet                # Errors only
--no-color             # Disable colored output
--format json|yaml|table    # Output format
--profile <name>       # Config profile
--region <region>      # AWS region
-h, --help             # Show help
-v, --version          # Show version
```

---

## Typical Workflow

### First Time Setup
```bash
# 1. Initialize project
qestro init

# 2. Generate tests
qestro generate --url https://example.com --framework playwright

# 3. Run tests
qestro run
```

### Regular Testing
```bash
# Run all tests
qestro run

# Check project health
qestro status --full

# Auto-heal failures
qestro heal --run-id run-123 --auto
```

### Development
```bash
# Watch mode - rerun on file changes
qestro run --watch

# Monitor project stats
qestro status
```

### CI/CD Integration
```bash
# Run tests
qestro run --no-color --quiet

# Auto-heal failures
qestro heal --run-id $CI_RUN_ID --auto

# Export results
qestro status --json > report.json
```

---

## Configuration

### Environment Variables
```bash
QESTRO_API_KEY=sk_live_xxxxx         # Required
QESTRO_API_URL=https://api.qestro.io  # Optional
BASE_URL=https://example.com          # Override baseUrl
DEBUG=true                             # Enable debug mode
```

### Config File
Create `qestro.config.ts`:
```typescript
export default {
  projectName: 'My Tests',
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
};
```

See `qestro.config.example.ts` for all available options.

---

## File Structure

### Created Files
```
cli/
├── src/
│   ├── commands/
│   │   ├── generate.ts     (169 lines)  ← AI test generation
│   │   ├── run.ts          (132 lines)  ← Test execution
│   │   ├── heal.ts         (104 lines)  ← Auto-repair
│   │   ├── status.ts       (173 lines)  ← Health dashboard
│   │   └── init.ts         (201 lines)  ← Setup wizard
│   ├── utils/
│   │   └── display.ts      (85 lines)   ← Display utilities
│   └── index.ts            (modified)   ← Command registration
├── README_CLI.md                        ← Full documentation
├── qestro.config.example.ts             ← Config template
├── IMPLEMENTATION_SUMMARY.md            ← Technical details
└── QUICK_REFERENCE.md                   ← This file
```

---

## Commands Summary Table

| Command | Aliases | Purpose | Examples |
|---------|---------|---------|----------|
| `init` | `initialize`, `i` | Project setup | `qestro init` |
| `generate` | `gen`, `g` | AI test creation | `qestro gen --url https://example.com` |
| `run` | `r` | Test execution | `qestro run --parallel` |
| `heal` | `h` | Auto-repair | `qestro heal --run-id run-123 --auto` |
| `status` | `st`, `s` | Health dashboard | `qestro status --full` |

---

## Common Tasks

### Generate tests from a website
```bash
qestro generate --url https://my-app.com --interactive
```

### Run tests with auto-healing
```bash
qestro run
# If failures occur...
qestro heal --auto
```

### Check test health
```bash
qestro status --full
```

### Export metrics for reporting
```bash
qestro status --json > metrics.json
```

### CI/CD Pipeline
```bash
#!/bin/bash
set -e
qestro run --no-color
qestro heal --auto
qestro status --json > report.json
```

---

## Tips & Tricks

### Speed up test runs
```bash
qestro run --parallel --max-workers 8
```

### Development workflow
```bash
# Terminal 1: Watch mode
qestro run --watch

# Terminal 2: Monitor health
watch 'qestro status'
```

### Debug test execution
```bash
qestro run --verbose --timeout 120000
```

### Git pre-commit hook
```bash
#!/bin/sh
# .husky/pre-commit
npx qestro run --fail-fast --quiet
```

---

## File Locations

All new CLI components are in:
- **Commands:** `/sessions/zealous-youthful-mccarthy/mnt/qestro/cli/src/commands/`
- **Utils:** `/sessions/zealous-youthful-mccarthy/mnt/qestro/cli/src/utils/`
- **Docs:** `/sessions/zealous-youthful-mccarthy/mnt/qestro/cli/`

Total: 864 lines of production code + documentation

---

## Support

- Full documentation: `README_CLI.md`
- Technical details: `IMPLEMENTATION_SUMMARY.md`
- Example config: `qestro.config.example.ts`
- Run help: `qestro [command] --help`
