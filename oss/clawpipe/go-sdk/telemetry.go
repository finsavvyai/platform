package clawpipe

import (
	"math"
	"sort"
	"sync"
	"time"
)

// costTable maps "provider:model" to cost per token (input).
var costTable = map[string]float64{
	"deepseek:deepseek-chat":    0.00014,
	"openai:gpt-4o-mini":       0.00015,
	"anthropic:claude-3-haiku":  0.00025,
	"openai:gpt-4o":            0.0025,
	"anthropic:claude-sonnet-4": 0.003,
	"anthropic:claude-opus-4":   0.015,
	"groq:llama-3.1-70b":       0.00059,
	"mistral:mistral-large":    0.002,
}

type requestRecord struct {
	Provider  string
	Model     string
	TokensIn  int
	TokensOut int
	LatencyMs int64
	CostUsd   float64
	Cached    bool
	Boosted   bool
	Timestamp int64
}

// Telemetry tracks per-request metrics.
type Telemetry struct {
	mu         sync.Mutex
	records    []requestRecord
	maxRecords int
}

// NewTelemetry creates a Telemetry tracker.
func NewTelemetry(maxRecords int) *Telemetry {
	if maxRecords <= 0 {
		maxRecords = 10_000
	}
	return &Telemetry{maxRecords: maxRecords}
}

// EstimateCost returns estimated cost in USD.
func (t *Telemetry) EstimateCost(provider, model string, tokIn, tokOut int) float64 {
	key := provider + ":" + model
	rate, ok := costTable[key]
	if !ok {
		rate = 0.001
	}
	return float64(tokIn+tokOut) / 1000 * rate
}

// Record adds a completed request to the log.
func (t *Telemetry) Record(r requestRecord) {
	t.mu.Lock()
	defer t.mu.Unlock()
	if len(t.records) >= t.maxRecords {
		half := len(t.records) / 2
		t.records = t.records[half:]
	}
	r.Timestamp = time.Now().UnixMilli()
	t.records = append(t.records, r)
}

// Snapshot returns aggregate telemetry stats.
func (t *Telemetry) Snapshot() TelemetrySnapshot {
	t.mu.Lock()
	defer t.mu.Unlock()
	n := len(t.records)
	if n == 0 {
		return TelemetrySnapshot{CacheHitRate: "0.0%"}
	}
	var tokIn, tokOut int
	var cost float64
	var latency int64
	var cacheH, boostH int
	ms := map[string]*ModelCallSum{}
	for _, r := range t.records {
		tokIn += r.TokensIn
		tokOut += r.TokensOut
		cost += r.CostUsd
		latency += r.LatencyMs
		if r.Cached {
			cacheH++
		}
		if r.Boosted {
			boostH++
		}
		k := r.Provider + ":" + r.Model
		if ms[k] == nil {
			ms[k] = &ModelCallSum{Model: k}
		}
		ms[k].Calls++
		ms[k].Cost += r.CostUsd
	}
	top := make([]ModelCallSum, 0, len(ms))
	for _, v := range ms {
		top = append(top, *v)
	}
	sort.Slice(top, func(i, j int) bool { return top[i].Calls > top[j].Calls })
	if len(top) > 5 {
		top = top[:5]
	}
	hr := float64(cacheH) / float64(n) * 100
	return TelemetrySnapshot{
		TotalRequests:     n,
		TotalTokensIn:     tokIn,
		TotalTokensOut:    tokOut,
		TotalCostUsd:      math.Round(cost*10000) / 10000,
		TotalSavedByCache: cacheH,
		TotalSavedByBoost: boostH,
		AvgLatencyMs:      latency / int64(n),
		CacheHitRate:      formatPct(hr) + "%",
		TopModels:         top,
	}
}

// Reset clears all records.
func (t *Telemetry) Reset() {
	t.mu.Lock()
	t.records = nil
	t.mu.Unlock()
}
