# Pipeline Security Scanner Installation Guide

## Overview

The Pipeline Security Scanner skill integrates PipeWarden's AI-powered security analysis engine with OpenSyber agents. This enables automated security scanning of CI/CD pipelines across GitHub Actions, GitLab CI/CD, and Bitbucket Pipelines.

## Installation Steps

### 1. Package the Skill

```bash
cd /path/to/opensyber/skills/pipeline-security-scanner

# Create tarball
tar -czf pipeline-security-scanner.tar.gz manifest.json index.js README.md

# Base64 encode for API submission
cat pipeline-security-scanner.tar.gz | base64 > package-data.txt
```

### 2. Install via OpenSyber Agent

Using the OpenSyber agent CLI or API:

```bash
opensyber skills install pipeline-security-scanner \
  --package-file pipeline-security-scanner.tar.gz
```

Or via API:

```bash
curl -X POST http://localhost:3000/api/v1/skills/install \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "pipeline-security-scanner",
    "version": "1.0.0",
    "packageData": "base64-encoded-tarball"
  }'
```

### 3. Configure Environment

Set required environment variables on the agent or instance:

```bash
export PIPEWARDEN_API_URL="http://localhost:8080"
export PIPEWARDEN_API_KEY="your-api-key-if-required"
```

## File Structure

```
pipeline-security-scanner/
├── manifest.json          # Skill metadata and permissions
├── index.js              # Skill handler implementation
├── README.md             # User documentation
└── INSTALLATION.md       # This file
```

### manifest.json

Defines:
- Skill metadata (name, version, description)
- Entry point (`index.js`)
- Required permissions:
  - Network: Access to PipeWarden API (`localhost:8080`, `127.0.0.1:8080`, `pipewarden-api`)
  - Filesystem: Local data directory (`./data/`)
  - Environment variables: `PIPEWARDEN_API_URL`, `PIPEWARDEN_API_KEY`

### index.js

The main skill handler that:
- Accepts configuration parameters (connection_name, owner, repo, scan_type)
- Calls PipeWarden REST API endpoints
- Maps PipeWarden findings to OpenSyber format
- Returns structured security findings

### README.md

User-facing documentation including:
- Feature overview
- Configuration parameters
- Environment variables
- Example output
- Severity levels
- Troubleshooting guide

## Dependencies

- **PipeWarden** (1.0.0+): Backend security analysis engine
  - REST API listening on `http://localhost:8080`
  - Supports GitHub Actions, GitLab CI/CD, Bitbucket Pipelines
  - Claude AI integration for advanced analysis

- **Node.js**: Skill runtime environment (provided by OpenSyber agent)

## Permissions

This skill requires the following permissions:

| Permission | Type | Reason |
|-----------|------|--------|
| `network: localhost:8080` | Outbound | API calls to PipeWarden backend |
| `filesystem: ./data/` | Read/Write | Cache analysis results locally |
| `env: PIPEWARDEN_API_URL` | Read | PipeWarden endpoint configuration |
| `env: PIPEWARDEN_API_KEY` | Read | Optional API authentication |

## API Compatibility

| Component | Version | Status |
|-----------|---------|--------|
| OpenSyber Agent | 0.2.0+ | Required |
| PipeWarden | 1.0.0+ | Required |
| Node.js | 18+ | Runtime |

## Verification

After installation, verify the skill is working:

```bash
# List installed skills
opensyber skills list

# Check skill manifest
opensyber skills info pipeline-security-scanner

# Run a test scan
opensyber skills execute pipeline-security-scanner \
  --config '{
    "connection_name": "github-test",
    "owner": "myorg",
    "repo": "test-repo",
    "scan_type": "quick"
  }'
```

## Troubleshooting

### Skill fails to load

Check that manifest.json is valid:

```bash
node -e "console.log(JSON.parse(require('fs').readFileSync('manifest.json', 'utf-8')))"
```

### "PipeWarden API error: 401"

Verify PipeWarden is running and accessible:

```bash
curl http://localhost:8080/health
```

Set correct API key if required:

```bash
export PIPEWARDEN_API_KEY="your-token"
```

### "connection_name is required"

The skill config must include all required parameters:

```javascript
config: {
  connection_name: "github-prod",
  owner: "mycompany",
  repo: "main-app"
}
```

## Support

For issues or questions:

1. Check the README.md in this directory
2. Review PipeWarden documentation: https://pipewarden.dev
3. Check OpenSyber logs for skill execution details
4. Verify environment variables are set correctly

## Security Considerations

- API keys are passed via environment variables (not logged)
- Skill runs in isolated worker thread with restricted filesystem access
- Network access limited to configured domains
- All findings data is processed locally (not sent to external services beyond PipeWarden)

## Version History

- **1.0.0** (2026-04-10): Initial release
  - Support for quick and full scans
  - GitHub Actions, GitLab CI/CD, Bitbucket Pipelines
  - AI-powered analysis via Claude
  - SARIF export compatibility
