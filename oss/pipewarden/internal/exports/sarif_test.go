package exports

import (
	"encoding/json"
	"testing"
)

func TestExportSARIFBasic(t *testing.T) {
	findings := []Finding{
		{
			ID:          1,
			Title:       "SQL Injection",
			Description: "Potential SQL injection found",
			Severity:    "high",
			File:        "main.go",
			Line:        42,
			Confidence:  0.95,
			Category:    "security",
		},
	}

	data, err := ExportSARIF(findings, ExportOptions{})

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if len(data) == 0 {
		t.Error("expected non-empty result")
	}

	var log SARIFLog
	if err := json.Unmarshal(data, &log); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if log.Version != "2.1.0" {
		t.Errorf("expected version 2.1.0, got %s", log.Version)
	}

	if len(log.Runs) != 1 {
		t.Errorf("expected 1 run, got %d", len(log.Runs))
	}

	if len(log.Runs[0].Results) != 1 {
		t.Errorf("expected 1 result, got %d", len(log.Runs[0].Results))
	}
}

func TestExportSARIFMultiple(t *testing.T) {
	findings := []Finding{
		{
			ID:         1,
			Title:      "SQL Injection",
			Severity:   "high",
			File:       "main.go",
			Line:       42,
			Confidence: 0.95,
			Category:   "security",
		},
		{
			ID:         2,
			Title:      "Hardcoded Secret",
			Severity:   "critical",
			File:       "config.go",
			Line:       10,
			Confidence: 1.0,
			Category:   "secrets",
		},
	}

	data, err := ExportSARIF(findings, ExportOptions{})

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	var log SARIFLog
	_ = json.Unmarshal(data, &log)

	if len(log.Runs[0].Results) != 2 {
		t.Errorf("expected 2 results, got %d", len(log.Runs[0].Results))
	}
}

func TestExportSARIFWithRules(t *testing.T) {
	findings := []Finding{
		{
			ID:       1,
			Title:    "Test",
			Severity: "high",
			Category: "test",
		},
	}

	data, err := ExportSARIF(findings, ExportOptions{IncludeRules: true})

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	var log SARIFLog
	_ = json.Unmarshal(data, &log)

	if len(log.Runs[0].Tool.Driver.Rules) == 0 {
		t.Error("expected rules to be included")
	}
}

func TestMapSeverityToLevel(t *testing.T) {
	tests := map[string]string{
		"critical": "error",
		"high":     "error",
		"medium":   "warning",
		"low":      "note",
		"info":     "none",
	}

	for sev, expected := range tests {
		got := mapSeverityToLevel(sev)
		if got != expected {
			t.Errorf("for %s, expected %s, got %s", sev, expected, got)
		}
	}
}

func TestExportSARIFNoLine(t *testing.T) {
	findings := []Finding{
		{
			ID:       1,
			Title:    "Test",
			Severity: "low",
			File:     "test.go",
			Line:     0,
			Category: "test",
		},
	}

	data, err := ExportSARIF(findings, ExportOptions{})

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	var log SARIFLog
	_ = json.Unmarshal(data, &log)

	result := log.Runs[0].Results[0]
	if result.Locations[0].PhysicalLocation.Region != nil {
		t.Error("expected no region for line 0")
	}
}
