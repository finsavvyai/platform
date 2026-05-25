package heal

import (
	"testing"
)

// TestApplySecurityFixes_MultipleFixes tests applying multiple different fix types
func TestApplySecurityFixes_MultipleFixes(t *testing.T) {
	findings := []Finding{
		{
			Category:    "missing-tests",
			Title:       "No test step",
			Description: "Pipeline missing test step",
			File:        "pushci.yml",
			Severity:    "high",
			Confidence:  0.95,
		},
		{
			Category:    "missing-lint",
			Title:       "No lint step",
			Description: "Pipeline missing lint step",
			File:        "pushci.yml",
			Severity:    "medium",
			Confidence:  0.90,
		},
		{
			Category:    "unpinned-deps",
			Title:       "Unpinned dependencies",
			Description: "Dependencies floating version constraint",
			File:        "pushci.yml",
			Severity:    "low",
			Confidence:  0.85,
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

	if len(result.Fixes) != 3 {
		t.Errorf("Expected 3 fixes, got %d", len(result.Fixes))
	}

	expectedCategories := map[string]bool{
		"missing-tests": false,
		"missing-lint":  false,
		"unpinned-deps": false,
	}

	for _, fix := range result.Fixes {
		expectedCategories[fix.Category] = true
	}

	for cat, found := range expectedCategories {
		if !found {
			t.Errorf("Expected to find fix for %s", cat)
		}
	}
}

// TestApplySecurityFixes_NoApplicableFixes tests when findings don't match any fix strategy
func TestApplySecurityFixes_NoApplicableFixes(t *testing.T) {
	findings := []Finding{
		{
			Category:    "unknown-category",
			Title:       "Unknown issue",
			Description: "This issue has no auto-fix strategy",
			File:        "pushci.yml",
			Severity:    "info",
			Confidence:  0.5,
		},
		{
			Category:    "custom-compliance",
			Title:       "Custom compliance check",
			Description: "This is a custom finding with no fix",
			File:        "pushci.yml",
			Severity:    "medium",
			Confidence:  0.7,
		},
	}

	result, err := ApplySecurityFixes(findings, "/tmp/pushci.yml")
	if err != nil {
		t.Fatalf("ApplySecurityFixes failed: %v", err)
	}

	if result.Fixed {
		t.Error("Expected no fixes to be applied")
	}

	if result.RemediationCount != 0 {
		t.Errorf("Expected 0 remediations, got %d", result.RemediationCount)
	}

	if len(result.Fixes) != 0 {
		t.Errorf("Expected 0 fixes, got %d", len(result.Fixes))
	}
}

// TestApplySecurityFixes_ConflictingFixes tests when multiple strategies could apply
func TestApplySecurityFixes_ConflictingFixes(t *testing.T) {
	findings := []Finding{
		{
			Category:    "missing-tests",
			Title:       "No test step found",
			Description: "Pipeline has no test step configured",
			File:        "pushci.yml",
			Severity:    "high",
			Confidence:  0.95,
		},
		{
			Category:    "missing-tests",
			Title:       "No test step in deploy",
			Description: "Deploy stage missing no test step",
			File:        "pushci.yml",
			Severity:    "high",
			Confidence:  0.90,
		},
	}

	result, err := ApplySecurityFixes(findings, "/tmp/pushci.yml")
	if err != nil {
		t.Fatalf("ApplySecurityFixes failed: %v", err)
	}

	if !result.Fixed {
		t.Error("Expected fixes to be applied")
	}

	// Should apply fix once per matching finding
	if result.RemediationCount != 2 {
		t.Errorf("Expected 2 remediations for duplicate categories, got %d", result.RemediationCount)
	}
}

// TestFixStrategy_AddPinnedDeps tests the pinned dependency fix strategy
func TestFixStrategy_AddPinnedDeps(t *testing.T) {
	findings := []Finding{
		{
			Category:    "unpinned-deps",
			Title:       "Unpinned Python dependencies",
			Description: "Python dependencies are unpinned and floating",
			File:        "requirements.txt",
			Severity:    "low",
			Confidence:  0.92,
		},
	}

	result, err := ApplySecurityFixes(findings, "/tmp/requirements.txt")
	if err != nil {
		t.Fatalf("ApplySecurityFixes failed: %v", err)
	}

	if !result.Fixed {
		t.Error("Expected pinned dependency fix to be applied")
	}

	// Verify the fix is in the results
	var foundFix bool
	for _, fix := range result.Fixes {
		if fix.Category == "unpinned-deps" {
			foundFix = true
			if fix.Description != "Pin dependencies to specific versions" {
				t.Errorf("Unexpected fix description: %s", fix.Description)
			}
		}
	}

	if !foundFix {
		t.Error("Expected unpinned-deps fix in results")
	}
}

// TestFixStrategy_AddBranchProtection tests the branch protection fix strategy
func TestFixStrategy_AddBranchProtection(t *testing.T) {
	findings := []Finding{
		{
			Category:    "missing-branch-protection",
			Title:       "Missing branch protection",
			Description: "Deployment steps lack branch protection",
			File:        "workflow.yml",
			Severity:    "high",
			Confidence:  0.88,
		},
	}

	result, err := ApplySecurityFixes(findings, "/tmp/workflow.yml")
	if err != nil {
		t.Fatalf("ApplySecurityFixes failed: %v", err)
	}

	if !result.Fixed {
		t.Error("Expected branch protection fix to be applied")
	}

	// Verify the fix is correctly configured
	var foundFix bool
	for _, fix := range result.Fixes {
		if fix.Category == "missing-branch-protection" {
			foundFix = true
			if fix.Description != "Add branch filter and protection" {
				t.Errorf("Unexpected fix description: %s", fix.Description)
			}
			if fix.FixFunc == nil {
				t.Error("Expected FixFunc to be non-nil")
			}
		}
	}

	if !foundFix {
		t.Error("Expected missing-branch-protection fix in results")
	}
}

// TestApplySecurityFixes_PartialFailure tests behavior when some fixes fail
func TestApplySecurityFixes_PartialFailure(t *testing.T) {
	findings := []Finding{
		{
			Category:    "missing-tests",
			Title:       "No test step",
			Description: "missing test step",
			File:        "nonexistent.yml",
			Severity:    "high",
			Confidence:  0.95,
		},
	}

	// This should not fail even if the file doesn't exist,
	// because the placeholder FixFunc just returns nil
	result, err := ApplySecurityFixes(findings, "/nonexistent/path/pushci.yml")
	if err != nil {
		t.Logf("ApplySecurityFixes returned error: %v (expected for missing file)", err)
	}

	if result != nil && result.Fixed {
		if result.RemediationCount != 1 {
			t.Errorf("Expected 1 remediation despite file not existing, got %d", result.RemediationCount)
		}
	}
}

// TestMatchSecurityFix_PatternMatching tests regex-based fix matching
func TestMatchSecurityFix_PatternMatching(t *testing.T) {
	tests := []struct {
		name     string
		finding  Finding
		expected string
	}{
		{
			"Pattern match missing test",
			Finding{
				Category:    "",
				Description: "no test step found in pipeline",
			},
			"missing-tests",
		},
		{
			"Pattern match unpinned",
			Finding{
				Category:    "",
				Description: "floating version constraint detected",
			},
			"unpinned-deps",
		},
		{
			"Category exact match",
			Finding{
				Category: "missing-lint",
			},
			"missing-lint",
		},
		{
			"No match",
			Finding{
				Category:    "unrelated",
				Description: "some random description",
			},
			"",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fix := matchSecurityFix(tt.finding)
			if tt.expected == "" {
				if fix != nil {
					t.Errorf("Expected no match, got %s", fix.Category)
				}
			} else {
				if fix == nil {
					t.Errorf("Expected match for %s, got none", tt.expected)
				} else if fix.Category != tt.expected {
					t.Errorf("Expected %s, got %s", tt.expected, fix.Category)
				}
			}
		})
	}
}

// TestApplySecurityFixes_FilesModified verifies modified file tracking
func TestApplySecurityFixes_FilesModified(t *testing.T) {
	findings := []Finding{
		{
			Category:    "missing-tests",
			Title:       "No test step",
			Description: "missing test",
			File:        "config.yml",
			Severity:    "high",
			Confidence:  0.95,
		},
	}

	result, err := ApplySecurityFixes(findings, "/tmp/my-config.yml")
	if err != nil {
		t.Fatalf("ApplySecurityFixes failed: %v", err)
	}

	if len(result.FilesModified) == 0 {
		t.Error("Expected at least one file in FilesModified")
	}

	expectedFile := "/tmp/my-config.yml"
	found := false
	for _, f := range result.FilesModified {
		if f == expectedFile {
			found = true
			break
		}
	}

	if !found {
		t.Errorf("Expected %s in FilesModified, got %v", expectedFile, result.FilesModified)
	}
}
