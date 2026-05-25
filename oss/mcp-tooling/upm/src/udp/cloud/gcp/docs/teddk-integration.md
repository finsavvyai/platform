# teddk Integration with UDP GCP Deployment

Complete guide for integrating teddk with your UDP deployment on Google Cloud Platform.

## Table of Contents

1. [Quick Setup](#quick-setup)
2. [Configuration](#configuration)
3. [Usage Examples](#usage-examples)
4. [Advanced Features](#advanced-features)
5. [CI/CD Integration](#cicd-integration)
6. [Troubleshooting](#troubleshooting)

## Quick Setup

### Prerequisites

- UDP deployed on GCP (see deployment guide)
- Python 3.8+ installed locally
- Access to UDP API endpoint

### Automatic Setup

Run the integration script for automatic configuration:

```bash
cd /path/to/UPM/src/udp/cloud/gcp
./scripts/configure-teddk.sh
```

This script will:
- Install teddk CLI
- Configure authentication
- Create sample project
- Test the integration
- Set up helper scripts

### Manual Setup

If you prefer manual configuration:

```bash
# Install teddk
pip install teddk

# Create config directory
mkdir -p ~/.teddk

# Create configuration file
cat > ~/.teddk/config.yaml << EOF
api:
  endpoint: "http://your-udp-endpoint"
  version: "v1"
  timeout: 30

auth:
  type: "bearer"
  token: "your-api-token"

project:
  name: "My Project"
  organization: "default"
EOF
```

## Configuration

### Basic Configuration

The teddk configuration file is located at `~/.teddk/config.yaml`:

```yaml
# API Configuration
api:
  endpoint: "http://your-load-balancer-ip"  # or https://your-domain.com
  version: "v1"
  timeout: 30
  retries: 3

# Authentication
auth:
  type: "bearer"  # or "api_key"
  token: "your-jwt-token"
  # api_key: "your-api-key"  # alternative

# Project Settings
project:
  name: "My UDP Project"
  id: "auto-generated-uuid"
  organization: "default"

# Analysis Configuration
analysis:
  ecosystems:
    - npm
    - pip
    - maven
    - cargo
    - nuget
    - go

  scanning:
    include_dev_dependencies: true
    include_optional_dependencies: false
    max_depth: 10
    timeout_per_package: 30

# Policy Configuration
policies:
  vulnerability:
    fail_on_critical: true
    fail_on_high: false
    fail_on_medium: false
    fail_on_low: false

  license:
    allowed:
      - MIT
      - Apache-2.0
      - BSD-3-Clause
      - ISC
    restricted:
      - GPL-3.0
      - AGPL-3.0
    unknown_allowed: false

# Reporting
reporting:
  format: "json"  # json, yaml, table, csv
  output_file: "udp-report.json"
  include_graphs: true
  include_recommendations: true

# Caching
cache:
  enabled: true
  ttl: 3600  # 1 hour
  directory: "~/.teddk/cache"

# Logging
logging:
  level: "INFO"
  file: "~/.teddk/logs/teddk.log"
```

### Environment-Specific Configuration

Create environment-specific configs:

```bash
# Development environment
cp ~/.teddk/config.yaml ~/.teddk/config-dev.yaml

# Production environment
cp ~/.teddk/config.yaml ~/.teddk/config-prod.yaml

# Use specific config
teddk --config ~/.teddk/config-dev.yaml scan
```

### Authentication Methods

#### Bearer Token (Recommended)

```yaml
auth:
  type: "bearer"
  token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

#### API Key

```yaml
auth:
  type: "api_key"
  api_key: "udp_api_key_123456789"
```

#### Environment Variables

```bash
export UDP_API_TOKEN="your-token"
export UDP_API_ENDPOINT="http://your-endpoint"

# teddk will automatically use these
teddk scan
```

## Usage Examples

### Basic Scanning

```bash
# Scan current directory
teddk scan

# Scan specific file
teddk scan --file package.json

# Scan with specific output format
teddk scan --format json --output results.json
```

### Dependency Analysis

```bash
# Analyze dependency tree
teddk analyze --tree

# Check for outdated dependencies
teddk analyze --outdated

# Find security vulnerabilities
teddk scan --vuln-only
```

### Policy Enforcement

```bash
# Check against policies
teddk policy check

# List available policies
teddk policy list

# Create custom policy
teddk policy create --name "strict-security" --file policy.yaml
```

### Reporting

```bash
# Generate HTML report
teddk report --format html --output report.html

# Generate CSV for spreadsheet analysis
teddk report --format csv --output dependencies.csv

# Generate summary report
teddk report --summary
```

### Advanced Scanning

```bash
# Scan multiple package managers
teddk scan --ecosystems npm,pip,maven

# Include development dependencies
teddk scan --include-dev

# Exclude specific paths
teddk scan --exclude node_modules,vendor

# Set custom timeout
teddk scan --timeout 60
```

## Advanced Features

### Custom Policies

Create a custom policy file `strict-policy.yaml`:

```yaml
name: "Strict Security Policy"
description: "High security standards for production"

vulnerability:
  fail_on_critical: true
  fail_on_high: true
  fail_on_medium: true
  fail_on_low: false
  max_age_days: 30

license:
  allowed:
    - MIT
    - Apache-2.0
    - BSD-3-Clause
  restricted:
    - GPL-3.0
    - AGPL-3.0
    - SSPL-1.0
  unknown_allowed: false

dependency:
  max_age_years: 3
  require_active_maintenance: true
  blocked_packages:
    - "lodash@<4.17.12"
    - "moment@*"  # deprecated

supply_chain:
  require_signature: true
  max_maintainers: 10
  require_2fa: true
```

Use the custom policy:

```bash
teddk policy check --policy strict-policy.yaml
```

### Workflow Integration

Create a workflow configuration:

```yaml
# .teddk/workflows/security-scan.yaml
name: "Security Scan Workflow"
steps:
  - name: "dependency-scan"
    type: "scan"
    config:
      include_dev: false
      timeout: 300

  - name: "vulnerability-check"
    type: "policy"
    config:
      policy: "security-policy.yaml"
      fail_fast: true

  - name: "report-generation"
    type: "report"
    config:
      format: "html"
      output: "security-report.html"

  - name: "notification"
    type: "notify"
    config:
      webhook: "https://hooks.slack.com/your-webhook"
      on_failure: true
```

Run the workflow:

```bash
teddk workflow run security-scan
```

### Integration with UDP Workflows

Use UDP's workflow system for complex dependency analysis:

```bash
# Trigger UDP workflow
teddk workflow trigger --name "dependency-approval" \
  --input "$(teddk scan --format json)"

# Check workflow status
teddk workflow status --id "workflow-123"

# Get workflow results
teddk workflow results --id "workflow-123"
```

## CI/CD Integration

### GitHub Actions

Create `.github/workflows/teddk-scan.yml`:

```yaml
name: Dependency Security Scan

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  security-scan:
    runs-on: ubuntu-latest

    steps:
    - name: Checkout code
      uses: actions/checkout@v3

    - name: Setup Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.9'

    - name: Install teddk
      run: pip install teddk

    - name: Configure teddk
      run: |
        mkdir -p ~/.teddk
        cat > ~/.teddk/config.yaml << EOF
        api:
          endpoint: "${{ secrets.UDP_ENDPOINT }}"
        auth:
          type: "bearer"
          token: "${{ secrets.UDP_TOKEN }}"
        EOF

    - name: Run security scan
      run: teddk scan --format json --output scan-results.json

    - name: Check policies
      run: teddk policy check --fail-on-violation

    - name: Generate report
      run: teddk report --format html --output dependency-report.html

    - name: Upload report
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: dependency-report
        path: dependency-report.html

    - name: Comment on PR
      if: github.event_name == 'pull_request'
      uses: actions/github-script@v6
      with:
        script: |
          const fs = require('fs');
          const results = JSON.parse(fs.readFileSync('scan-results.json', 'utf8'));

          const comment = `
          ## Dependency Security Scan Results

          - **Vulnerabilities Found**: ${results.vulnerabilities.length}
          - **Policy Violations**: ${results.policy_violations.length}
          - **Dependencies Scanned**: ${results.total_dependencies}

          ${results.vulnerabilities.length > 0 ? '⚠️ Security issues found!' : '✅ No security issues detected'}
          `;

          github.rest.issues.createComment({
            issue_number: context.issue.number,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: comment
          });
```

### GitLab CI

Create `.gitlab-ci.yml`:

```yaml
stages:
  - security-scan

dependency-scan:
  stage: security-scan
  image: python:3.9
  before_script:
    - pip install teddk
    - mkdir -p ~/.teddk
    - |
      cat > ~/.teddk/config.yaml << EOF
      api:
        endpoint: "$UDP_ENDPOINT"
      auth:
        type: "bearer"
        token: "$UDP_TOKEN"
      EOF
  script:
    - teddk scan --format json --output scan-results.json
    - teddk policy check
    - teddk report --format html --output dependency-report.html
  artifacts:
    reports:
      junit: scan-results.json
    paths:
      - dependency-report.html
    expire_in: 1 week
  only:
    - branches
```

### Jenkins Pipeline

Create `Jenkinsfile`:

```groovy
pipeline {
    agent any

    environment {
        UDP_ENDPOINT = credentials('udp-endpoint')
        UDP_TOKEN = credentials('udp-token')
    }

    stages {
        stage('Setup') {
            steps {
                sh 'pip install teddk'
                sh '''
                mkdir -p ~/.teddk
                cat > ~/.teddk/config.yaml << EOF
                api:
                  endpoint: "${UDP_ENDPOINT}"
                auth:
                  type: "bearer"
                  token: "${UDP_TOKEN}"
                EOF
                '''
            }
        }

        stage('Dependency Scan') {
            steps {
                sh 'teddk scan --format json --output scan-results.json'
                archiveArtifacts artifacts: 'scan-results.json'
            }
        }

        stage('Policy Check') {
            steps {
                sh 'teddk policy check'
            }
        }

        stage('Generate Report') {
            steps {
                sh 'teddk report --format html --output dependency-report.html'
                publishHTML([
                    allowMissing: false,
                    alwaysLinkToLastBuild: true,
                    keepAll: true,
                    reportDir: '.',
                    reportFiles: 'dependency-report.html',
                    reportName: 'Dependency Report'
                ])
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: 'dependency-report.html'
        }
        failure {
            emailext (
                subject: "Dependency Scan Failed: ${env.JOB_NAME} - ${env.BUILD_NUMBER}",
                body: "The dependency security scan failed. Check the build logs for details.",
                to: "${env.CHANGE_AUTHOR_EMAIL}"
            )
        }
    }
}
```

## Troubleshooting

### Connection Issues

#### Cannot Connect to UDP API

```bash
# Check if UDP is running
kubectl get pods -n udp

# Test API directly
curl http://your-udp-endpoint/health

# Check port forwarding (if using local tunnel)
~/.teddk/start-udp-tunnel.sh
```

#### Authentication Failures

```bash
# Verify token is valid
curl -H "Authorization: Bearer $TOKEN" http://your-udp-endpoint/api/v1/health

# Check token expiration
echo $TOKEN | base64 -d | jq .exp

# Regenerate token if needed
kubectl exec -it deployment/udp-api -n udp -- python -c "
from udp.security.jwt import create_access_token
print(create_access_token({'sub': 'teddk-user'}))
"
```

### Scanning Issues

#### Scan Timeouts

```bash
# Increase timeout
teddk scan --timeout 300

# Use smaller batch sizes
teddk scan --batch-size 10

# Scan specific ecosystems
teddk scan --ecosystems npm
```

#### Permission Denied

```bash
# Check file permissions
ls -la package.json

# Run with appropriate permissions
sudo teddk scan

# Or change file ownership
chown $USER:$USER package.json
```

### Performance Issues

#### Slow Scanning

```bash
# Enable caching
teddk scan --cache

# Use parallel processing
teddk scan --parallel 4

# Exclude large directories
teddk scan --exclude node_modules,vendor,.git
```

#### High Memory Usage

```bash
# Limit memory usage
teddk scan --max-memory 1G

# Use streaming mode
teddk scan --stream

# Process in batches
teddk scan --batch-size 5
```

### Configuration Issues

#### Invalid Configuration

```bash
# Validate configuration
teddk config validate

# Check configuration file
cat ~/.teddk/config.yaml | yaml-lint

# Reset to defaults
teddk config reset
```

#### Missing Dependencies

```bash
# Check teddk installation
teddk version

# Reinstall if needed
pip uninstall teddk
pip install teddk

# Install with all dependencies
pip install 'teddk[all]'
```

### Getting Help

#### Debug Mode

```bash
# Enable debug logging
teddk --debug scan

# Verbose output
teddk -v scan

# Save debug logs
teddk --debug scan 2>&1 | tee debug.log
```

#### Support Resources

```bash
# Get help
teddk help
teddk help scan

# Check documentation
teddk docs

# Report issues
teddk report-issue --include-logs
```

#### Health Check

```bash
# Run health check
teddk ping

# Test all components
teddk diagnose

# Generate support bundle
teddk support-bundle
```

This comprehensive integration guide ensures you can effectively use teddk with your UDP GCP deployment for enterprise-grade dependency management and security scanning.