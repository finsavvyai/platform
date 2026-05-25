package ai

import (
	"strings"

	"github.com/finsavvyai/pushci/internal/runner"
)

// localDiagnose uses pattern matching when Claude API is unavailable.
func localDiagnose(r runner.Result) *Diagnosis {
	output := r.Output
	for _, p := range patterns {
		if strings.Contains(output, p.match) {
			return &Diagnosis{
				Check:       r.Check,
				Explanation: p.explanation,
				Suggestion:  p.suggestion,
				Confidence:  "pattern",
			}
		}
	}
	return nil
}

type pattern struct {
	match       string
	explanation string
	suggestion  string
}

var patterns = []pattern{
	{
		"go: module not found",
		"Go module dependency is missing.",
		"Run: go mod tidy",
	},
	{
		"Cannot find module",
		"Node.js dependency is missing.",
		"Run: npm install",
	},
	{
		"ModuleNotFoundError",
		"Python module is not installed.",
		"Run: pip install -r requirements.txt",
	},
	{
		"permission denied",
		"File or directory permission issue.",
		"Run: chmod +x <file> or check directory permissions",
	},
	{
		"address already in use",
		"Port is already bound by another process.",
		"Run: lsof -i :<port> | kill the process",
	},
	{
		"out of memory",
		"Process exceeded available memory.",
		"Increase memory limit or optimize the code",
	},
	{
		"FAIL",
		"One or more tests failed.",
		"Check the test output above for the failing test name",
	},
	{
		"compilation failed",
		"Code has syntax or type errors.",
		"Fix the compilation errors shown in the output",
	},
	{
		"cargo build",
		"Rust compilation error.",
		"Run: cargo build and fix the errors",
	},
	{
		"tsc --noEmit",
		"TypeScript type errors found.",
		"Run: npx tsc --noEmit to see detailed errors",
	},
}
