package analysis

import (
	"encoding/json"
	"testing"
	"time"
)

func TestAnalysisResultToSARIF(t *testing.T) {
	now := time.Now()

	result := &AnalysisResult{
		ConnectionName: "github-main",
		RunID:          "run-123",
		Summary:        "Found 2 critical issues",
		RiskScore:      85,
		TokensUsed:     1500,
		Model:          "claude-3-sonnet",
		AnalyzedAt:     now,
		DurationMS:     2500,
		Findings: []Finding{
			{
				ID:             1,
				ConnectionName: "github-main",
				RunID:          "run-123",
				Severity:       SeverityCritical,
				Category:       CategorySecrets,
				Title:          "API key exposed in workflow",
				Description:    "Found hardcoded AWS secret key in GitHub workflow",
				Remediation:    "Use GitHub secrets instead of hardcoded values",
				File:           ".github/workflows/deploy.yml",
				Line:           45,
				Confidence:     0.99,
				FalsePositive:  false,
				Status:         "open",
				CreatedAt:      now,
			},
			{
				ID:             2,
				ConnectionName: "github-main",
				RunID:          "run-123",
				Severity:       SeverityHigh,
				Category:       CategoryAccessControl,
				Title:          "Overpermissive workflow permissions",
				Description:    "Workflow has 'write-all' permissions",
				Remediation:    "Restrict to minimum required permissions",
				File:           ".github/workflows/build.yml",
				Line:           3,
				Confidence:     0.95,
				FalsePositive:  false,
				Status:         "open",
				CreatedAt:      now,
			},
		},
	}

	sarif := result.ToSARIF()

	// Assert SARIF structure
	if sarif == nil {
		t.Fatal("ToSARIF returned nil")
	}

	if sarif.Version != "2.1.0" {
		t.Errorf("Expected version 2.1.0, got %s", sarif.Version)
	}

	if len(sarif.Runs) != 1 {
		t.Errorf("Expected 1 run, got %d", len(sarif.Runs))
	}

	run := sarif.Runs[0]

	// Check tool metadata
	if run.Tool.Driver.Name != "PipeWarden" {
		t.Errorf("Expected tool name 'PipeWarden', got %s", run.Tool.Driver.Name)
	}

	if run.Tool.Driver.Version != "1.0.0" {
		t.Errorf("Expected tool version 1.0.0, got %s", run.Tool.Driver.Version)
	}

	// Check results count
	if len(run.Results) != 2 {
		t.Errorf("Expected 2 results, got %d", len(run.Results))
	}

	// Check first result (critical)
	result1 := run.Results[0]
	if result1.Kind != "open" {
		t.Errorf("Expected kind 'open', got %s", result1.Kind)
	}

	if result1.Level != "error" {
		t.Errorf("Expected critical to map to 'error', got %s", result1.Level)
	}

	if result1.Rank != 100.0 {
		t.Errorf("Expected critical rank 100.0, got %f", result1.Rank)
	}

	if result1.Message.Text != "API key exposed in workflow" {
		t.Errorf("Expected message 'API key exposed in workflow', got %s", result1.Message.Text)
	}

	// Check second result (high)
	result2 := run.Results[1]
	if result2.Level != "error" {
		t.Errorf("Expected high to map to 'error', got %s", result2.Level)
	}

	if result2.Rank != 75.0 {
		t.Errorf("Expected high rank 75.0, got %f", result2.Rank)
	}

	// Check location information
	if len(result1.Locations) > 0 {
		loc := result1.Locations[0]
		if loc.PhysicalLocation.ArtifactLocation.URI != ".github/workflows/deploy.yml" {
			t.Errorf("Expected file URI, got %s", loc.PhysicalLocation.ArtifactLocation.URI)
		}
	}

	// Verify JSON marshaling works
	jsonBytes, err := json.Marshal(sarif)
	if err != nil {
		t.Errorf("Failed to marshal SARIF to JSON: %v", err)
	}

	if len(jsonBytes) == 0 {
		t.Error("Marshaled JSON is empty")
	}
}

func TestFindingSeverityToLevel(t *testing.T) {
	tests := []struct {
		severity Severity
		expected string
	}{
		{SeverityCritical, "error"},
		{SeverityHigh, "error"},
		{SeverityMedium, "warning"},
		{SeverityLow, "note"},
		{SeverityInfo, "note"},
	}

	for _, tt := range tests {
		t.Run(string(tt.severity), func(t *testing.T) {
			level := findingSeverityToLevel(tt.severity)
			if level != tt.expected {
				t.Errorf("Expected %s, got %s", tt.expected, level)
			}
		})
	}
}

func TestFindingSeverityToRank(t *testing.T) {
	tests := []struct {
		severity Severity
		expected float64
	}{
		{SeverityCritical, 100.0},
		{SeverityHigh, 75.0},
		{SeverityMedium, 50.0},
		{SeverityLow, 25.0},
		{SeverityInfo, 0.0},
	}

	for _, tt := range tests {
		t.Run(string(tt.severity), func(t *testing.T) {
			rank := findingSeverityToRank(tt.severity)
			if rank != tt.expected {
				t.Errorf("Expected %f, got %f", tt.expected, rank)
			}
		})
	}
}

func TestNilAnalysisResultToSARIF(t *testing.T) {
	var result *AnalysisResult
	sarif := result.ToSARIF()

	if sarif == nil {
		t.Fatal("ToSARIF returned nil for nil result")
	}

	if sarif.Version != "2.1.0" {
		t.Errorf("Expected version 2.1.0, got %s", sarif.Version)
	}

	if len(sarif.Runs) != 0 {
		t.Errorf("Expected 0 runs for nil result, got %d", len(sarif.Runs))
	}
}

func TestEmptyFindingsToSARIF(t *testing.T) {
	result := &AnalysisResult{
		ConnectionName: "github-main",
		RunID:          "run-123",
		Summary:        "No issues found",
		RiskScore:      0,
		Findings:       []Finding{},
	}

	sarif := result.ToSARIF()

	if len(sarif.Runs) != 1 {
		t.Errorf("Expected 1 run, got %d", len(sarif.Runs))
	}

	if len(sarif.Runs[0].Results) != 0 {
		t.Errorf("Expected 0 results for empty findings, got %d", len(sarif.Runs[0].Results))
	}
}

func TestSARIFWithRemediationFix(t *testing.T) {
	finding := Finding{
		ID:            1,
		Severity:      SeverityHigh,
		Category:      CategoryConfig,
		Title:         "Missing security configuration",
		Description:   "Branch protection not enabled",
		Remediation:   "Enable branch protection on main branch",
		File:          ".github/settings.yml",
		Line:          1,
		Confidence:    0.85,
		FalsePositive: false,
		Status:        "open",
	}

	result := &AnalysisResult{
		ConnectionName: "test",
		RunID:          "test-run",
		Findings:       []Finding{finding},
	}

	sarif := result.ToSARIF()

	if len(sarif.Runs[0].Results) != 1 {
		t.Errorf("Expected 1 result, got %d", len(sarif.Runs[0].Results))
	}

	sarifResult := sarif.Runs[0].Results[0]

	if len(sarifResult.Fixes) == 0 {
		t.Error("Expected fixes to be populated from remediation")
	}

	if len(sarifResult.Fixes) > 0 {
		if sarifResult.Fixes[0].Description.Text != "Enable branch protection on main branch" {
			t.Errorf("Expected fix description to match remediation")
		}
	}
}
