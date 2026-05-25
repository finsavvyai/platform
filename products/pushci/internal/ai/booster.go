package ai

import "strings"

// BoostResult holds a fast-path decision that skips AI.
type BoostResult struct {
	Action  string // "pass", "alert", or "" (no boost)
	Reason  string
	Details string
}

// Boost checks if a pipeline can skip AI analysis entirely.
// Returns nil when no fast-path applies and AI should be used.
func Boost(checks []string, output string) *BoostResult {
	if isLintOnly(checks) {
		return &BoostResult{
			Action: "pass",
			Reason: "lint-only pipeline",
		}
	}
	if isFormatOnly(checks) {
		return &BoostResult{
			Action: "pass",
			Reason: "format-only pipeline",
		}
	}
	if cve := matchCVE(output); cve != "" {
		return &BoostResult{
			Action:  "alert",
			Reason:  "known CVE pattern detected",
			Details: cve,
		}
	}
	return nil
}

func isLintOnly(checks []string) bool {
	if len(checks) == 0 {
		return false
	}
	for _, c := range checks {
		lc := strings.ToLower(c)
		if !strings.Contains(lc, "lint") && !strings.Contains(lc, "eslint") &&
			!strings.Contains(lc, "golangci") && !strings.Contains(lc, "pylint") &&
			!strings.Contains(lc, "rubocop") {
			return false
		}
	}
	return true
}

func isFormatOnly(checks []string) bool {
	if len(checks) == 0 {
		return false
	}
	for _, c := range checks {
		lc := strings.ToLower(c)
		if !strings.Contains(lc, "format") && !strings.Contains(lc, "fmt") &&
			!strings.Contains(lc, "prettier") && !strings.Contains(lc, "gofmt") &&
			!strings.Contains(lc, "black") {
			return false
		}
	}
	return true
}

// knownCVEs maps output substrings to CVE identifiers.
var knownCVEs = []struct {
	pattern string
	cve     string
}{
	{"log4j-core", "CVE-2021-44228 (Log4Shell)"},
	{"Log4j", "CVE-2021-44228 (Log4Shell)"},
	{"node-forge <1.3.0", "CVE-2022-24771 (node-forge signature)"},
	{"jsonwebtoken <9.0.0", "CVE-2022-23529 (jwt bypass)"},
	{"protobufjs <7.2.4", "CVE-2023-36665 (protobuf.js RCE)"},
	{"spring-core", "CVE-2022-22965 (Spring4Shell)"},
	{"xml2js <0.5.0", "CVE-2023-0842 (xml2js prototype)"},
}

func matchCVE(output string) string {
	for _, entry := range knownCVEs {
		if strings.Contains(output, entry.pattern) {
			return entry.cve
		}
	}
	return ""
}
