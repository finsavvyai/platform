package analysis

import (
	"regexp"
	"strings"
)

// RuntimeScanRequest carries raw pipeline execution log output for scanning.
type RuntimeScanRequest struct {
	Logs    string `json:"logs"`
	RunID   string `json:"run_id"`
	JobName string `json:"job_name"`
}

// RuntimeFinding describes a single anomalous pattern detected in runtime logs.
type RuntimeFinding struct {
	Pattern     string `json:"pattern"`
	Line        string `json:"line"`
	LineNumber  int    `json:"line_number"`
	Severity    string `json:"severity"`
	Category    string `json:"category"`
	Description string `json:"description"`
}

// runtimeRule defines a compiled pattern and its associated metadata.
type runtimeRule struct {
	re          *regexp.Regexp
	pattern     string
	severity    string
	category    string
	description string
}

// standardPorts are allowed outbound port numbers; others trigger a finding.
var standardPorts = map[string]bool{
	"80": true, "443": true, "8080": true, "8443": true,
}

// runtimeRules are the compiled patterns evaluated against each log line.
var runtimeRules = []runtimeRule{
	{
		re:          regexp.MustCompile(`(?i)curl.+[|>].*(sh|bash)\b`),
		pattern:     "curl-pipe-shell",
		severity:    "critical",
		category:    "supply-chain",
		description: "Remote script piped directly to shell — potential supply-chain compromise",
	},
	{
		re:          regexp.MustCompile(`(?i)wget.+[|>].*(sh|bash)\b`),
		pattern:     "wget-pipe-shell",
		severity:    "critical",
		category:    "supply-chain",
		description: "Remote script piped directly to shell via wget — potential supply-chain compromise",
	},
	{
		re:          regexp.MustCompile(`(?i)export\s+\w*(TOKEN|KEY|SECRET|PASS)\w*=\S+`),
		pattern:     "secret-env-export",
		severity:    "high",
		category:    "secret-exposure",
		description: "Credential exported to environment variable — possible secret exfiltration",
	},
	{
		re:          regexp.MustCompile(`(?i)curl\s+http://`),
		pattern:     "curl-plaintext",
		severity:    "medium",
		category:    "network",
		description: "curl over unencrypted HTTP — data transferred without TLS",
	},
	{
		re:          regexp.MustCompile(`(?i)sudo\s+(su|chmod\s+777|chown\s+root)\b`),
		pattern:     "privilege-escalation",
		severity:    "high",
		category:    "container-security",
		description: "Privilege escalation command detected in pipeline step",
	},
	{
		re:          regexp.MustCompile(`(?i)docker\s+run.*--privileged\b`),
		pattern:     "privileged-container",
		severity:    "high",
		category:    "container-security",
		description: "Privileged container spawned at runtime — full host access granted",
	},
	{
		re:          regexp.MustCompile(`(?i)git\s+config.*--global\b`),
		pattern:     "git-config-mutation",
		severity:    "medium",
		category:    "policy",
		description: "Global git configuration mutated during pipeline execution",
	},
	{
		re:          regexp.MustCompile(`(?i)pip\s+install.*--trusted-host\b`),
		pattern:     "pip-trusted-host",
		severity:    "medium",
		category:    "supply-chain",
		description: "pip install with --trusted-host bypasses TLS certificate verification",
	},
	{
		re:          regexp.MustCompile(`(?i)base64\s+-d.*[|>]`),
		pattern:     "base64-decode-pipe",
		severity:    "high",
		category:    "supply-chain",
		description: "Base64-decoded payload piped to another command — obfuscation indicator",
	},
}

// nonStandardPortRe matches curl calls with an explicit port number.
var nonStandardPortRe = regexp.MustCompile(`(?i)curl\s+\S+:(\d{4,5})/`)

// ScanRuntimeLogs scans pipeline execution log output for anomalous patterns.
// It returns one RuntimeFinding per matched line per rule (no duplicates within
// the same rule+line pair).
func ScanRuntimeLogs(req RuntimeScanRequest) []RuntimeFinding {
	var findings []RuntimeFinding
	lines := strings.Split(req.Logs, "\n")

	for lineNum, raw := range lines {
		line := raw
		if len(line) > 200 {
			line = line[:200]
		}

		for _, rule := range runtimeRules {
			if rule.re.MatchString(raw) {
				findings = append(findings, RuntimeFinding{
					Pattern:     rule.pattern,
					Line:        line,
					LineNumber:  lineNum + 1,
					Severity:    rule.severity,
					Category:    rule.category,
					Description: rule.description,
				})
			}
		}

		// Non-standard port check
		if m := nonStandardPortRe.FindStringSubmatch(raw); m != nil {
			port := m[1]
			if !standardPorts[port] {
				findings = append(findings, RuntimeFinding{
					Pattern:     "non-standard-port",
					Line:        line,
					LineNumber:  lineNum + 1,
					Severity:    "medium",
					Category:    "network",
					Description: "curl request to non-standard port — potential data exfiltration channel",
				})
			}
		}
	}

	return findings
}
