package metrics

import (
	"sort"
	"sync"

	dto "github.com/prometheus/client_model/go"
)

// CostSummary is the JSON shape returned by GET /api/v1/cost-summary.
// All values are cumulative since process start. Mode counts let the
// dashboard render a "calls saved by cheap routing" widget.
type CostSummary struct {
	Mode       string           `json:"mode"`
	TotalCalls float64          `json:"total_calls"`
	CheapCalls float64          `json:"cheap_calls"`
	SpendUSD   float64          `json:"spend_usd"`
	SavingsUSD float64          `json:"savings_usd"`
	ByModel    []ModelCostEntry `json:"by_model"`
}

// ModelCostEntry is per-model spend breakdown.
type ModelCostEntry struct {
	Model     string  `json:"model"`
	Calls     float64 `json:"calls"`
	InTokens  float64 `json:"input_tokens"`
	OutTokens float64 `json:"output_tokens"`
	SpendUSD  float64 `json:"spend_usd"`
}

// modelStats is the in-process mirror of the Prometheus per-model counters.
// Updated by RecordModelCall under modelStatsMu so Snapshot can return a
// consistent view without scraping the registry.
var (
	modelStatsMu    sync.Mutex
	modelStats      = map[string]*ModelCostEntry{}
	modelStatsTotal CostSummary
)

// recordModelStats updates the in-process mirror. Call from RecordModelCall
// after the Prometheus counters have advanced. Tokens passed as int to
// match the recorder signature; cost in USD is computed at call time.
func recordModelStats(model, mode string, in, out int, cost float64) {
	modelStatsMu.Lock()
	defer modelStatsMu.Unlock()
	e, ok := modelStats[model]
	if !ok {
		e = &ModelCostEntry{Model: model}
		modelStats[model] = e
	}
	e.Calls++
	e.InTokens += float64(in)
	e.OutTokens += float64(out)
	e.SpendUSD += cost
	modelStatsTotal.TotalCalls++
	if mode == "cheap" {
		modelStatsTotal.CheapCalls++
	}
	modelStatsTotal.SpendUSD += cost
}

// Snapshot returns the current per-model and aggregate spend totals.
// Cheap to call (single mutex acquire + map copy).
func Snapshot() CostSummary {
	modelStatsMu.Lock()
	defer modelStatsMu.Unlock()

	out := CostSummary{
		Mode:       modeLabel(),
		TotalCalls: modelStatsTotal.TotalCalls,
		CheapCalls: modelStatsTotal.CheapCalls,
		SpendUSD:   modelStatsTotal.SpendUSD,
		SavingsUSD: counterValue(modelSavingsUSDTotal),
		ByModel:    make([]ModelCostEntry, 0, len(modelStats)),
	}
	for _, e := range modelStats {
		out.ByModel = append(out.ByModel, *e)
	}
	sort.Slice(out.ByModel, func(i, j int) bool {
		return out.ByModel[i].SpendUSD > out.ByModel[j].SpendUSD
	})
	return out
}

func modeLabel() string {
	if isCheapMode() {
		return "cheap"
	}
	return "premium"
}

func counterValue(c interface {
	Write(*dto.Metric) error
}) float64 {
	m := &dto.Metric{}
	if err := c.Write(m); err != nil {
		return 0
	}
	return m.GetCounter().GetValue()
}

// resetForTest resets the in-process stats. Test-only helper.
func resetForTest() {
	modelStatsMu.Lock()
	defer modelStatsMu.Unlock()
	modelStats = map[string]*ModelCostEntry{}
	modelStatsTotal = CostSummary{}
}
