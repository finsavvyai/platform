package mcp

// toolScan exposes pipeline security scanning to AI agents.
// When an AI agent calls this tool, it scans CI/CD pipeline configs
// for security vulnerabilities and returns findings with risk scores.
func toolScan() Tool {
	return Tool{
		Name:        "pushci_scan",
		Description: "Security scan a CI/CD pipeline configuration file (GitHub Actions, GitLab CI, Bitbucket Pipelines) for vulnerabilities. Detects hardcoded secrets, unpinned dependencies, weak branch protection, overly broad permissions, and missing security checks. Returns structured findings with severity levels (critical/high/medium/low) and a risk score (0-100). Use this when you need to audit pipeline security or identify misconfigurations.",
		InputSchema: objSchema(map[string]any{
			"path": strProp("Absolute path to the pipeline config file (e.g. .github/workflows/test.yml, .gitlab-ci.yml, bitbucket-pipelines.yml). Defaults to auto-detecting in current directory."),
		}, nil),
	}
}
