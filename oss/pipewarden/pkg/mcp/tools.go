package mcp

import "encoding/json"

// toolRegistry defines all available MCP tools for AI agents.
var toolRegistry = []Tool{
	{
		Name:        "pipewarden_scan",
		Description: "Run security scan on a pipeline configuration or YAML content",
		InputSchema: json.RawMessage(`{
			"type": "object",
			"properties": {
				"connection_name": {"type": "string", "description": "CI/CD connection name (github, gitlab, bitbucket, etc)"},
				"run_id": {"type": "string", "description": "Pipeline run ID to analyze"},
				"analysis_type": {"type": "string", "enum": ["heuristic", "claude", "dlp"], "description": "Type of analysis to run"}
			},
			"required": ["connection_name", "run_id"]
		}`),
	},
	{
		Name:        "pipewarden_findings",
		Description: "List security findings with optional filters by severity, category, or connection",
		InputSchema: json.RawMessage(`{
			"type": "object",
			"properties": {
				"connection_name": {"type": "string", "description": "Filter by connection name"},
				"severity": {"type": "string", "enum": ["critical", "high", "medium", "low", "info"], "description": "Filter by severity"},
				"category": {"type": "string", "description": "Filter by category (injection, secrets, auth, etc)"},
				"status": {"type": "string", "enum": ["open", "acknowledged", "resolved"], "description": "Filter by status"},
				"limit": {"type": "integer", "minimum": 1, "maximum": 100, "description": "Max results (default: 20)"}
			}
		}`),
	},
	{
		Name:        "pipewarden_connections",
		Description: "List or test CI/CD connections (GitHub, GitLab, Bitbucket, Jenkins, Azure, CircleCI)",
		InputSchema: json.RawMessage(`{
			"type": "object",
			"properties": {
				"action": {"type": "string", "enum": ["list", "test"], "description": "Action to perform"},
				"connection_name": {"type": "string", "description": "Name of connection to test"}
			},
			"required": ["action"]
		}`),
	},
	{
		Name:        "pipewarden_dlp_scan",
		Description: "Scan content for secrets, PII, and sensitive data (AWS keys, GitHub tokens, SSH keys, etc)",
		InputSchema: json.RawMessage(`{
			"type": "object",
			"properties": {
				"content": {"type": "string", "description": "Content to scan for secrets/PII"},
				"redact": {"type": "boolean", "description": "Redact found secrets in output (default: true)"}
			},
			"required": ["content"]
		}`),
	},
	{
		Name:        "pipewarden_policy_check",
		Description: "Evaluate OPA-style policies against a pipeline run",
		InputSchema: json.RawMessage(`{
			"type": "object",
			"properties": {
				"connection_name": {"type": "string", "description": "Connection name"},
				"run_id": {"type": "string", "description": "Pipeline run ID"},
				"policies": {"type": "array", "items": {"type": "string"}, "description": "Policy names to evaluate"}
			},
			"required": ["connection_name", "run_id"]
		}`),
	},
	{
		Name:        "pipewarden_compliance",
		Description: "Generate compliance report (SOC2, HIPAA, GDPR, PCI-DSS) from pipeline findings",
		InputSchema: json.RawMessage(`{
			"type": "object",
			"properties": {
				"framework": {"type": "string", "enum": ["soc2", "hipaa", "gdpr", "pci-dss"], "description": "Compliance framework"},
				"connection_name": {"type": "string", "description": "Filter by connection (optional)"},
				"date_range": {"type": "string", "description": "Date range (e.g., 'last-30-days')"}
			},
			"required": ["framework"]
		}`),
	},
}
