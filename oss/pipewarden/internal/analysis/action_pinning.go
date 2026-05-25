package analysis

import (
	"fmt"
	"regexp"
	"strings"
)

// usesLineRe matches GitHub Actions `uses:` lines with a non-SHA ref.
// It captures the full `uses: owner/action@ref` value for the finding description.
var usesLineRe = regexp.MustCompile(`uses:\s+([a-zA-Z0-9_/.-]+@[^\s]+)`)

// shaRefRe matches a 40-character lowercase hex SHA pin.
var shaRefRe = regexp.MustCompile(`^[0-9a-f]{40}$`)

// localActionRe matches local path actions (e.g. `./local-action`).
var localActionRe = regexp.MustCompile(`^\.\/`)

// CheckActionPinning scans YAML content for GitHub Actions `uses:` lines
// that reference a mutable tag or branch instead of a full 40-char SHA pin.
// Returns one Finding per offending line.
func CheckActionPinning(content string) []Finding {
	var findings []Finding

	for i, line := range strings.Split(content, "\n") {
		matches := usesLineRe.FindStringSubmatch(line)
		if len(matches) < 2 {
			continue
		}

		ref := matches[1] // e.g. "actions/checkout@v4"

		// Skip local path actions (./something)
		atIdx := strings.LastIndex(ref, "@")
		if atIdx < 0 {
			continue
		}
		actionPart := ref[:atIdx]
		pinPart := ref[atIdx+1:]

		if localActionRe.MatchString(actionPart) {
			continue
		}

		// Skip if already pinned to a full 40-char SHA
		if shaRefRe.MatchString(pinPart) {
			continue
		}

		findings = append(findings, Finding{
			Severity:    SeverityMedium,
			Category:    "supply-chain",
			Title:       "Action not SHA-pinned",
			Description: fmt.Sprintf("Line %d: `%s` uses a mutable ref '%s'. Pin to a full commit SHA to prevent supply-chain attacks.", i+1, strings.TrimSpace(line), pinPart),
			Remediation: fmt.Sprintf("Replace `uses: %s` with a full 40-character commit SHA pin, e.g. `uses: %s@<sha>`.", ref, actionPart),
			Confidence:  0.9,
			Status:      "open",
		})
	}

	return findings
}
