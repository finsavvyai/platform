package clawpipe

import (
	"fmt"
	"math"
	"testing"
	"time"
)

func TestTrackScan_ValidModel(t *testing.T) {
	ct := NewCostTracker()
	err := ct.TrackScan("scan-1", "claude-haiku", 1000, 500)
	if err != nil {
		t.Errorf("expected no error, got %v", err)
	}

	history := ct.GetScanHistory()
	if len(history) != 1 {
		t.Errorf("expected 1 scan in history, got %d", len(history))
	}

	if history[0].Model != "claude-haiku" {
		t.Errorf("expected model claude-haiku, got %s", history[0].Model)
	}
}

func TestTrackScan_UnknownModel(t *testing.T) {
	ct := NewCostTracker()
	err := ct.TrackScan("scan-1", "claude-unknown", 1000, 500)
	if err == nil {
		t.Errorf("expected error for unknown model, got nil")
	}
}

func TestTrackScan_EmptyModel(t *testing.T) {
	ct := NewCostTracker()
	err := ct.TrackScan("scan-1", "", 1000, 500)
	if err == nil {
		t.Errorf("expected error for empty model, got nil")
	}
}

func TestCostCalculation_Haiku(t *testing.T) {
	ct := NewCostTracker()
	_ = ct.TrackScan("scan-1", "claude-haiku", 1_000_000, 500_000)

	history := ct.GetScanHistory()
	scan := history[0]

	expectedInput := 1.0 * (0.80 / 1_000_000) * 1_000_000 // $0.80 per 1M input
	expectedOutput := 500_000 * (4.00 / 1_000_000)        // $4.00 per 1M output
	expectedTotal := expectedInput + expectedOutput

	if math.Abs(scan.InputCost-expectedInput) > 0.0001 {
		t.Errorf("input cost mismatch: expected %.6f, got %.6f", expectedInput, scan.InputCost)
	}
	if math.Abs(scan.OutputCost-expectedOutput) > 0.0001 {
		t.Errorf("output cost mismatch: expected %.6f, got %.6f", expectedOutput, scan.OutputCost)
	}
	if math.Abs(scan.TotalCost-expectedTotal) > 0.0001 {
		t.Errorf("total cost mismatch: expected %.6f, got %.6f", expectedTotal, scan.TotalCost)
	}
}

func TestCostCalculation_Sonnet(t *testing.T) {
	ct := NewCostTracker()
	_ = ct.TrackScan("scan-1", "claude-sonnet", 1_000_000, 1_000_000)

	history := ct.GetScanHistory()
	scan := history[0]

	expectedInput := 3.00
	expectedOutput := 15.00
	expectedTotal := 18.00

	if math.Abs(scan.InputCost-expectedInput) > 0.0001 {
		t.Errorf("input cost mismatch: expected %.6f, got %.6f", expectedInput, scan.InputCost)
	}
	if math.Abs(scan.OutputCost-expectedOutput) > 0.0001 {
		t.Errorf("output cost mismatch: expected %.6f, got %.6f", expectedOutput, scan.OutputCost)
	}
	if math.Abs(scan.TotalCost-expectedTotal) > 0.0001 {
		t.Errorf("total cost mismatch: expected %.6f, got %.6f", expectedTotal, scan.TotalCost)
	}
}

func TestCostCalculation_Opus(t *testing.T) {
	ct := NewCostTracker()
	_ = ct.TrackScan("scan-1", "claude-opus", 1_000_000, 1_000_000)

	history := ct.GetScanHistory()
	scan := history[0]

	expectedInput := 15.00
	expectedOutput := 75.00
	expectedTotal := 90.00

	if math.Abs(scan.InputCost-expectedInput) > 0.0001 {
		t.Errorf("input cost mismatch: expected %.6f, got %.6f", expectedInput, scan.InputCost)
	}
	if math.Abs(scan.OutputCost-expectedOutput) > 0.0001 {
		t.Errorf("output cost mismatch: expected %.6f, got %.6f", expectedOutput, scan.OutputCost)
	}
	if math.Abs(scan.TotalCost-expectedTotal) > 0.0001 {
		t.Errorf("total cost mismatch: expected %.6f, got %.6f", expectedTotal, scan.TotalCost)
	}
}

func TestGetDailyCost(t *testing.T) {
	ct := NewCostTracker()
	_ = ct.TrackScan("scan-1", "claude-haiku", 1_000_000, 500_000)
	_ = ct.TrackScan("scan-2", "claude-haiku", 500_000, 250_000)

	daily := ct.GetDailyCost()
	if daily <= 0 {
		t.Errorf("expected positive daily cost, got %.6f", daily)
	}
}

func TestGetMonthlyCost(t *testing.T) {
	ct := NewCostTracker()
	_ = ct.TrackScan("scan-1", "claude-sonnet", 1_000_000, 1_000_000)
	_ = ct.TrackScan("scan-2", "claude-sonnet", 500_000, 500_000)

	monthly := ct.GetMonthlyCost()
	expected := 18.00 + 9.00 // Two scans
	if math.Abs(monthly-expected) > 0.0001 {
		t.Errorf("expected %.6f, got %.6f", expected, monthly)
	}
}

