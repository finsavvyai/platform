package db

import (
	"context"
	"path/filepath"
	"testing"
)

func newTestClient(t *testing.T) *Client {
	t.Helper()
	dir := t.TempDir()
	c, err := New(filepath.Join(dir, "test.db"))
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	t.Cleanup(func() { _ = c.Close() })
	return c
}

func TestNewMigratesSchemaAndCloses(t *testing.T) {
	c := newTestClient(t)
	if c == nil || c.db == nil {
		t.Fatal("nil client")
	}
}

func TestNewBadPathReturnsError(t *testing.T) {
	if _, err := New("/dev/null/no-perm/sqlite.db"); err == nil {
		t.Fatal("expected error from unwritable path")
	}
}

func TestListFindingsAndHistoryOnEmptyDB(t *testing.T) {
	c := newTestClient(t)

	got, err := c.ListFindings("")
	if err != nil {
		t.Fatalf("ListFindings: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("expected 0 findings, got %d", len(got))
	}

	hist, err := c.ListAnalysisHistory("")
	if err != nil {
		t.Fatalf("ListAnalysisHistory: %v", err)
	}
	if len(hist) != 0 {
		t.Fatalf("expected 0 history, got %d", len(hist))
	}
}

func TestListWithSeededRows(t *testing.T) {
	c := newTestClient(t)

	_, err := c.db.Exec(`INSERT INTO finding_records (connection_name, run_id, severity, category, title, description, status) VALUES (?,?,?,?,?,?,?)`,
		"github-prod", "run-42", "high", "secrets", "AWS key", "leaked", "open")
	if err != nil {
		t.Fatalf("seed finding: %v", err)
	}
	_, err = c.db.Exec(`INSERT INTO analysis_records (connection_name, run_id, risk_score, findings_count, summary, model) VALUES (?,?,?,?,?,?)`,
		"github-prod", "run-42", 88, 1, "summary", "claude")
	if err != nil {
		t.Fatalf("seed analysis: %v", err)
	}

	got, err := c.ListFindings("github-prod")
	if err != nil {
		t.Fatalf("ListFindings: %v", err)
	}
	if len(got) != 1 || got[0]["severity"] != "high" {
		t.Fatalf("unexpected findings: %+v", got)
	}

	hist, err := c.ListAnalysisHistory("github-prod")
	if err != nil {
		t.Fatalf("ListAnalysisHistory: %v", err)
	}
	if len(hist) != 1 {
		t.Fatalf("history len=%d", len(hist))
	}

	stats, err := c.GetFindingStats()
	if err != nil {
		t.Fatalf("GetFindingStats: %v", err)
	}
	if stats["high"] != 1 {
		t.Fatalf("high stats=%v, want 1", stats["high"])
	}
}

func TestProvidersAndPaymentsStub(t *testing.T) {
	c := newTestClient(t)
	ctx := context.Background()

	providers, err := c.GetProviders(ctx)
	if err != nil {
		t.Fatalf("GetProviders: %v", err)
	}
	if providers == nil {
		t.Fatalf("GetProviders returned nil slice (want empty slice)")
	}

	if _, err := c.TestAllProviders(ctx); err != nil {
		t.Fatalf("TestAllProviders: %v", err)
	}
	if err := c.ProcessPaymentEvent(ctx, map[string]interface{}{"type": "test"}); err != nil {
		t.Fatalf("ProcessPaymentEvent: %v", err)
	}
}
