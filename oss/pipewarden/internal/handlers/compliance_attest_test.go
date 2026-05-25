package handlers

import (
	"strings"
	"testing"
	"time"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

func TestApplyPeriod_FiltersByCreatedAt(t *testing.T) {
	jan := time.Date(2026, 1, 15, 0, 0, 0, 0, time.UTC)
	mar := time.Date(2026, 3, 15, 0, 0, 0, 0, time.UTC)
	may := time.Date(2026, 5, 15, 0, 0, 0, 0, time.UTC)
	findings := []storage.FindingRecord{
		{ID: 1, CreatedAt: jan},
		{ID: 2, CreatedAt: mar},
		{ID: 3, CreatedAt: may},
	}
	from := time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 4, 1, 0, 0, 0, 0, time.UTC)
	got := applyPeriod(findings, &from, &to)
	if len(got) != 1 || got[0].ID != 2 {
		t.Errorf("only mar finding should pass, got %+v", got)
	}
}

func TestApplyPeriod_NilBoundsPassEverything(t *testing.T) {
	findings := []storage.FindingRecord{{ID: 1}, {ID: 2}}
	if got := applyPeriod(findings, nil, nil); len(got) != 2 {
		t.Errorf("nil bounds should pass everything, got %d", len(got))
	}
}

func TestComputeCoverage_DistinctConnectionsAndRuns(t *testing.T) {
	findings := []storage.FindingRecord{
		{ConnectionName: "a", RunID: "r1"},
		{ConnectionName: "a", RunID: "r1"},
		{ConnectionName: "a", RunID: "r2"},
		{ConnectionName: "b", RunID: "r1"},
	}
	c := computeCoverage(findings)
	if c.ConnectionsScanned != 2 {
		t.Errorf("expected 2 distinct connections, got %d", c.ConnectionsScanned)
	}
	if c.RunsScanned != 3 {
		t.Errorf("expected 3 distinct runs (a/r1, a/r2, b/r1), got %d", c.RunsScanned)
	}
	if c.TotalFindings != 4 {
		t.Errorf("expected 4 total findings, got %d", c.TotalFindings)
	}
}

func TestHashEvidence_StableForSameInput(t *testing.T) {
	findings := []storage.FindingRecord{{ID: 5}, {ID: 1}, {ID: 9}}
	from := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 4, 1, 0, 0, 0, 0, time.UTC)
	a := hashEvidence("soc2", &from, &to, findings)
	b := hashEvidence("soc2", &from, &to, []storage.FindingRecord{{ID: 9}, {ID: 5}, {ID: 1}})
	if a != b {
		t.Errorf("hash should be order-independent, got %s vs %s", a, b)
	}
	if len(a) != 64 {
		t.Errorf("hash should be 64 hex chars, got len=%d", len(a))
	}
}

func TestHashEvidence_DiffersOnContentChange(t *testing.T) {
	from := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	a := hashEvidence("soc2", &from, nil, []storage.FindingRecord{{ID: 1}})
	b := hashEvidence("soc2", &from, nil, []storage.FindingRecord{{ID: 2}})
	if a == b {
		t.Errorf("hash should change when finding IDs change")
	}
}

func TestHashEvidence_DiffersOnFrameworkChange(t *testing.T) {
	a := hashEvidence("soc2", nil, nil, nil)
	b := hashEvidence("hipaa", nil, nil, nil)
	if a == b {
		t.Errorf("hash should change with framework")
	}
}

func TestRenderMarkdown_ContainsKeyFields(t *testing.T) {
	report := ComplianceReport{
		Framework:    "soc2",
		GeneratedAt:  time.Now().UTC(),
		EvidenceHash: "deadbeef",
		Coverage:     ComplianceCoverage{ConnectionsScanned: 3, RunsScanned: 7, TotalFindings: 12},
		Summary:      ComplianceSummary{TotalControls: 4, Passing: 3, Failing: 1, Score: 75},
		Controls: []ComplianceControl{
			{ID: "CC6.1", Title: "Access", Status: "passing"},
		},
	}
	md := renderMarkdown(report)
	for _, want := range []string{"SOC2", "deadbeef", "Connections scanned: 3", "Score: 75/100", "CC6.1"} {
		if !strings.Contains(md, want) {
			t.Errorf("markdown missing %q", want)
		}
	}
}

func TestRenderCSV_HasHeaderAndRow(t *testing.T) {
	report := ComplianceReport{Controls: []ComplianceControl{
		{ID: "CC6.1", Title: "Access Control", Status: "passing", Findings: []string{"42", "99"}},
	}}
	csv := renderCSV(report)
	if !strings.HasPrefix(csv, "control_id,title,status,finding_ids\n") {
		t.Errorf("CSV missing header, got %q", csv)
	}
	if !strings.Contains(csv, "CC6.1") || !strings.Contains(csv, "42;99") {
		t.Errorf("CSV missing row content, got %q", csv)
	}
}

func TestParsePeriodParam_RFC3339(t *testing.T) {
	got := parsePeriodParam("2026-01-15T00:00:00Z")
	if got == nil || got.Year() != 2026 || got.Month() != 1 || got.Day() != 15 {
		t.Errorf("parse failed, got %v", got)
	}
}

func TestParsePeriodParam_EmptyAndMalformed(t *testing.T) {
	if parsePeriodParam("") != nil {
		t.Error("empty should yield nil")
	}
	if parsePeriodParam("not a date") != nil {
		t.Error("malformed should yield nil")
	}
}
