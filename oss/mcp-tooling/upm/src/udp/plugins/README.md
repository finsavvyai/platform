# UPM Plugin Ecosystem

The Universal Dependency Platform (UPM) provides a comprehensive ecosystem of plugins for all major package managers and build systems.

## Licensing Model

### Core Plugins (Free & Open Source)
The following plugins are **completely free** and part of the open source UPM core:

| Plugin | Language/Platform | Status |
|--------|------------------|---------|
| Maven Plugin | Java | ✅ Free |
| Gradle Plugin | Java/Kotlin | ✅ Free |
| NPM Plugin | JavaScript/TypeScript | ✅ Free |
| Pip Plugin | Python | ✅ Free |
| Cargo Plugin | Rust | ✅ Free |
| Go Modules Plugin | Go | ✅ Free |

**Features included in free plugins:**
- Dependency scanning and analysis
- Vulnerability detection (OSV, NVD)
- SBOM generation
- Basic policy enforcement
- CLI tools
- Community support

### Premium Plugins (Paid License)
Advanced plugins and integrations require a **UPM Pro or Business license**:

| Plugin/Feature | License Required | Description |
|----------------|------------------|-------------|
| TEDDK Scanner | Pro + AI | AI-powered vulnerability detection |
| Enterprise Analytics | Pro | Dashboard, custom reports, real-time monitoring |
| SSO Integration | Enterprise | SAML/OIDC single sign-on |
| LDAP/AD Sync | Enterprise | Active Directory integration |
| Audit Logs | Enterprise | Complete audit trail |
| Priority Plugin Support | Business | Fast response for plugin issues |

## Free Plugin Overview

| Plugin | Package Manager | Integration Points |
|--------|-----------------|-------------------|
| **Maven** | Maven | pom.xml, lifecycle goals |
| **Gradle** | Gradle | build.gradle, tasks |
| **NPM** | npm/yarn/pnpm | package.json, scripts |
| **Pip** | pip/poetry | requirements.txt, setup.py |
| **Cargo** | Cargo | Cargo.toml, build scripts |
| **Go** | go mod | go.mod, go generate |
| **Composer** | Composer | composer.json, scripts |
| **NuGet** | NuGet/dotnet | .csproj, MSBuild targets |
| **CocoaPods/SPM** | CocoaPods/SPM | Podfile, Package.swift |
| **Pub** | pub | pubspec.yaml, build hooks |
| **Bundler** | Bundler | Gemfile, rake tasks |
| **Hex** | Mix/Hex | mix.exs, mix tasks |

## Quick Start

### Installing Free Plugins

```bash
# JavaScript/TypeScript
npm install -g @upm/npm-plugin

# Python
pip install upm-pip-plugin

# Rust
cargo install upm-cargo-plugin

# Go
go install github.com/upm/go-plugin@latest

# Java (Maven) - Add to pom.xml
<dependency>
    <groupId>com.upm</groupId>
    <artifactId>upm-maven-plugin</artifactId>
    <version>1.0.0</version>
</dependency>
```

### Using the Plugin

```bash
# Initialize UPM in your project
upm init

# Scan for vulnerabilities
upm scan

# Generate SBOM
upm sbom

# Check compliance
upm check
```

## Premium Features

### Dashboard & Analytics (Pro License)
- Interactive dashboard with vulnerability trends
- Dependency graph visualization
- Custom reports and exports
- Real-time monitoring via WebSocket
- Team collaboration features

### AI-Powered Detection (Business License)
- TEDDK intelligent vulnerability scanner
- Predictive analytics
- Smart remediation suggestions
- False positive reduction

### Enterprise Features (Enterprise License)
- SAML SSO integration
- LDAP/Active Directory sync
- Advanced RBAC
- Audit logs and compliance reporting
- On-premise deployment
- Dedicated support

## Plugin Configuration

All plugins use the `upm.yml` configuration format:

```yaml
project: my-app
organization_id: "your-org-id"

dependencies:
  maven:
    - "org.apache.commons:commons-lang3:3.12.0"
  npm:
    - "lodash:4.17.21"
  python:
    - "requests:2.28.1"

security:
  scan_vulnerabilities: true
  fail_on_critical: true
  allowed_licenses: ["MIT", "Apache-2.0"]

# Premium feature - requires license
analytics:
  enabled: false  # Enable with Pro license
  dashboard: false
```

## Licensing

### Obtaining a License

1. **Community Edition**: Free forever, no license needed
2. **Pro License**: Starting at $49/user/month
   - Dashboard & Analytics
   - Custom Reports
   - Priority Support

3. **Business License**: Starting at $149/user/month
   - Everything in Pro
   - AI Agents (TEDDK)
   - SAML SSO
   - API Access

4. **Enterprise License**: Custom pricing
   - Everything in Business
   - LDAP/AD Integration
   - Audit Logs
   - On-premise Deployment
   - Dedicated Support

### License Activation

```bash
# Activate your license
upm license activate YOUR_LICENSE_KEY

# Check license status
upm license status

# List available features
upm license features
```

For licensing information, visit: https://universaldependency.com/pricing

## Support

- **Community (Free)**: GitHub Discussions, Discord
- **Pro/Business**: Email support with 24h SLA
- **Enterprise**: Dedicated support team with custom SLA

## Documentation

- **Getting Started**: https://docs.universaldependency.com
- **API Reference**: https://docs.universaldependency.com/api
- **Plugin Development**: https://docs.universaldependency.com/plugins/dev

## Contributing

We welcome contributions to the free UPM plugins!

See [CONTRIBUTING.md](../../../CONTRIBUTING.md) for guidelines.

## License

Core UPM plugins are licensed under the Apache License 2.0.
Premium features require a commercial license.
