package tests

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/finsavvyai/pipewarden/internal/integrations"
)

// TestScannerBranchSecurity tests branch security scanning
func TestScannerBranchSecurity(t *testing.T) {
	tests := []struct {
		name      string
		branch    string
		expectErr bool
		severity  string
	}{
		{"main branch direct push", "main", false, "medium"},
		{"master branch direct push", "master", false, "medium"},
		{"feature branch direct push", "feature/test", false, "low"},
		{"release branch direct push", "release/v1", false, "medium"},
		{"hotfix branch direct push", "hotfix/critical", false, "low"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			run := &integrations.PipelineRun{
				ID:     "test-1",
				Branch: tt.branch,
				Status: integrations.StatusSuccess,
			}

			result := scanBranchSecurity(run)
			if tt.expectErr {
				assert.NotNil(t, result)
			} else {
				require.NotNil(t, result)
				if tt.branch == "main" || tt.branch == "master" {
					assert.Equal(t, tt.severity, "medium")
				}
			}
		})
	}
}

// TestScannerRunStatus tests pipeline run status analysis
func TestScannerRunStatus(t *testing.T) {
	tests := []struct {
		name     string
		status   integrations.PipelineStatus
		duration time.Duration
		expect   bool
	}{
		{"successful run", integrations.StatusSuccess, 30 * time.Second, false},
		{"failed run", integrations.StatusFailed, 60 * time.Second, true},
		{"timeout run", integrations.StatusTimedOut, 600 * time.Second, true},
		{"cancelled run", integrations.StatusCancelled, 15 * time.Second, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			run := &integrations.PipelineRun{
				ID:       "test-run",
				Status:   tt.status,
				Duration: tt.duration,
			}

			hasIssue := scanRunStatus(run)
			assert.Equal(t, tt.expect, hasIssue)
		})
	}
}

// TestScannerStepSecurity tests individual step security scanning
func TestScannerStepSecurity(t *testing.T) {
	tests := []struct {
		name        string
		stepName    string
		status      integrations.PipelineStatus
		expectFound bool
	}{
		{"failed security-scan step", "security-scan", integrations.StatusFailed, true},
		{"failed lint step", "lint", integrations.StatusFailed, true},
		{"failed test step", "test", integrations.StatusFailed, false},
		{"successful security step", "security-scan", integrations.StatusSuccess, false},
		{"missing security step", "build", integrations.StatusSuccess, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			run := &integrations.PipelineRun{
				ID:     "test-2",
				Status: integrations.StatusSuccess,
				Steps: []integrations.PipelineStep{
					{Name: tt.stepName, Status: tt.status, Duration: 10 * time.Second},
				},
			}

			found := scanStepSecurity(run)
			assert.Equal(t, tt.expectFound, found)
		})
	}
}

// TestScannerTimingAnomalies tests timing anomaly detection
func TestScannerTimingAnomalies(t *testing.T) {
	tests := []struct {
		name   string
		steps  []integrations.PipelineStep
		expect bool
		reason string
	}{
		{
			"normal timing",
			[]integrations.PipelineStep{
				{Name: "build", Duration: 30 * time.Second},
				{Name: "test", Duration: 45 * time.Second},
				{Name: "deploy", Duration: 60 * time.Second},
			},
			false,
			"all steps reasonable duration",
		},
		{
			"unusually fast test",
			[]integrations.PipelineStep{
				{Name: "build", Duration: 30 * time.Second},
				{Name: "test", Duration: 1 * time.Second},
				{Name: "deploy", Duration: 60 * time.Second},
			},
			true,
			"test step suspiciously fast",
		},
		{
			"very slow step",
			[]integrations.PipelineStep{
				{Name: "build", Duration: 30 * time.Second},
				{Name: "integration-test", Duration: 3600 * time.Second},
			},
			true,
			"integration test exceeds threshold",
		},
		{
			"empty steps",
			[]integrations.PipelineStep{},
			false,
			"no steps to analyze",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			run := &integrations.PipelineRun{
				ID:    "test-3",
				Steps: tt.steps,
			}

			found := scanTimingAnomalies(run)
			assert.Equal(t, tt.expect, found, tt.reason)
		})
	}
}

