package storage

import (
	"testing"
)

// TestFindingSummary_EmptyTableNoNullCrash regresses a production bug where
// SUM(CASE WHEN ...) returned NULL on empty security_findings and Scan into
// int failed with "converting NULL to int is unsupported".
func TestFindingSummary_EmptyTableNoNullCrash(t *testing.T) {
	db := newTestDB(t)

	summary, err := db.FindingSummary()
	if err != nil {
		t.Fatalf("FindingSummary on empty DB returned error: %v", err)
	}
	if summary == nil {
		t.Fatal("summary is nil")
	}
	if summary.TotalFindings != 0 || summary.OpenFindings != 0 ||
		summary.Suppressed != 0 || summary.Resolved != 0 {
		t.Errorf("expected all-zero counts; got %+v", summary)
	}
	if summary.RiskScore != 0 {
		t.Errorf("risk score: got %d want 0", summary.RiskScore)
	}
	if summary.TrendDirection != "stable" {
		t.Errorf("trend: got %q want stable", summary.TrendDirection)
	}
}
