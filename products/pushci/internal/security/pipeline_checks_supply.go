package security

import "strings"

func scanUnpinnedDeps(content, filename string) []PipelineFinding {
	var findings []PipelineFinding
	for i, line := range strings.Split(content, "\n") {
		if strings.Contains(line, "pip install") && !strings.Contains(line, "==") {
			findings = append(findings, PipelineFinding{
				Severity: "low", Category: "supply-chain",
				Title:       "Unpinned Python Dependency",
				Description: "pip install without version pin",
				Remediation: "Pin dependencies: pip install package==1.2.3",
				File:        filename, Line: i + 1,
			})
		}
		if strings.Contains(line, "npm install") && !strings.Contains(line, "@") &&
			!strings.Contains(line, "-E") && !strings.Contains(line, "--save-exact") {
			findings = append(findings, PipelineFinding{
				Severity: "low", Category: "supply-chain",
				Title:       "Unpinned NPM Dependency",
				Description: "npm install without version pin",
				Remediation: "Use package-lock.json or pin: npm install pkg@1.2.3",
				File:        filename, Line: i + 1,
			})
		}
	}
	return findings
}

func findDeploySteps(content string) []string {
	var steps []string
	for _, line := range strings.Split(content, "\n") {
		lo := strings.ToLower(line)
		if strings.Contains(lo, "deploy") || strings.Contains(lo, "release") {
			steps = append(steps, line)
		}
	}
	return steps
}