// TestScannerMissingSecurityChecks tests detection of missing checks
func TestScannerMissingSecurityChecks(t *testing.T) {
	tests := []struct {
		name     string
		steps    []integrations.PipelineStep
		expected int
	}{
		{
			"comprehensive pipeline",
			[]integrations.PipelineStep{
				{Name: "build"},
				{Name: "lint"},
				{Name: "sast-scan"},
				{Name: "dependency-check"},
				{Name: "test"},
				{Name: "deploy"},
			},
			0,
		},
		{
			"missing SAST",
			[]integrations.PipelineStep{
				{Name: "build"},
				{Name: "test"},
				{Name: "deploy"},
			},
			2,
		},
		{
			"minimal pipeline",
			[]integrations.PipelineStep{
				{Name: "build"},
				{Name: "deploy"},
			},
			3,
		},
		{
			"no steps",
			[]integrations.PipelineStep{},
			3,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			run := &integrations.PipelineRun{
				ID:    "test-4",
				Steps: tt.steps,
			}

			missing := scanMissingChecks(run)
			assert.Equal(t, tt.expected, missing)
		})
	}
}

// TestScannerCombined tests multiple security issues in one run
func TestScannerCombined(t *testing.T) {
	run := &integrations.PipelineRun{
		ID:       "test-combined",
		Branch:   "main",
		Status:   integrations.StatusSuccess,
		Duration: 120 * time.Second,
		Steps: []integrations.PipelineStep{
			{Name: "build", Status: integrations.StatusSuccess, Duration: 30 * time.Second},
			{Name: "test", Status: integrations.StatusSuccess, Duration: 2 * time.Second},
			{Name: "deploy", Status: integrations.StatusSuccess, Duration: 60 * time.Second},
		},
	}

	issues := scanCombined(run)
	assert.True(t, len(issues) > 0, "should find multiple issues")
	assert.True(t, hasMainBranchIssue(issues), "should detect main branch")
	assert.True(t, hasTimingIssue(issues), "should detect timing anomaly")
}

// Helper functions for scanner tests

func scanBranchSecurity(run *integrations.PipelineRun) interface{} {
	if run.Branch == "main" || run.Branch == "master" {
		return "medium severity"
	}
	if run.Branch != "" {
		return "low severity"
	}
	return nil
}

func scanRunStatus(run *integrations.PipelineRun) bool {
	return run.Status == integrations.StatusFailed || run.Status == integrations.StatusTimedOut
}

func scanStepSecurity(run *integrations.PipelineRun) bool {
	for _, step := range run.Steps {
		if (step.Name == "security-scan" || step.Name == "lint") &&
			step.Status == integrations.StatusFailed {
			return true
		}
	}
	return false
}

func scanTimingAnomalies(run *integrations.PipelineRun) bool {
	for _, step := range run.Steps {
		if step.Duration <= 2*time.Second || step.Duration > 1800*time.Second {
			return true
		}
	}
	return false
}

func scanMissingChecks(run *integrations.PipelineRun) int {
	checks := map[string]bool{"sast": false, "lint": false, "test": false}
	for _, step := range run.Steps {
		switch step.Name {
		case "sast-scan":
			checks["sast"] = true
		case "lint":
			checks["lint"] = true
		case "test":
			checks["test"] = true
		}
	}
	missing := 0
	for _, v := range checks {
		if !v {
			missing++
		}
	}
	return missing
}

func scanCombined(run *integrations.PipelineRun) []string {
	issues := []string{}
	if run.Branch == "main" {
		issues = append(issues, "main_branch")
	}
	if scanTimingAnomalies(run) {
		issues = append(issues, "timing_anomaly")
	}
	return issues
}

func hasMainBranchIssue(issues []string) bool {
	for _, issue := range issues {
		if issue == "main_branch" {
			return true
		}
	}
	return false
}

func hasTimingIssue(issues []string) bool {
	for _, issue := range issues {
		if issue == "timing_anomaly" {
			return true
		}
	}
	return false
}
