package metrics

import (
	"os"
	"strings"

	"github.com/prometheus/client_golang/prometheus"
)

// Per-1M-token USD pricing. Snapshot 2026-05. Mirrors
// opensyber/packages/claw-sdk/src/pricing.ts — keep in sync when contracts
// move. Only models actually routable from PickModel are listed; unknown
// models fall through to claude-sonnet pricing as a safe upper bound.
var modelPricing = map[string]struct{ in, out float64 }{
	"claude-opus":      {15.00, 75.00},
	"claude-sonnet":    {3.00, 15.00},
	"claude-haiku":     {0.80, 4.00},
	"deepseek-chat":    {0.14, 0.28},
	"gemini-2.0-flash": {0.075, 0.30},
}

var (
	modelCallsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "pipewarden_model_calls_total",
			Help: "Total AI model calls, labelled by model and routing mode (premium|cheap).",
		},
		[]string{"model", "mode"},
	)

	modelTokensTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "pipewarden_model_tokens_total",
			Help: "Total tokens consumed, labelled by model and direction (input|output).",
		},
		[]string{"model", "direction"},
	)

	modelCostUSDTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "pipewarden_model_cost_usd_total",
			Help: "Cumulative model spend in USD, labelled by model.",
		},
		[]string{"model"},
	)

	modelSavingsUSDTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "pipewarden_model_savings_usd_total",
			Help: "Cumulative USD saved by routing to a cheaper model than the premium baseline (claude-sonnet).",
		},
	)
)

func init() {
	prometheus.MustRegister(modelCallsTotal, modelTokensTotal, modelCostUSDTotal, modelSavingsUSDTotal)
}

// RecordModelCall records a single AI model invocation: increments call
// + token + cost counters, and credits the savings counter when the
// routed model is cheaper than the premium baseline (claude-sonnet).
func RecordModelCall(model string, inputTokens, outputTokens int) {
	if model == "" {
		return
	}
	mode := "premium"
	if isCheapMode() {
		mode = "cheap"
	}
	modelCallsTotal.WithLabelValues(model, mode).Inc()
	modelTokensTotal.WithLabelValues(model, "input").Add(float64(inputTokens))
	modelTokensTotal.WithLabelValues(model, "output").Add(float64(outputTokens))

	cost := estimateCost(model, inputTokens, outputTokens)
	modelCostUSDTotal.WithLabelValues(model).Add(cost)

	baseline := estimateCost("claude-sonnet", inputTokens, outputTokens)
	if baseline > cost {
		modelSavingsUSDTotal.Add(baseline - cost)
	}

	recordModelStats(model, mode, inputTokens, outputTokens, cost)
}

func estimateCost(model string, in, out int) float64 {
	p, ok := modelPricing[model]
	if !ok {
		p = modelPricing["claude-sonnet"]
	}
	return (float64(in)*p.in + float64(out)*p.out) / 1_000_000
}

func isCheapMode() bool {
	v := strings.ToLower(os.Getenv("PIPEWARDEN_CHEAP_MODE"))
	return v == "1" || v == "true"
}
