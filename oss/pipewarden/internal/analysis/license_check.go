package analysis

import (
	"strings"
)

// LicenseChecker scans pipeline configurations for license compliance issues.
type LicenseChecker struct{}

// NewLicenseChecker creates a new LicenseChecker.
func NewLicenseChecker() *LicenseChecker {
	return &LicenseChecker{}
}

// LicenseViolation describes a detected license compliance issue.
type LicenseViolation struct {
	Package string
	License string
	Risk    string // "copyleft" | "unknown" | "restricted"
}

// knownCopyleftPackages are package names (substrings) that are known GPL/LGPL/AGPL.
var knownCopyleftPackages = []string{
	"ffmpeg",
	"ghostscript",
	"mysql-connector",
	"gpl",
	"lgpl",
	"agpl",
}

// CheckLicenses scans pipeline content for missing license audit steps and
// known copyleft packages. Returns a slice of Findings (severity=low).
func (c *LicenseChecker) CheckLicenses(content string) []Finding {
	var findings []Finding

	lines := strings.Split(content, "\n")

	hasNpm := containsAny(lines, []string{"npm install", "npm ci", "yarn add", "yarn install"})
	hasPip := containsAny(lines, []string{"pip install", "pip3 install"})
	hasGoGet := containsAny(lines, []string{"go get"})

	hasNpmAudit := containsAny(lines, []string{"npm audit", "license-checker", "licensee"})
	hasPipLicenses := containsAny(lines, []string{"pip-licenses", "liccheck", "pip_licenses"})

	if hasNpm && !hasNpmAudit {
		findings = append(findings, Finding{
			Severity:    SeverityLow,
			Category:    "license-compliance",
			Title:       "License audit step missing for npm dependencies",
			Description: "Pipeline installs npm packages but has no license audit step (npm audit, license-checker).",
			Remediation: "Add `npx license-checker --onlyAllow 'MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause'` or `npm audit` to your pipeline.",
			Confidence:  0.8,
			Status:      "open",
		})
	}

	if hasPip && !hasPipLicenses {
		findings = append(findings, Finding{
			Severity:    SeverityLow,
			Category:    "license-compliance",
			Title:       "License audit step missing for pip dependencies",
			Description: "Pipeline installs Python packages but has no license audit step (pip-licenses, liccheck).",
			Remediation: "Add `pip-licenses --fail-on=GPL` or `liccheck` to your pipeline.",
			Confidence:  0.8,
			Status:      "open",
		})
	}

	if hasGoGet {
		findings = append(findings, Finding{
			Severity:    SeverityInfo,
			Category:    "license-compliance",
			Title:       "Go module license compliance not verified",
			Description: "Pipeline uses `go get`. Ensure indirect/replace dependencies comply with your license policy.",
			Remediation: "Run `go-licenses check ./...` or review go.sum for copyleft transitive dependencies.",
			Confidence:  0.6,
			Status:      "open",
		})
	}

	// Scan for known copyleft package names in install commands
	for _, line := range lines {
		lower := strings.ToLower(line)
		if !isInstallLine(lower) {
			continue
		}
		for _, pkg := range knownCopyleftPackages {
			if strings.Contains(lower, pkg) {
				findings = append(findings, Finding{
					Severity:    SeverityLow,
					Category:    "license-compliance",
					Title:       "Known copyleft package detected: " + pkg,
					Description: "Package '" + pkg + "' or a package with that substring is known to use a copyleft license (GPL/LGPL/AGPL) which may restrict distribution.",
					Remediation: "Review the license of this package and verify it is compatible with your project's license policy.",
					Confidence:  0.75,
					Status:      "open",
				})
				break // one finding per install line
			}
		}
	}

	return findings
}

// isInstallLine returns true if the line looks like a package install command.
func isInstallLine(line string) bool {
	installKeywords := []string{
		"npm install", "npm ci", "yarn add", "yarn install",
		"pip install", "pip3 install",
		"go get", "apt-get install", "apt install",
		"brew install",
	}
	for _, kw := range installKeywords {
		if strings.Contains(line, kw) {
			return true
		}
	}
	return false
}

// containsAny returns true if any line in lines contains one of the needles.
func containsAny(lines []string, needles []string) bool {
	for _, line := range lines {
		lower := strings.ToLower(line)
		for _, needle := range needles {
			if strings.Contains(lower, needle) {
				return true
			}
		}
	}
	return false
}
