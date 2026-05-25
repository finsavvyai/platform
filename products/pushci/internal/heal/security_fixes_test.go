package heal

import (
	"testing"
)

func TestApplySecurityFixes_MissingTests(t *testing.T) {
	findings := []Finding{
		{
			Category:    "missing-tests",
			Title:       "No test step found",
			Description: "Pipeline has no test step configured",
			File:        "pushci.yml",
			Severity:    "medium",
			Confidence:  0.95,
		},
	}

	result, err := ApplySecurityFixes(findings, "/tmp/pushci.yml")
	if err != nil {
		t.Fatalf("ApplySecurityFixes failed: %v", err)
	}

	if !result.Fixed {
		t.Error("Expected at least one fix to be applied")
	}

	if result.RemediationCount != 1 {
		t.Errorf("Expected 1 remediation, got %d", result.RemediationCount)
	}

	if len(result.Fixes) == 0 {
		t.Error("Expected fixes list to be non-empty")
	}
}

func TestApplySecurityFixes_BroadPermissions(t *testing.T) {
	findings := []Finding{
		{
			Category:    "broad-permissions",
			Title:       "Overly permissive IAM role",
			Description: "Role has unrestricted access to all resources",
			File:        "pushci.yml",
			Severity:    "high",
			Confidence:  0.88,
		},
	}

	result, err := ApplySecurityFixes(findings, "/tmp/pushci.yml")
	if err != nil {
		t.Fatalf("ApplySecurityFixes failed: %v", err)
	}

	if !result.Fixed {
		t.Error("Expected permissions fix to be applied")
	}
}

func TestApplySecurityFixes_UnpinnedDeps(t *testing.T) {
	findings := []Finding{
		{
			Category:    "unpinned-deps",
			Title:       "Floating dependency versions",
			Description: "Dependencies are not pinned to specific versions",
			File:        "package.json",
			Severity:    "low",
			Confidence:  0.92,
		},
	}

	result, err := ApplySecurityFixes(findings, "/tmp/package.json")
	if err != nil {
		t.Fatalf("ApplySecurityFixes failed: %v", err)
	}

	if !result.Fixed {
		t.Error("Expected dependency pinning fix")
	}
}

func TestApplySecurityFixes_NoMatches(t *testing.T) {
	findings := []Finding{
		{
			Category:    "unknown-category",
			Title:       "Unknown security issue",
			Description: "Something we cannot auto-fix",
			File:        "unknown.yml",
			Severity:    "info",
			Confidence:  0.5,
		},
	}

	result, err := ApplySecurityFixes(findings, "/tmp/unknown.yml")
	if err != nil {
		t.Fatalf("ApplySecurityFixes failed: %v", err)
	}

	if result.Fixed {
		t.Error("Expected no fixes to be applied for unknown category")
	}

	if result.RemediationCount != 0 {
		t.Errorf("Expected 0 remediations, got %d", result.RemediationCount)
	}
}

func TestApplySecurityFixes_Multiple(t *testing.T) {
	findings := []Finding{
		{
			Category:    "missing-tests",
			Title:       "No test step",
			Description: "Missing test step",
			File:        "pushci.yml",
			Severity:    "medium",
			Confidence:  0.9,
		},
		{
			Category:    "missing-lint",
			Title:       "No lint check",
			Description: "Missing lint step",
			File:        "pushci.yml",
			Severity:    "low",
			Confidence:  0.85,
		},
		{
			Category:    "broad-permissions",
			Title:       "Broad permissions",
			Description: "Overly permissive access",
			File:        "pushci.yml",
			Severity:    "high",
			Confidence:  0.92,
		},
	}

	result, err := ApplySecurityFixes(findings, "/tmp/pushci.yml")
	if err != nil {
		t.Fatalf("ApplySecurityFixes failed: %v", err)
	}

	if !result.Fixed {
		t.Error("Expected fixes to be applied")
	}

	if result.RemediationCount != 3 {
		t.Errorf("Expected 3 remediations, got %d", result.RemediationCount)
	}
}

func TestMatchSecurityFix_ByCategory(t *testing.T) {
	tests := []struct {
		category string
		found    bool
	}{
		{"missing-tests", true},
		{"missing-lint", true},
		{"unpinned-deps", true},
		{"broad-permissions", true},
		{"missing-branch-protection", true},
		{"unknown-category", false},
	}

	for _, tt := range tests {
		finding := Finding{Category: tt.category}
		fix := matchSecurityFix(finding)
		if (fix != nil) != tt.found {
			t.Errorf("matchSecurityFix(%s): got fix=%v, want %v", tt.category, fix != nil, tt.found)
		}
	}
}

func TestMatchPattern(t *testing.T) {
	tests := []struct {
		pattern string
		text    string
		match   bool
	}{
		{`no test.*step`, "no test step found", true},
		{`unpinned|floating.*version`, "floating version constraint", true},
		{`broad.*permission`, "Broad permissions detected", true},
		{`no test.*step`, "test step exists", false},
	}

	for _, tt := range tests {
		got := matchPattern(tt.pattern, tt.text)
		if got != tt.match {
			t.Errorf("matchPattern(%q, %q): got %v, want %v", tt.pattern, tt.text, got, tt.match)
		}
	}
}

func TestSecurityFixCatalog(t *testing.T) {
	if len(securityFixCatalog) == 0 {
		t.Error("securityFixCatalog is empty")
	}

	expectedCategories := []string{
		"missing-tests",
		"missing-lint",
		"unpinned-deps",
		"broad-permissions",
		"missing-branch-protection",
	}

	for _, expected := range expectedCategories {
		found := false
		for _, fix := range securityFixCatalog {
			if fix.Category == expected {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("Missing expected category: %s", expected)
		}
	}
}
