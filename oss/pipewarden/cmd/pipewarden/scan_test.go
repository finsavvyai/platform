package main

import (
	"bytes"
	"encoding/json"
	"io"
	"os"
	"strings"
	"testing"
)

// TestSeverityRank verifies the ordering: critical > high > medium > low > info.
func TestSeverityRank(t *testing.T) {
	tests := []struct {
		severity string
		want     int
	}{
		{"critical", 4},
		{"high", 3},
		{"medium", 2},
		{"low", 1},
		{"info", 0},
		{"unknown", 0},
		{"", 0},
	}
	for _, tc := range tests {
		got := severityRank(tc.severity)
		if got != tc.want {
			t.Errorf("severityRank(%q) = %d, want %d", tc.severity, got, tc.want)
		}
	}

	if severityRank("critical") <= severityRank("high") {
		t.Error("critical must rank higher than high")
	}
	if severityRank("high") <= severityRank("medium") {
		t.Error("high must rank higher than medium")
	}
	if severityRank("medium") <= severityRank("low") {
		t.Error("medium must rank higher than low")
	}
}

// TestMeetsThreshold verifies threshold matching logic.
func TestMeetsThreshold(t *testing.T) {
	tests := []struct {
		severity  string
		threshold string
		want      bool
	}{
		{"critical", "critical", true},
		{"critical", "high", true},
		{"critical", "medium", true},
		{"critical", "low", true},
		{"critical", "all", true},
		{"high", "critical", false},
		{"high", "high", true},
		{"high", "medium", true},
		{"high", "low", true},
		{"high", "all", true},
		{"medium", "high", false},
		{"medium", "medium", true},
		{"medium", "low", true},
		{"low", "high", false},
		{"low", "medium", false},
		{"low", "low", true},
		{"low", "all", true},
		{"info", "low", false},
		{"info", "all", true},
	}
	for _, tc := range tests {
		got := meetsThreshold(tc.severity, tc.threshold)
		if got != tc.want {
			t.Errorf("meetsThreshold(%q, %q) = %v, want %v",
				tc.severity, tc.threshold, got, tc.want)
		}
	}
}

// TestScanOutputJSON verifies that printFindingsJSON produces a valid JSON array.
func TestScanOutputJSON(t *testing.T) {
	findings := []interface{}{
		map[string]interface{}{
			"severity":        "high",
			"category":        "secrets",
			"title":           "Hardcoded API key",
			"connection_name": "github-prod",
		},
		map[string]interface{}{
			"severity":        "medium",
			"category":        "configuration",
			"title":           "Missing timeout",
			"connection_name": "github-prod",
		},
	}

	output := captureStdout(t, func() {
		printFindingsJSON(findings)
	})

	var decoded []interface{}
	if err := json.Unmarshal([]byte(strings.TrimSpace(output)), &decoded); err != nil {
		t.Fatalf("printFindingsJSON output is not valid JSON: %v\nOutput: %s", err, output)
	}
	if len(decoded) != 2 {
		t.Errorf("expected 2 findings in JSON output, got %d", len(decoded))
	}

	first, ok := decoded[0].(map[string]interface{})
	if !ok {
		t.Fatal("first finding is not a JSON object")
	}
	if sev, _ := first["severity"].(string); sev != "high" {
		t.Errorf("first finding severity: got %q, want %q", sev, "high")
	}
}

// captureStdout redirects os.Stdout to a pipe and returns captured output.
func captureStdout(t *testing.T, fn func()) string {
	t.Helper()
	old := os.Stdout
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatalf("pipe: %v", err)
	}
	os.Stdout = w

	fn()

	_ = w.Close()
	os.Stdout = old

	var buf bytes.Buffer
	_, _ = io.Copy(&buf, r)
	return buf.String()
}
