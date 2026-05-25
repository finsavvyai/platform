package llm

import (
	"sync"
	"time"

	"github.com/SDLC/llm-gateway/internal/providers"
	"github.com/sirupsen/logrus"
)

const (
	// ColdStartThreshold is the minimum number of observations before
	// the router starts making data-driven decisions.
	ColdStartThreshold = 10

	// DecayWindow controls how aggressively old observations are
	// down-weighted. Observations older than this are discarded.
	DecayWindow = 1 * time.Hour
)

// RouterStats exposes per-provider routing statistics.
type RouterStats struct {
	Provider    string  `json:"provider"`
	Model       string  `json:"model"`
	TotalCalls  int     `json:"total_calls"`
	Successes   int     `json:"successes"`
	SuccessRate float64 `json:"success_rate"`
	AvgLatency  float64 `json:"avg_latency_ms"`
	Score       float64 `json:"score"`
}

// outcome is a single recorded provider call result.
type outcome struct {
	success   bool
	latencyMs int64
	timestamp time.Time
}

// SmartRouter tracks provider outcomes and selects the best provider
// for each request based on success rate and latency.
type SmartRouter struct {
	mu       sync.RWMutex
	outcomes map[string][]outcome // key: "provider:model"
	logger   *logrus.Logger
}

// NewSmartRouter creates a SmartRouter instance.
func NewSmartRouter(logger *logrus.Logger) *SmartRouter {
	return &SmartRouter{
		outcomes: make(map[string][]outcome),
		logger:   logger,
	}
}

// RecordOutcome records the result of a provider call.
func (sr *SmartRouter) RecordOutcome(provider, model string, success bool, latencyMs int64) {
	key := routerKey(provider, model)
	sr.mu.Lock()
	defer sr.mu.Unlock()

	sr.outcomes[key] = append(sr.outcomes[key], outcome{
		success:   success,
		latencyMs: latencyMs,
		timestamp: time.Now(),
	})

	// Prune old entries outside the decay window.
	sr.pruneLockedKey(key)
}

// SelectProvider picks the best provider from the candidate list.
// During cold-start (< ColdStartThreshold observations), the original
// provider order is preserved (first viable provider wins).
func (sr *SmartRouter) SelectProvider(
	model string, candidates []providers.Provider,
) providers.Provider {
	if len(candidates) == 0 {
		return nil
	}

	sr.mu.RLock()
	defer sr.mu.RUnlock()

	type scored struct {
		provider providers.Provider
		score    float64
	}

	var scoredList []scored

	for _, p := range candidates {
		key := routerKey(p.GetName(), model)
		entries := sr.recentLocked(key)

		if len(entries) < ColdStartThreshold {
			// Cold start — return first candidate (preserves priority order).
			sr.logger.WithFields(logrus.Fields{
				"provider":     p.GetName(),
				"observations": len(entries),
			}).Debug("SmartRouter: cold-start, using priority order")
			return candidates[0]
		}

		stats := computeStats(p.GetName(), model, entries)
		scoredList = append(scoredList, scored{provider: p, score: stats.Score})
	}

	if len(scoredList) == 0 {
		return candidates[0]
	}

	best := scoredList[0]
	for _, s := range scoredList[1:] {
		if s.score > best.score {
			best = s
		}
	}

	sr.logger.WithFields(logrus.Fields{
		"selected": best.provider.GetName(),
		"score":    best.score,
	}).Debug("SmartRouter: selected provider")

	return best.provider
}

// GetStats returns current routing statistics per provider+model key.
func (sr *SmartRouter) GetStats() map[string]RouterStats {
	sr.mu.RLock()
	defer sr.mu.RUnlock()

	result := make(map[string]RouterStats, len(sr.outcomes))
	for key, entries := range sr.outcomes {
		recent := filterRecent(entries)
		if len(recent) == 0 {
			continue
		}
		provider, model := parseRouterKey(key)
		result[key] = computeStats(provider, model, recent)
	}
	return result
}

// --- internal helpers (see smart_router_stats.go for computeStats) ---

func routerKey(provider, model string) string {
	return provider + ":" + model
}

func (sr *SmartRouter) pruneLockedKey(key string) {
	sr.outcomes[key] = filterRecent(sr.outcomes[key])
}

func (sr *SmartRouter) recentLocked(key string) []outcome {
	return filterRecent(sr.outcomes[key])
}
