package clawpipe

import (
	"fmt"
	"sync"
	"time"
)

// TokenCost defines pricing per model.
var TokenCost = map[string]struct {
	InputCost  float64 // Per 1M input tokens
	OutputCost float64 // Per 1M output tokens
}{
	"claude-opus":   {InputCost: 15.00, OutputCost: 75.00},
	"claude-sonnet": {InputCost: 3.00, OutputCost: 15.00},
	"claude-haiku":  {InputCost: 0.80, OutputCost: 4.00},
}

// ScanCost represents the cost of a single scan.
type ScanCost struct {
	ScanID       string
	Model        string
	InputTokens  int
	OutputTokens int
	InputCost    float64
	OutputCost   float64
	TotalCost    float64
	Timestamp    time.Time
}

// CostBreakdown aggregates costs by model or time period.
type CostBreakdown struct {
	ByModel    map[string]float64
	ByDay      map[string]float64
	TotalCost  float64
	TotalScans int
}

// CostTracker tracks AI analysis costs per scan.
type CostTracker struct {
	mu    sync.RWMutex
	scans []ScanCost
}

// NewCostTracker creates a new cost tracker.
func NewCostTracker() *CostTracker {
	return &CostTracker{
		scans: make([]ScanCost, 0),
	}
}

// TrackScan records a completed scan with token usage and calculates cost.
func (ct *CostTracker) TrackScan(scanID, model string, inputTokens, outputTokens int) error {
	if model == "" {
		return fmt.Errorf("model is required")
	}

	cost, exists := TokenCost[model]
	if !exists {
		return fmt.Errorf("unknown model: %s", model)
	}

	// Calculate costs (convert token counts from units to millions)
	inputCost := float64(inputTokens) * (cost.InputCost / 1_000_000)
	outputCost := float64(outputTokens) * (cost.OutputCost / 1_000_000)
	totalCost := inputCost + outputCost

	ct.mu.Lock()
	defer ct.mu.Unlock()

	ct.scans = append(ct.scans, ScanCost{
		ScanID:       scanID,
		Model:        model,
		InputTokens:  inputTokens,
		OutputTokens: outputTokens,
		InputCost:    inputCost,
		OutputCost:   outputCost,
		TotalCost:    totalCost,
		Timestamp:    time.Now(),
	})

	return nil
}

// GetDailyCost returns total cost for today (UTC).
func (ct *CostTracker) GetDailyCost() float64 {
	ct.mu.RLock()
	defer ct.mu.RUnlock()

	today := time.Now().UTC().Truncate(24 * time.Hour)
	total := 0.0

	for _, scan := range ct.scans {
		if scan.Timestamp.UTC().Truncate(24 * time.Hour).Equal(today) {
			total += scan.TotalCost
		}
	}

	return total
}

// GetMonthlyCost returns total cost for current month (UTC).
func (ct *CostTracker) GetMonthlyCost() float64 {
	ct.mu.RLock()
	defer ct.mu.RUnlock()

	now := time.Now().UTC()
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	total := 0.0

	for _, scan := range ct.scans {
		if !scan.Timestamp.UTC().Before(monthStart) {
			total += scan.TotalCost
		}
	}

	return total
}

// GetCostBreakdown returns a breakdown of costs by model and day.
func (ct *CostTracker) GetCostBreakdown() *CostBreakdown {
	ct.mu.RLock()
	defer ct.mu.RUnlock()

	breakdown := &CostBreakdown{
		ByModel: make(map[string]float64),
		ByDay:   make(map[string]float64),
	}

	for _, scan := range ct.scans {
		breakdown.ByModel[scan.Model] += scan.TotalCost
		day := scan.Timestamp.UTC().Format("2006-01-02")
		breakdown.ByDay[day] += scan.TotalCost
		breakdown.TotalCost += scan.TotalCost
	}

	breakdown.TotalScans = len(ct.scans)
	return breakdown
}

// IsWithinBudget checks if daily spend is under the provided budget (in USD).
func (ct *CostTracker) IsWithinBudget(budget float64) bool {
	return ct.GetDailyCost() <= budget
}

// GetScanHistory returns all recorded scans.
func (ct *CostTracker) GetScanHistory() []ScanCost {
	ct.mu.RLock()
	defer ct.mu.RUnlock()

	history := make([]ScanCost, len(ct.scans))
	copy(history, ct.scans)
	return history
}

// Reset clears all tracked scans (used in testing).
func (ct *CostTracker) Reset() {
	ct.mu.Lock()
	defer ct.mu.Unlock()

	ct.scans = make([]ScanCost, 0)
}
