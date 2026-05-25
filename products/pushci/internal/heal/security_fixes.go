package heal

import (
	"fmt"
	"regexp"
)

// securityFixCatalog defines available auto-fix strategies
var securityFixCatalog = []SecurityFix{
	{
		Category:    "missing-tests",
		Pattern:     `no test.*step|missing.*test`,
		Description: "Add test step to pipeline",
		FixFunc: func(configPath string) error {
			return addTestStep(configPath)
		},
	},
	{
		Category:    "missing-lint",
		Pattern:     `no lint|missing lint check`,
		Description: "Add lint step to pipeline",
		FixFunc: func(configPath string) error {
			return addLintStep(configPath)
		},
	},
	{
		Category:    "unpinned-deps",
		Pattern:     `unpinned|floating.*version|version.*not.*pinned`,
		Description: "Pin dependencies to specific versions",
		FixFunc: func(configPath string) error {
			return pinDependencies(configPath)
		},
	},
	{
		Category:    "broad-permissions",
		Pattern:     `broad.*permission|overly.*permissive|unrestricted.*access`,
		Description: "Restrict to minimum required permissions",
		FixFunc: func(configPath string) error {
			return restrictPermissions(configPath)
		},
	},
	{
		Category:    "missing-branch-protection",
		Pattern:     `no branch.*protection|missing.*protection`,
		Description: "Add branch filter and protection",
		FixFunc: func(configPath string) error {
			return addBranchProtection(configPath)
		},
	},
}

// ApplySecurityFixes reads PipeWarden findings and applies available auto-fixes
func ApplySecurityFixes(findings []Finding, configPath string) (*FixResult, error) {
	result := &FixResult{
		FilesModified: []string{configPath},
	}

	for _, finding := range findings {
		fix := matchSecurityFix(finding)
		if fix == nil {
			continue
		}

		if err := fix.FixFunc(configPath); err != nil {
			return nil, fmt.Errorf("apply fix for %s: %w", finding.Category, err)
		}

		result.Fixes = append(result.Fixes, *fix)
		result.RemediationCount++
	}

	result.Fixed = result.RemediationCount > 0
	return result, nil
}

// matchSecurityFix finds the appropriate fix for a finding
func matchSecurityFix(finding Finding) *SecurityFix {
	for i := range securityFixCatalog {
		if securityFixCatalog[i].Category == finding.Category {
			return &securityFixCatalog[i]
		}
		if matchPattern(securityFixCatalog[i].Pattern, finding.Description) {
			return &securityFixCatalog[i]
		}
	}
	return nil
}

// matchPattern checks if text matches regex pattern
func matchPattern(pattern, text string) bool {
	rx, err := regexp.Compile("(?i)" + pattern)
	if err != nil {
		return false
	}
	return rx.MatchString(text)
}
