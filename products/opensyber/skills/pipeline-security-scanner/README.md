# Pipeline Security Scanner Skill

AI-powered security scanner for CI/CD pipelines using PipeWarden. Analyzes GitHub Actions, GitLab CI/CD, and Bitbucket Pipelines for vulnerabilities, misconfigurations, and security risks.

## What It Does

This skill integrates OpenSyber agents with PipeWarden's pipeline security analysis engine to:

- Scan CI/CD workflows and pipeline definitions
- Detect security vulnerabilities and misconfigurations
- Identify credential exposure risks
- Analyze dependency security
- Generate AI-powered risk scoring
- Provide remediation recommendations

## Configuration

### Required Parameters

- **connection_name** (string): Name of the CI/CD connection to scan (e.g., "github-prod", "gitlab-main")
- **owner** (string): Repository owner or organization name
- **repo** (string): Repository name

### Optional Parameters

- **scan_type** (enum: 'quick', 'full', 'deep'): Analysis depth
  - `quick` - Fast heuristic-based scan (default)
  - `full` - Heuristic + AI analysis
  - `deep` - Comprehensive analysis with Claude AI

## Environment Variables

- `PIPEWARDEN_API_URL` - PipeWarden API endpoint (default: http://localhost:8080)
- `PIPEWARDEN_API_KEY` - Optional API key for authentication

## Example Output

```json
{
  "success": true,
  "scan_type": "quick",
  "connection": "github-prod",
  "repository": "myorg/myrepo",
  "findings": [
    {
      "id": 1,
      "severity": "critical",
      "category": "secrets",
      "title": "GitHub token exposed in workflow",
      "description": "Found hardcoded GitHub token in .github/workflows/build.yml",
      "remediation": "Use GitHub secrets and GITHUB_TOKEN automatic token",
      "file": ".github/workflows/build.yml",
      "line": 45,
      "confidence": 0.99,
      "status": "open",
      "source": "pipewarden"
    },
    {
      "id": 2,
      "severity": "high",
      "category": "access-control",
      "title": "Overpermissive workflow permissions",
      "description": "Workflow has permissions: write-all",
      "remediation": "Restrict permissions to minimum required (write-contents)",
      "confidence": 0.95,
      "status": "open",
      "source": "pipewarden"
    }
  ],
  "summary": "Found 2 critical security issues in pipeline configuration",
  "risk_score": 78,
  "findings_count": 2,
  "critical_count": 1,
  "high_count": 1,
  "duration_ms": 1245,
  "analyzed_at": "2026-04-10T14:22:33Z"
}
```

## Severity Levels

- **critical** - Immediate threat, requires urgent action
- **high** - Significant security risk, address within days
- **medium** - Moderate concern, should be addressed
- **low** - Minor issue, consider for improvements
- **info** - Informational finding, for awareness

## Integration Examples

### In OpenSyber Workflows

```yaml
tasks:
  - name: "Scan production pipelines"
    skill: pipeline-security-scanner
    config:
      connection_name: github-prod
      owner: mycompany
      repo: main-app
      scan_type: full
```

### Continuous Monitoring

Install this skill on agents that manage CI/CD infrastructure to enable continuous security monitoring of pipeline definitions and configurations.

## Supported Platforms

- GitHub Actions
- GitLab CI/CD
- Bitbucket Pipelines
- Jenkins (via PipeWarden integration)
- Azure DevOps (via PipeWarden integration)

## Permissions

This skill requires:
- Network access to PipeWarden API
- Environment variables for configuration
- Filesystem access for local caching

## Troubleshooting

**Error: "connection_name is required"**
- Ensure the connection_name parameter is set in the skill configuration
- Verify the connection exists in PipeWarden

**Error: "PipeWarden API error: 401"**
- Check PIPEWARDEN_API_KEY environment variable
- Verify API key is valid and has required permissions

**No findings returned**
- Verify repository owner and name are correct
- Check that PipeWarden has access to the specified repository
- Try increasing scan_type to 'full' or 'deep'

## Version

1.0.0 - Initial release

## Author

finsavvyai

---

For more information about PipeWarden, visit: https://pipewarden.dev
