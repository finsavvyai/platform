# UPM User Guide

Complete user guide for the Universal Dependency Platform.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Web Interface](#web-interface)
3. [Command Line Interface](#command-line-interface)
4. [IDE Integration](#ide-integration)
5. [Common Workflows](#common-workflows)
6. [Best Practices](#best-practices)

---

## Getting Started

### What is UPM?

UPM (Universal Dependency Platform) helps you:

- **Scan dependencies** for security vulnerabilities
- **Enforce policies** across your organization
- **Generate SBOMs** for compliance
- **Automate remediation** of vulnerable packages
- **Monitor projects** in real-time

### Quick Start

1. **Sign up** at `https://upm.internal`
2. **Create your first project**
3. **Upload your dependency file** (pom.xml, package.json, etc.)
4. **Review vulnerabilities** and get remediation suggestions

### Supported Ecosystems

| Ecosystem | Manifest Files |
|-----------|---------------|
| Java/Maven | pom.xml |
| JavaScript/npm | package.json, package-lock.json |
| Python/PyPI | requirements.txt, pyproject.toml, setup.py |
| Rust/Cargo | Cargo.toml |
| Go Modules | go.mod |
| PHP/Composer | composer.json |
| .NET/NuGet | .csproj, packages.config |

---

## Web Interface

### Dashboard

The dashboard gives you an overview of:

- **Total projects** scanned
- **Vulnerability summary** by severity
- **Compliance score** across all projects
- **Recent activity** and alerts

### Creating a Project

1. Click **"New Project"**
2. Enter project details:
   - **Name**: My Project
   - **Ecosystem**: Maven
   - **Repository**: https://github.com/org/repo (optional)
3. Click **"Create"**

### Uploading Dependencies

**Option 1: Upload file**
- Click **"Upload"** on project page
- Select your manifest file
- Click **"Analyze"**

**Option 2: Connect repository**
- Enter repository URL
- UPM will automatically detect manifest files
- Choose branches to monitor

### Viewing Results

**Dependency Tree**
- Visual representation of all dependencies
- Direct and transitive dependencies
- Search and filter options

**Vulnerabilities Tab**
- List of all found vulnerabilities
- Color-coded by severity
- CVE details and references
- Affected versions and fixes

**Compliance Tab**
- Policy violations
- Compliance score
- Remediation recommendations

---

## Command Line Interface

### Installation

```bash
# Using pip
pip install upm-cli

# Using Homebrew (macOS)
brew install upm

# Using cargo
cargo install upm-cli
```

### Authentication

```bash
# Login
upm auth login

# This opens a browser for authentication
# Or use token:
upm auth login --token <your-token>
```

### Basic Commands

#### Analyze a Project

```bash
# Analyze current directory
upm analyze

# Analyze specific file
upm analyze --file pom.xml

# Analyze remote repository
upm analyze --repo https://github.com/user/repo
```

#### Scan for Vulnerabilities

```bash
# Scan with defaults
upm scan

# Scan specific project
upm scan --project-id abc-123

# Generate report
upm scan --output report.html
```

#### Generate SBOM

```bash
# CycloneDX format (default)
upm sbom --format cyclonedx --output sbom.json

# SPDX format
upm sbom --format spdx --output sbom.spdx

# Include vulnerabilities
upm sbom --include-vulns
```

#### Validate Policies

```bash
# Validate against all policies
upm validate

# Validate specific policy
upm validate --policy "no-critical-vulns"

# Show details
upm validate --verbose
```

### Configuration

Create `~/.upm/config.yaml`:

```yaml
# API endpoint
api:
  url: https://api.upm.internal
  timeout: 30

# Default settings
defaults:
  ecosystem: maven
  output-format: json

# Policies
policies:
  - no-critical-vulnerabilities
  - license-allowlist
```

---

## IDE Integration

### IntelliJ IDEA Plugin

#### Installation

1. **Settings** → **Plugins**
2. Search **"UPM"**
3. Click **Install**
4. Restart IDE

#### Configuration

1. **Settings** → **Tools** → **UPM**
2. Enter API URL: `https://api.upm.internal`
3. Click **"Authenticate"**
4. Login with your UPM account

#### Features

**Inline Vulnerability Indicators**
- Red underline: Critical/High
- Yellow underline: Medium/Low
- Hover for details

**Tool Window**
- View → Tool Windows → UPM
- See all dependencies with vulnerability status
- Click to navigate to source

**Build Prevention**
- Blocks builds if critical vulnerabilities found
- Configurable threshold
- Emergency override available

**Commands**
- `UPM: Analyze Project` - Run full analysis
- `UPM: Refresh Dependencies` - Update status
- `UPM: Generate SBOM` - Create SBOM file

### VS Code Extension

#### Installation

```bash
# Install from marketplace
code --install-extension upm.upm-vscode

# Or install from file
code --install-extension upm-vscode-1.0.0.vsix
```

#### Configuration

```json
{
  "upm.apiUrl": "https://api.upm.internal",
  "upm.autoScan": true,
  "upm.showNotifications": true,
  "upm.severityThreshold": "medium"
}
```

#### Features

**Problems Panel**
- Vulnerabilities shown as warnings/errors
- Quick-fix suggestions available
- Filter by severity

**Dependency Tree View**
- Explorer: UPM Dependencies
- Expandable tree structure
- Vulnerability icons

**Commands**
- `UPM: Analyze Project` - Run analysis
- `UPM: Scan for Vulnerabilities` - Security scan
- `UPM: Generate SBOM` - Create SBOM
- `UPM: Refresh` - Refresh all data

---

## Common Workflows

### Workflow 1: Onboard a New Project

**For Java/Maven projects:**

```bash
# 1. Create project
upm project create --name my-app --ecosystem maven

# 2. Analyze dependencies
upm analyze --file pom.xml

# 3. Review vulnerabilities
upm scan --project-id my-app

# 4. Check compliance
upm validate --project-id my-app

# 5. Get remediation suggestions
upm remediate --project-id my-app
```

**For npm projects:**

```bash
upm analyze --file package.json
upm scan --ecosystem npm
```

### Workflow 2: Fix Vulnerable Dependencies

```bash
# 1. Scan for vulnerabilities
upm scan

# 2. Get suggestions
upm remediate --suggestions-only

# 3. Apply fixes (interactive)
upm remediate --interactive

# 4. Verify fixes
upm scan
```

### Workflow 3: Generate SBOM for Compliance

```bash
# 1. Generate CycloneDX SBOM
upm sbom --format cyclonedx --output sbom.json

# 2. Include vulnerabilities
upm sbom --include-vulns --output sbom-full.json

# 3. Sign SBOM
upm sbom --sign --key mykey.pem
```

### Workflow 4: Set Up Continuous Monitoring

```bash
# 1. Add GitHub repository
upm repo add https://github.com/org/repo

# 2. Enable monitoring
upm repo monitor --repo org/repo --branches main,develop

# 3. Set up webhooks
upm repo webhook --repo org/repo --url https://upm.internal/hooks

# 4. Configure notifications
upm notifications enable --type slack --webhook https://hooks.slack.com/...
```

### Workflow 5: Policy Enforcement

```bash
# 1. List available policies
upm policy list

# 2. Enable policy
upm policy enable --policy "no-critical-vulns"

# 3. Configure policy
upm policy configure --policy "no-critical-vulns" --allow-override false

# 4. Validate project
upm validate --policy "no-critical-vulns"
```

---

## Best Practices

### 1. Regular Scanning

- **Scan on every commit** - Use CI/CD integration
- **Scheduled scans** - Daily or weekly
- **Scan before releases** - Part of release checklist

### 2. Vulnerability Management

**Prioritize by severity:**
1. **Critical** - Fix within 24 hours
2. **High** - Fix within 1 week
3. **Medium** - Fix within 1 month
4. **Low** - Fix in next major release

### 3. Dependency Hygiene

- **Pin dependency versions** - Use lock files
- **Review new dependencies** - Check before adding
- **Remove unused dependencies** - Regular cleanup
- **Update regularly** - But test thoroughly

### 4. Compliance

- **Generate SBOMs** for each release
- **Document exceptions** - Why certain vulns are accepted
- **Regular audits** - Quarterly reviews
- **Keep policies updated** - Reflect changing requirements

### 5. Team Collaboration

- **Share project access** - Collaborate on fixes
- **Assign owners** - Each project has a maintainer
- **Track progress** - Use UPM dashboards
- **Document decisions** - Comments on vulnerabilities

---

## Tips and Tricks

### Keyboard Shortcuts (Web)

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + K` | Quick search |
| `Ctrl/Cmd + N` | New project |
| `Ctrl/Cmd + S` | Save changes |
| `G + P` | Go to projects |
| `G + D` | Go to dashboard |

### CLI Aliases

```bash
# Add to ~/.bashrc or ~/.zshrc
alias upm-scan='upm scan --output html'
alias upm-sbom='upm sbom --format cyclonedx'
alias upm-fix='upm remediate --interactive'
```

### IDE Tips

**IntelliJ:**
- Enable "Analyze on file save" for automatic updates
- Use "Find Unsafe Dependencies" inspection
- Customize color scheme for vulnerability levels

**VS Code:**
- Add `upm.autoScan: true` for automatic analysis
- Use `upm.severityThreshold` to filter results
- Configure `upm.ignoredPackages` for false positives

---

## Troubleshooting

### Common Issues

**"Project not found"**
- Verify project ID
- Check you have access to the project

**"Authentication failed"**
- Run `upm auth login`
- Check your token hasn't expired

**"No vulnerabilities found" but there should be**
- Check scan completed successfully
- Verify correct ecosystem selected
- Try `upm scan --force`

**"CLI is slow"**
- Increase timeout in config
- Check network connectivity
- Try `upm scan --async` for large projects

### Getting Help

- **Documentation**: https://docs.upm.internal
- **Support**: support@upm.internal
- **Issues**: https://github.com/universaldependency/upm/issues
- **Community**: https://discord.gg/upm

---

## Glossary

| Term | Definition |
|------|------------|
| **SBOM** | Software Bill of Materials - list of all dependencies |
| **CVE** | Common Vulnerabilities and Exposures |
| **CVSS** | Common Vulnerability Scoring System |
| **Ecosystem** | Package management system (Maven, npm, etc.) |
| **Manifest** | File declaring dependencies (pom.xml, package.json) |
| **Transitive dependency** | Dependency of a dependency |
| **Vulnerability** | Security flaw in a dependency |
| **Policy** | Rule for dependency security/compliance |
