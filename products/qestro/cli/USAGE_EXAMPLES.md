# Questro CLI Usage Examples

Comprehensive guide demonstrating real-world usage scenarios of the Questro CLI with AWS-style authentication.

## Table of Contents

- [Quick Start](#quick-start)
- [Authentication](#authentication)
- [Configuration Management](#configuration-management)
- [Project Management](#project-management)
- [Test Recording](#test-recording)
- [Test Execution](#test-execution)
- [Plugin System](#plugin-system)
- [CI/CD Integration](#cicd-integration)
- [Advanced Usage](#advanced-usage)

## Quick Start

### Installation

```bash
# Install globally
npm install -g qestro-cli

# Verify installation
qestro --version

# Show help
qestro --help
```

### First-Time Setup

```bash
# Check current status
qestro auth status

# Authenticate
qestro auth login

# Or use environment variable
export QESTRO_ACCESS_TOKEN=your_token_here

# Test authentication
qestro projects list
```

## Authentication

### AWS-Style Authentication Methods

#### 1. Environment Variables (Recommended for CI/CD)

```bash
# Set access token
export QESTRO_ACCESS_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Set profile
export QESTRO_PROFILE=production

# Set region
export QESTRO_REGION=us-west-2

# Verify authentication
qestro auth status
```

#### 2. Configuration Profiles

```bash
# Create development profile
qestro profiles create development --based-on default

# Switch to development profile
qestro profiles switch development

# Set authentication for profile
qestro auth login --profile development

# List all profiles
qestro profiles list

# Switch back to default
qestro profiles switch default
```

#### 3. Interactive Authentication

```bash
# Interactive login with prompts
qestro auth login --interactive

# Email-based login
qestro auth login --email user@example.com

# Direct token authentication
qestro auth login --token your_token_here
```

#### 4. Configuration-Based Authentication

```bash
# Set token in configuration
qestro config set auth.accessToken your_token_here

# Set token with expiry
qestro config set auth.tokenExpiry $(($(date +%s) + 3600))

# Set profile-specific token
qestro profiles switch production
qestro config set auth.accessToken prod_token_here
```

### Authentication Status and Management

```bash
# Check current authentication status
qestro auth status

# Refresh expired token
qestro auth refresh

# Show current configuration
qestro config show
```

## Configuration Management

### Basic Configuration

```bash
# Show current configuration
qestro config show

# Set default region
qestro config set defaults.region us-west-2

# Set output format
qestro config set defaults.outputFormat json

# Set API timeout
qestro config set api.timeout 60000

# Get specific configuration value
qestro config get defaults.region
```

### Profile Management

```bash
# List all profiles
qestro profiles list

# Create new profile
qestro profiles create staging

# Create profile based on existing one
qestro profiles create production --based-on staging

# Switch to a profile
qestro profiles switch staging

# Delete a profile (can't delete 'default')
qestro profiles delete staging
```

### Advanced Configuration

```bash
# Set global configuration
qestro config set autoCheckUpdates false --global

# Validate current configuration
qestro config validate

# Export configuration
qestro config export backup.json

# Import configuration
qestro config import backup.json

# Show specific profile configuration
qestro config show --profile staging
```

### Environment-Specific Configuration

```bash
# Development profile setup
qestro profiles create development
qestro profiles switch development
qestro config set defaults.region us-east-1
qestro config set defaults.outputFormat json
qestro config set api.baseUrl https://api-dev.qestro.io

# Production profile setup
qestro profiles create production
qestro profiles switch production
qestro config set defaults.region us-west-2
qestro config set defaults.outputFormat table
qestro config set api.baseUrl https://api.qestro.io
qestro config set api.timeout 120000
```

## Project Management

### Listing Projects

```bash
# List all projects (default table format)
qestro projects list

# List in JSON format
qestro projects list --format json

# List in YAML format
qestro projects list --format yaml

# Verbose listing
qestro projects list --verbose
```

### Working with Specific Projects

```bash
# Use specific profile for project operations
QESTRO_PROFILE=staging qestro projects list

# Use environment variables for one-off commands
QESTRO_ACCESS_TOKEN=temp_token qestro projects list

# Use global options
qestro --profile staging --region us-west-2 projects list
```

### Example Output

```bash
$ qestro projects list
📂 Projects
┌─────────────────────┬──────────────┬─────────────┬─────────────┐
│ Name                │ Type         │ Status      │ Last Updated │
├─────────────────────┼──────────────┼─────────────┼─────────────┤
│ mobile-ios-tests    │ iOS          │ Active      │ 2024-01-15  │
│ web-portal-tests    │ Web          │ Active      │ 2024-01-14  │
│ api-integration     │ Backend      │ Maintenance │ 2024-01-13  │
│ e2e-checkout        │ End-to-End   │ Active      │ 2024-01-12  │
└─────────────────────┴──────────────┴─────────────┴─────────────┘
```

## Test Recording

### Recording Management

```bash
# List all recordings
qestro recordings list

# List recordings in JSON format
qestro recordings list --format json

# Filter recordings by project
qestro recordings list --project mobile-ios-tests

# List recent recordings
qestro recordings list --recent 10
```

### Recording Output Formats

```bash
# Table format (default)
qestro recordings list --format table

# JSON format for automation
qestro recordings list --format json > recordings.json

# YAML format for configuration
qestro recordings list --format yaml > recordings.yaml
```

### Example Recording Management

```bash
# Start recording session
qestro recordings start --project mobile-ios-tests --name login-flow

# Stop recording
qestro recordings stop --session-id abc123

# List recordings with details
qestro recordings list --verbose

# Export recording data
qestro recordings export abc123 --format json --output login-flow.json
```

## Test Execution

### Running Tests

```bash
# List all tests
qestro tests list

# Run specific test suite
qestro tests run smoke-tests

# Run tests with specific profile
qestro --profile production tests run regression-suite

# Run tests with custom output format
qestro tests run e2e-tests --format json --output results.json
```

### Test Execution Options

```bash
# Run tests with timeout
qestro tests run performance-tests --timeout 300000

# Run tests in parallel
qestro tests run api-tests --parallel 4

# Run tests with environment variables
QESTRO_TEST_ENVIRONMENT=staging qestro tests run integration-tests

# Verbose test execution
qestro tests run smoke-tests --verbose
```

### Test Results

```bash
# Show test results
qestro tests results --run-id abc123

# Show last test run results
qestro tests results --last

# Export test results
qestro tests results abc123 --format junit --output results.xml
```

## Plugin System

### Plugin Management

```bash
# List installed plugins
qestro plugin list

# Create a new plugin template
qestro plugin create my-custom-plugin

# Plugin will be created in ~/.qestro/plugins/my-custom-plugin/
```

### Creating Custom Plugins

```bash
# Create plugin
qestro plugin create ci-integration

# This creates:
# ~/.qestro/plugins/ci-integration/
# ├── package.json
# ├── index.js
# └── README.md
```

#### Example Plugin Structure

```javascript
// ~/.qestro/plugins/ci-integration/index.js
const chalk = require('chalk');

function generateJunitReport(options) {
  console.log(chalk.blue('🔌 Generating JUnit report...'));
  // Custom implementation
}

function notifySlack(options) {
  console.log(chalk.blue('🔌 Sending Slack notification...'));
  // Custom implementation
}

module.exports = {
  generateJunitReport,
  notifySlack,
  onBeforeTest: () => console.log('Tests starting...'),
  onAfterTest: () => console.log('Tests completed...')
};
```

### Using Plugins

```bash
# Once installed, plugins add new commands
qestro ci-integration generate-junit-report
qestro ci-integration notify-slack --channel #testing

# Plugin hooks are executed automatically
qestro tests run smoke-tests  # Hooks will trigger automatically
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Questro CLI Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install Questro CLI
        run: npm install -g qestro-cli

      - name: Configure CLI
        run: |
          qestro profiles create ci
          qestro profiles switch ci
          qestro config set defaults.region us-east-1
          qestro config set defaults.outputFormat json

      - name: Authenticate
        env:
          QESTRO_ACCESS_TOKEN: ${{ secrets.QESTRO_TOKEN }}
        run: |
          qestro auth status

      - name: Run Tests
        env:
          QESTRO_ACCESS_TOKEN: ${{ secrets.QESTRO_TOKEN }}
        run: |
          qestro tests run smoke-tests --format json --output results.json

      - name: Upload Results
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: results.json
```

### Jenkins Pipeline

```groovy
pipeline {
    agent any

    environment {
        QESTRO_ACCESS_TOKEN = credentials('qestro-token')
        QESTRO_PROFILE = 'jenkins'
    }

    stages {
        stage('Setup') {
            steps {
                sh 'npm install -g qestro-cli'
                sh '''
                    qestro profiles create jenkins || true
                    qestro profiles switch jenkins
                    qestro config set defaults.region us-east-1
                    qestro config set defaults.outputFormat json
                '''
            }
        }

        stage('Test') {
            steps {
                sh '''
                    qestro auth status
                    qestro tests run regression-suite --format json --output results.json
                '''
            }
        }

        stage('Results') {
            steps {
                archiveArtifacts artifacts: 'results.json'
                sh 'cat results.json | jq .'
            }
        }
    }
}
```

### Docker Integration

```dockerfile
FROM node:18-alpine

# Install Questro CLI
RUN npm install -g qestro-cli

# Create configuration directory
RUN mkdir -p /root/.qestro

# Copy configuration
COPY config.json /root/.qestro/config.json

# Set environment variables
ENV QESTRO_PROFILE=docker
ENV QESTRO_REGION=us-east-1

# Entry point
ENTRYPOINT ["qestro"]
CMD ["--help"]
```

```bash
# Build and run Docker image
docker build -t questro-cli .
docker run --rm \
  -e QESTRO_ACCESS_TOKEN=your_token \
  questro-cli tests run smoke-tests
```

## Advanced Usage

### Environment Variable Configuration

```bash
# Complete environment-based configuration
export QESTRO_ACCESS_TOKEN=your_token
export QESTRO_PROFILE=production
export QESTRO_REGION=us-west-2
export QESTRO_OUTPUT_FORMAT=json
export QESTRO_TIMEOUT=60000

# Run command with all environment variables set
qestro projects list
```

### Shell Aliases and Functions

```bash
# Add to ~/.bashrc or ~/.zshrc

# Quick aliases
alias qp='qestro projects'
alias qr='qestro recordings'
alias qt='qestro tests'
alias qc='qestro config'

# Function to switch environments
qestro-env() {
    local env=$1
    case $env in
        dev)
            export QESTRO_PROFILE=development
            export QESTRO_REGION=us-east-1
            ;;
        prod)
            export QESTRO_PROFILE=production
            export QESTRO_REGION=us-west-2
            ;;
        staging)
            export QESTRO_PROFILE=staging
            export QESTRO_REGION=us-east-1
            ;;
        *)
            echo "Unknown environment: $env"
            return 1
            ;;
    esac
    echo "Switched to Questro environment: $env"
}

# Function to run tests with environment setup
qestro-test() {
    local profile=$1
    local test_suite=$2

    qestro profiles switch $profile
    qestro tests run $test_suite --verbose
}
```

### Bash Completion

```bash
# Enable bash completion
eval "$(qestro completion bash)"

# Add to ~/.bashrc for persistence
echo 'eval "$(qestro completion bash)"' >> ~/.bashrc
```

### Scripting and Automation

```bash
#!/bin/bash
# test-all-projects.sh

set -e

echo "🚀 Running tests for all projects..."

# Get list of projects
projects=$(qestro projects list --format json | jq -r '.[].name')

for project in $projects; do
    echo "📱 Testing project: $project"

    # Record test session
    session_id=$(qestro recordings start --project $project --name automated-test)

    # Run tests
    if qestro tests run smoke-tests --project $project; then
        echo "✅ Tests passed for $project"
    else
        echo "❌ Tests failed for $project"
        exit 1
    fi

    # Stop recording
    qestro recordings stop $session_id
done

echo "🎉 All tests completed successfully!"
```

### Monitoring and Logging

```bash
# Enable verbose logging
qestro --verbose projects list

# Quiet mode for scripts
qestro --quiet tests run smoke-tests

# No color for logging
qestro --no-color projects list

# Combine options
qestro --verbose --no-color --format json projects list
```

### Performance Optimization

```bash
# Use specific profile for performance testing
qestro --profile performance tests run load-tests

# Set custom timeout for long-running operations
qestro tests run integration-tests --timeout 600000

# Disable plugins for faster startup
qestro --no-plugins projects list
```

## Troubleshooting

### Common Issues and Solutions

```bash
# Check authentication status
qestro auth status

# Validate configuration
qestro config validate

# Check current profile
qestro config show --profile current

# Reset to default profile
qestro profiles switch default

# Export configuration for debugging
qestro config export debug-config.json

# Test connectivity
qestro --verbose projects list
```

### Getting Help

```bash
# Show general help
qestro --help

# Show command-specific help
qestro projects --help
qestro auth --help

# Show enhanced help
qestro help-enhanced
```

### Error Handling

```bash
# Handle authentication errors
if ! qestro projects list 2>/dev/null; then
    echo "Authentication failed. Please login."
    qestro auth login
    qestro projects list
fi

# Use environment variables for error handling
QESTRO_ACCESS_TOKEN=invalid_token qestro projects list 2>&1 | grep "Unable to locate credentials"
```

This comprehensive guide demonstrates the power and flexibility of the Questro CLI with AWS-style authentication, showing real-world usage scenarios from basic setup to advanced automation and CI/CD integration.