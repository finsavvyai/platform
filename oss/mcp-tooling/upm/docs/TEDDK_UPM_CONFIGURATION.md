# UPM Configuration for TEDDK Project

This document describes the UPM configuration for the TEDDK Java Maven project.

## Configuration File: `udp.yaml`

Place this file in the root of your TEDDK project:

```yaml
# UPM Configuration for TEDDK Project
# Universal Dependency Platform - Dependency Management & Security Scanning

project:
  name: "TEDDK"
  type: "maven"
  description: "TEDDK - Target Java Maven Project for UPM Integration"
  version: "1.0.0"

# Ecosystem-specific settings
ecosystem:
  type: "maven"
  pom_file: "pom.xml"
  parent_pom_search: true
  transitive_dependencies: true

# Analysis settings
analysis:
  enabled: true
  depth: 3  # How deep to analyze transitive dependencies
  include_test_dependencies: false
  include_optional_dependencies: true

# Security scanning settings
security:
  enabled: true
  sources:
    - "osv"      # Open Source Vulnerabilities
    - "nvd"      # National Vulnerability Database
    - "ghsa"     # GitHub Security Advisories
  severity_threshold: "medium"  # low, medium, high, critical

# Policy enforcement
policies:
  enabled: true
  policy_set: "teddk_default"

# Policy definitions for TEDDK
policy_sets:
  teddk_default:
    description: "Default security policies for TEDDK project"
    policies:
      - name: "no_critical_vulnerabilities"
        description: "Block dependencies with critical CVEs"
        enabled: true
        action: "block"

      - name: "block_log4shell"
        description: "Block Log4j versions vulnerable to Log4Shell"
        enabled: true
        action: "block"
        rules:
          - group_id: "org.apache.logging.log4j"
            version_range: "<2.17.1"

      - name: "no_unmaintained_packages"
        description: "Block dependencies unmaintained for >2 years"
        enabled: true
        action: "warn"

      - name: "require_sbom"
        description: "Require SBOM for all dependencies"
        enabled: true
        action: "audit"

      - name: "license_compliance"
        description: "Check license compliance"
        enabled: true
        allowed_licenses:
          - "Apache-2.0"
          - "MIT"
          - "BSD-3-Clause"
          - "LGPL-2.1"
          - "LGPL-3.0"
        action: "warn"

# Remediation settings
remediation:
  enabled: true
  auto_suggest: true
  check_breaking_changes: true

# SBOM generation
sbom:
  enabled: true
  format: "cyclonedx"  # cyclonedx, spdx
  include_licenses: true
  include_vulnerabilities: true

# Bridge configuration (for Python-Java interop)
bridge:
  type: "py4j"
  enabled: true
  port: 25333
  host: "127.0.0.1"
  auto_start: false

# IDE Integration
ide:
  intellij:
    enabled: true
    show_annotations: true
    inline_warnings: true
    tool_window: true

  vscode:
    enabled: true
    diagnostics: true
    tree_view: true

# Reporting
reports:
  output_dir: "./upm-reports"
  formats:
    - "json"
    - "html"
    - "markdown"

# Notifications
notifications:
  enabled: false
  webhook_url: ""
  slack_webhook: ""

# Exclusions
exclusions:
  dependencies:
    - group_id: "org.slf4j"
      artifact_id: "slf4j-api"
      reason: "Logging framework, managed by Spring"

  vulnerabilities:
    - cve_id: "CVE-2021-44228"
      reason: "Addressed by policy, not direct dependency"
```

## Quick Start Commands

```bash
# Initialize UPM for TEDDK project
cd /path/to/teddk
upm init

# Analyze dependencies
upm analyze

# Scan for vulnerabilities
upm scan

# Generate SBOM
upm sbom --format cyclonedx

# Validate against policies
upm validate

# Generate remediation suggestions
upm remediate

# Start the Py4J bridge for Python-Java interop
upm bridge start
```

## Maven Integration

Add to your `pom.xml`:

```xml
<plugin>
    <groupId>com.upm</groupId>
    <artifactId>upm-maven-plugin</artifactId>
    <version>1.0.0</version>
    <executions>
        <execution>
            <phase>validate</phase>
            <goals>
                <goal>check</goal>
            </goals>
        </execution>
    </executions>
    <configuration>
        <policySet>teddk_default</policySet>
        <failOnViolation>true</failOnViolation>
    </configuration>
</plugin>
```

## Gradle Integration (if applicable)

```groovy
plugins {
    id 'com.upm.gradle' version '1.0.0'
}

upm {
    policySet = 'teddk_default'
    failOnViolation = true
}
```

## IDE Plugin Configuration

### IntelliJ IDEA

1. Install UPM Plugin from JetBrains Marketplace
2. Configure: Settings → Tools → UPM
3. Point to your UPM server: `http://localhost:8040`

### VS Code

1. Install UPM Extension from VS Code Marketplace
2. Configure in `settings.json`:

```json
{
  "upm.serverUrl": "http://localhost:8040",
  "upm.autoScan": true,
  "upm.showInlineWarnings": true
}
```

## CI/CD Integration

### GitHub Actions

```yaml
name: UPM Security Scan

on: [push, pull_request]

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup UPM
        run: |
          curl -sSL https://get.upm.dev | sh
      - name: Analyze Dependencies
        run: upm analyze --output-report
      - name: Upload Reports
        uses: actions/upload-artifact@v3
        with:
          name: upm-reports
          path: upm-reports/
```

## Policy Violation Handling

| Severity | Action | Description |
|----------|--------|-------------|
| Critical | Block | Fails build, must fix |
| High | Warn | Warning in logs, allow override |
| Medium | Audit | Log only, track metrics |
| Low | Info | Informational |

## Bridge Usage

The Py4J bridge allows TEDDK to call UPM's Python analysis capabilities:

```java
import py4j.Gateway;

// Connect to UPM bridge
Gateway gateway = new Gateway("localhost", 25333);
UPMAnalyzer analyzer = new UPMEntryPoint(gateway);

// Analyze dependencies
AnalysisResult result = analyzer.analyzePom("./pom.xml", true);

// Check for vulnerabilities
List<Vulnerability> vulns = analyzer.checkVulnerabilities(dep);
```

## Troubleshooting

### Bridge not starting
```bash
# Check if port is available
lsof -i :25333

# Check UPM server status
curl http://localhost:8040/health
```

### Analysis taking too long
Reduce analysis depth in `udp.yaml`:
```yaml
analysis:
  depth: 2  # Reduce from 3
```

### False positives
Add exclusions to `udp.yaml`:
```yaml
exclusions:
  vulnerabilities:
    - cve_id: "CVE-XXXX-XXXX"
      reason: "False positive - not exploitable in our context"
```
