package analysis

import (
	"context"
	"encoding/json"
	"testing"
)

func TestNewSemgrepScanner(t *testing.T) {
	s := NewSemgrepScanner()
	if s == nil {
		t.Fatal("expected non-nil scanner")
	}
	// Available() depends on whether semgrep is installed — just assert it doesn't panic
	_ = s.Available()
}

func TestSemgrepScanner_Unavailable(t *testing.T) {
	s := &SemgrepScanner{binaryPath: ""}
	result, err := s.ScanContent(context.Background(), "test content", "test.yml", "conn", "run1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Skipped {
		t.Error("expected Skipped=true when semgrep not installed")
	}
	if result.Error == "" {
		t.Error("expected non-empty error message")
	}
}

func TestParseSemgrepJSON_Empty(t *testing.T) {
	findings, err := parseSemgrepJSON(nil, "conn", "run1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(findings) != 0 {
		t.Errorf("expected 0 findings, got %d", len(findings))
	}
}

func TestParseSemgrepJSON_WithResults(t *testing.T) {
	output := map[string]interface{}{
		"results": []map[string]interface{}{
			{
				"check_id": "ci.secrets.hardcoded-secret",
				"path":     ".github/workflows/ci.yml",
				"start":    map[string]interface{}{"line": 42},
				"extra": map[string]interface{}{
					"message":  "Hardcoded secret found",
					"severity": "HIGH",
					"metadata": map[string]interface{}{
						"confidence": "high",
						"category":   "secrets",
					},
				},
			},
		},
	}
	data, _ := json.Marshal(output)

	findings, err := parseSemgrepJSON(data, "myconn", "run123")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}

	f := findings[0]
	if f.ConnectionName != "myconn" {
		t.Errorf("expected connection name 'myconn', got %s", f.ConnectionName)
	}
	if f.RunID != "run123" {
		t.Errorf("expected run ID 'run123', got %s", f.RunID)
	}
	if f.Severity != SeverityHigh {
		t.Errorf("expected high severity, got %s", f.Severity)
	}
	if f.Category != CategorySecrets {
		t.Errorf("expected secrets category, got %s", f.Category)
	}
	if f.Line != 42 {
		t.Errorf("expected line 42, got %d", f.Line)
	}
	if f.Confidence != 0.9 {
		t.Errorf("expected confidence 0.9 for high, got %f", f.Confidence)
	}
}

func TestMapSemgrepSeverity(t *testing.T) {
	tests := []struct {
		input    string
		expected Severity
	}{
		{"CRITICAL", SeverityCritical},
		{"HIGH", SeverityHigh},
		{"ERROR", SeverityHigh},
		{"MEDIUM", SeverityMedium},
		{"WARNING", SeverityMedium},
		{"LOW", SeverityLow},
		{"INFO", SeverityLow},
		{"UNKNOWN", SeverityMedium},
	}
	for _, tt := range tests {
		got := mapSemgrepSeverity(tt.input)
		if got != tt.expected {
			t.Errorf("input=%s: expected %s, got %s", tt.input, tt.expected, got)
		}
	}
}

func TestMapSemgrepConfidence(t *testing.T) {
	if mapSemgrepConfidence("high") != 0.9 {
		t.Error("expected 0.9 for high confidence")
	}
	if mapSemgrepConfidence("medium") != 0.7 {
		t.Error("expected 0.7 for medium confidence")
	}
	if mapSemgrepConfidence("low") != 0.5 {
		t.Error("expected 0.5 for unknown/low confidence")
	}
}

func TestMapSemgrepCategory(t *testing.T) {
	if mapSemgrepCategory("secrets") != CategorySecrets {
		t.Error("expected CategorySecrets for secrets")
	}
	if mapSemgrepCategory("injection") != CategoryInjection {
		t.Error("expected CategoryInjection for injection")
	}
	if mapSemgrepCategory("security") != CategoryConfig {
		t.Error("expected CategoryConfig for security")
	}
	if mapSemgrepCategory("unknown") != CategoryOther {
		t.Error("expected CategoryOther for unknown")
	}
}

func TestParseSemgrepJSON_MultipleResults(t *testing.T) {
	output := map[string]interface{}{
		"results": []map[string]interface{}{
			{
				"check_id": "rule1",
				"path":     "Dockerfile",
				"start":    map[string]interface{}{"line": 1},
				"extra": map[string]interface{}{
					"message":  "Issue 1",
					"severity": "CRITICAL",
					"metadata": map[string]interface{}{"confidence": "high"},
				},
			},
			{
				"check_id": "rule2",
				"path":     "Jenkinsfile",
				"start":    map[string]interface{}{"line": 10},
				"extra": map[string]interface{}{
					"message":  "Issue 2",
					"severity": "MEDIUM",
					"metadata": map[string]interface{}{"confidence": "medium"},
				},
			},
		},
	}
	data, _ := json.Marshal(output)

	findings, err := parseSemgrepJSON(data, "conn", "run")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(findings) != 2 {
		t.Fatalf("expected 2 findings, got %d", len(findings))
	}
	if findings[0].Severity != SeverityCritical {
		t.Errorf("expected critical for first finding")
	}
	if findings[1].Severity != SeverityMedium {
		t.Errorf("expected medium for second finding")
	}
}