func TestGetCostBreakdown(t *testing.T) {
	ct := NewCostTracker()
	_ = ct.TrackScan("scan-1", "claude-haiku", 1_000_000, 500_000)
	_ = ct.TrackScan("scan-2", "claude-sonnet", 1_000_000, 1_000_000)

	breakdown := ct.GetCostBreakdown()

	if breakdown.TotalScans != 2 {
		t.Errorf("expected 2 scans, got %d", breakdown.TotalScans)
	}

	if len(breakdown.ByModel) != 2 {
		t.Errorf("expected 2 models in breakdown, got %d", len(breakdown.ByModel))
	}

	if _, ok := breakdown.ByModel["claude-haiku"]; !ok {
		t.Errorf("expected claude-haiku in breakdown")
	}

	if _, ok := breakdown.ByModel["claude-sonnet"]; !ok {
		t.Errorf("expected claude-sonnet in breakdown")
	}

	if breakdown.TotalCost <= 0 {
		t.Errorf("expected positive total cost, got %.6f", breakdown.TotalCost)
	}
}

func TestIsWithinBudget_True(t *testing.T) {
	ct := NewCostTracker()
	_ = ct.TrackScan("scan-1", "claude-haiku", 100_000, 50_000)

	within := ct.IsWithinBudget(10.00)
	if !within {
		t.Errorf("expected to be within $10 budget")
	}
}

func TestIsWithinBudget_False(t *testing.T) {
	ct := NewCostTracker()
	_ = ct.TrackScan("scan-1", "claude-opus", 1_000_000, 1_000_000)

	within := ct.IsWithinBudget(1.00)
	if within {
		t.Errorf("expected to exceed $1 budget")
	}
}

func TestIsWithinBudget_Exact(t *testing.T) {
	ct := NewCostTracker()
	_ = ct.TrackScan("scan-1", "claude-haiku", 1_000_000, 500_000)

	daily := ct.GetDailyCost()
	within := ct.IsWithinBudget(daily)
	if !within {
		t.Errorf("expected to be within exact budget")
	}
}

func TestMultipleScans_SameDay(t *testing.T) {
	ct := NewCostTracker()
	for i := 0; i < 5; i++ {
		scanID := fmt.Sprintf("scan-%d", i)
		_ = ct.TrackScan(scanID, "claude-haiku", 100_000, 50_000)
	}

	history := ct.GetScanHistory()
	if len(history) != 5 {
		t.Errorf("expected 5 scans, got %d", len(history))
	}

	breakdown := ct.GetCostBreakdown()
	if breakdown.TotalScans != 5 {
		t.Errorf("expected 5 scans in breakdown, got %d", breakdown.TotalScans)
	}
}

func TestReset(t *testing.T) {
	ct := NewCostTracker()
	_ = ct.TrackScan("scan-1", "claude-haiku", 100_000, 50_000)

	if len(ct.GetScanHistory()) != 1 {
		t.Errorf("expected 1 scan before reset")
	}

	ct.Reset()

	if len(ct.GetScanHistory()) != 0 {
		t.Errorf("expected 0 scans after reset")
	}

	if ct.GetDailyCost() != 0 {
		t.Errorf("expected $0 daily cost after reset")
	}
}

func TestCostBreakdown_ByDay(t *testing.T) {
	ct := NewCostTracker()
	_ = ct.TrackScan("scan-1", "claude-haiku", 100_000, 50_000)

	breakdown := ct.GetCostBreakdown()

	today := time.Now().UTC().Format("2006-01-02")
	if _, ok := breakdown.ByDay[today]; !ok {
		t.Errorf("expected today's date %s in ByDay breakdown", today)
	}
}

func TestScanCost_Metadata(t *testing.T) {
	ct := NewCostTracker()
	_ = ct.TrackScan("scan-test-123", "claude-sonnet", 50_000, 25_000)

	history := ct.GetScanHistory()
	scan := history[0]

	if scan.ScanID != "scan-test-123" {
		t.Errorf("expected scan ID scan-test-123, got %s", scan.ScanID)
	}

	if scan.InputTokens != 50_000 {
		t.Errorf("expected 50000 input tokens, got %d", scan.InputTokens)
	}

	if scan.OutputTokens != 25_000 {
		t.Errorf("expected 25000 output tokens, got %d", scan.OutputTokens)
	}

	if scan.Timestamp.IsZero() {
		t.Errorf("expected non-zero timestamp")
	}
}

func TestConcurrentTracking(t *testing.T) {
	ct := NewCostTracker()

	// Simulate concurrent scan tracking
	done := make(chan bool)
	for i := 0; i < 10; i++ {
		go func(idx int) {
			scanID := fmt.Sprintf("scan-%d", idx)
			_ = ct.TrackScan(scanID, "claude-haiku", 100_000, 50_000)
			done <- true
		}(i)
	}

	for i := 0; i < 10; i++ {
		<-done
	}

	if len(ct.GetScanHistory()) != 10 {
		t.Errorf("expected 10 scans after concurrent tracking, got %d", len(ct.GetScanHistory()))
	}
}
