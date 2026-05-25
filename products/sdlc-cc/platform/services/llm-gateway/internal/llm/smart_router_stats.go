package llm

import (
	"math"
	"time"
)

// parseRouterKey splits a "provider:model" key into its components.
func parseRouterKey(key string) (provider, model string) {
	for i := 0; i < len(key); i++ {
		if key[i] == ':' {
			return key[:i], key[i+1:]
		}
	}
	return key, ""
}

// filterRecent returns only outcomes within the DecayWindow.
func filterRecent(entries []outcome) []outcome {
	cutoff := time.Now().Add(-DecayWindow)
	var result []outcome
	for _, e := range entries {
		if e.timestamp.After(cutoff) {
			result = append(result, e)
		}
	}
	return result
}

// computeStats calculates routing statistics from a set of outcomes.
// Score formula: success_rate * (1 / normalized_latency)
// where normalized_latency = avgLatency / maxLatency (0-1 range).
func computeStats(provider, model string, entries []outcome) RouterStats {
	total := len(entries)
	if total == 0 {
		return RouterStats{Provider: provider, Model: model}
	}

	successes := 0
	var totalLatency int64
	var maxLatency int64

	for _, e := range entries {
		if e.success {
			successes++
		}
		totalLatency += e.latencyMs
		if e.latencyMs > maxLatency {
			maxLatency = e.latencyMs
		}
	}

	successRate := float64(successes) / float64(total)
	avgLatency := float64(totalLatency) / float64(total)

	// Score = success_rate * (1 / normalized_latency).
	// Avoid division by zero.
	var score float64
	if maxLatency > 0 {
		normalizedLatency := avgLatency / float64(maxLatency)
		if normalizedLatency > 0 {
			score = successRate * (1.0 / normalizedLatency)
		}
	}

	// Clamp to avoid infinity from very low latency.
	score = math.Min(score, 1000)

	return RouterStats{
		Provider:    provider,
		Model:       model,
		TotalCalls:  total,
		Successes:   successes,
		SuccessRate: successRate,
		AvgLatency:  avgLatency,
		Score:       score,
	}
}
