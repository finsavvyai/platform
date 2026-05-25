package intel

import (
	"regexp"
	"strings"
)

var (
	reGoCompile = regexp.MustCompile(`(\S+\.go):(\d+):\d+: (.+)`)
	reNodeImport = regexp.MustCompile(`Module not found.*'([^']+)'`)
)

func diagnoseCompileError(output string) *Diagnosis {
	if m := reGoCompile.FindStringSubmatch(output); m != nil {
		return &Diagnosis{
			Pattern:     "compilation error",
			Explanation: m[3],
			Suggestion:  "Fix error in " + m[1] + " at line " + m[2],
			Confidence:  0.9,
		}
	}
	if m := reNodeImport.FindStringSubmatch(output); m != nil {
		return diagnoseImport(m[1])
	}
	return nil
}

func diagnoseImport(dep string) *Diagnosis {
	if strings.HasPrefix(dep, ".") {
		return &Diagnosis{
			Pattern:     "import error",
			Explanation: "Local import path not found: " + dep,
			Suggestion:  "Check the import path exists",
			Confidence:  0.8,
		}
	}
	return &Diagnosis{
		Pattern:     "import error",
		Explanation: "Missing dependency: " + dep,
		Suggestion:  "Run `npm install " + dep + "`",
		Confidence:  0.85,
	}
}
