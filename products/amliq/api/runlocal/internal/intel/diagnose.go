package intel

import "regexp"

// Diagnosis holds a parsed error pattern with a fix suggestion.
type Diagnosis struct {
	Pattern     string
	Explanation string
	Suggestion  string
	Confidence  float64
}

type rule struct {
	pattern    string
	re         *regexp.Regexp
	explain    string
	suggestion string
	confidence float64
}

var rules = []rule{
	{
		pattern:    "module not found",
		re:         regexp.MustCompile(`go: .* module .* not found`),
		explain:    "Go module dependency is missing",
		suggestion: "Run `go mod tidy` to resolve dependencies",
		confidence: 0.95,
	},
	{
		pattern:    "Cannot find module",
		re:         regexp.MustCompile(`Cannot find module '([^']+)'`),
		explain:    "Node module is not installed",
		suggestion: "Run `npm install` to install dependencies",
		confidence: 0.95,
	},
	{
		pattern:    "FAIL test",
		re:         regexp.MustCompile(`--- FAIL: (\S+)`),
		explain:    "Go test failure",
		suggestion: "Check the failing test and fix assertions",
		confidence: 0.9,
	},
	{
		pattern:    "permission denied",
		re:         regexp.MustCompile(`(?i)permission denied`),
		explain:    "Insufficient file permissions",
		suggestion: "Check file permissions with `ls -la`",
		confidence: 0.85,
	},
	{
		pattern:    "port in use",
		re:         regexp.MustCompile(`(?i)address already in use|port .* already in use`),
		explain:    "A process is already using the port",
		suggestion: "Kill the process on that port or use a different port",
		confidence: 0.9,
	},
	{
		pattern:    "out of memory",
		re:         regexp.MustCompile(`(?i)out of memory|OOM|ENOMEM`),
		explain:    "Process ran out of memory",
		suggestion: "Increase memory limit or reduce workload",
		confidence: 0.85,
	},
}

// DiagnoseError parses output for known error patterns.
func DiagnoseError(output string) *Diagnosis {
	for _, r := range rules {
		if r.re.MatchString(output) {
			return &Diagnosis{
				Pattern:     r.pattern,
				Explanation: r.explain,
				Suggestion:  r.suggestion,
				Confidence:  r.confidence,
			}
		}
	}
	if d := diagnoseCompileError(output); d != nil {
		return d
	}
	return nil
}
