---
name: ll-guard
displayName: Luna Guard
description: Continuous security guardian — SAST, DAST, dependency audit, secret scan, compliance check, threat modeling
version: 1.0.0
category: security
agent: luna-365-security
parameters:
  - name: mode
    type: string
    description: "Mode: full (all checks), quick (critical only), watch (continuous), audit (formal report)"
    required: false
    default: full
mcp_servers:
  - git
  - fetch
  - sequential-thinking
  - memory
  - accessibility-scanner
---

# /guard — Your Security Team in a Command

Continuous security that runs SAST, DAST, dependency audit, secret scanning, and compliance checks. Generates threat models and fix PRs automatically.

## Security Layers

```
/guard full
    │
    ├── LAYER 1: STATIC ANALYSIS (SAST)
    │   ├── SQL injection patterns
    │   ├── XSS vulnerabilities
    │   ├── Command injection
    │   ├── Path traversal
    │   ├── Insecure crypto
    │   ├── Hardcoded secrets
    │   └── OWASP Top 10 patterns
    │
    ├── LAYER 2: DEPENDENCY AUDIT
    │   ├── Known CVEs in all dependencies
    │   ├── Outdated packages with security patches
    │   ├── License compliance (GPL contamination)
    │   ├── Typosquatting detection
    │   └── Supply chain risk scoring
    │
    ├── LAYER 3: SECRET SCANNING
    │   ├── API keys, tokens, passwords in code
    │   ├── .env files committed to git
    │   ├── Secrets in git history (even deleted)
    │   ├── Base64-encoded secrets
    │   └── High-entropy string detection
    │
    ├── LAYER 4: DYNAMIC ANALYSIS (DAST)
    │   ├── Auth bypass attempts
    │   ├── Rate limit verification
    │   ├── CORS misconfiguration
    │   ├── Header security (CSP, HSTS, etc.)
    │   ├── Cookie security flags
    │   └── API endpoint fuzzing
    │
    ├── LAYER 5: THREAT MODEL
    │   ├── Attack surface mapping
    │   ├── Data flow analysis
    │   ├── Trust boundary identification
    │   ├── STRIDE threat classification
    │   └── Risk scoring (likelihood × impact)
    │
    └── LAYER 6: COMPLIANCE
        ├── GDPR data handling check
        ├── SOC 2 control mapping
        ├── WCAG accessibility (via a11y MCP)
        ├── PCI DSS (if payments involved)
        └── HIPAA (if health data involved)
```

## Usage

```bash
/guard                          # Full security scan
/guard quick                    # Critical vulnerabilities only (30 seconds)
/guard watch                    # Continuous — re-scans on file changes
/guard audit                    # Formal audit report for compliance
```

## In Pipes

```bash
/pipe guard quick >> go *5 >> guard full >> launch production
/pipe go *5 >> test >> guard >> if $guard.critical > 0 >> fix >> guard
/pipe @before:guard go *10 >> ship     # Guard runs before every step
```
