package audit

import "strings"

// per-million-token rates in USD micros (so $3 = 3_000_000 micros).
// Source: published list prices as of 2026-05-04. Approximate — real
// invoices include cache-read discounts, batch discounts, and Bedrock
// markup. Treat the cost shown in the dashboard as an estimate within
// 20%, not invoice-grade.
//
// Map keys are lowercase substrings matched against model name; first
// match wins. Order matters — put more-specific names first.
var modelPricingMicros = []struct {
	match     string
	inputUSDM int64 // per-million prompt tokens
	outputUSDM int64 // per-million completion tokens
}{
	{"opus", 15_000_000, 75_000_000},
	{"sonnet", 3_000_000, 15_000_000},
	{"haiku", 800_000, 4_000_000},
	{"gpt-4o", 5_000_000, 15_000_000},
	{"gpt-4", 30_000_000, 60_000_000},
	{"gpt-3.5", 500_000, 1_500_000},
	{"gemini-pro", 500_000, 1_500_000},
	{"gemini-flash", 75_000, 300_000},
}

// EstimateCostMicros computes a USD-micros cost estimate. Returns nil
// when the model name doesn't match any known rate (forces the
// dashboard to show 'unknown' rather than a misleading $0.00).
func EstimateCostMicros(model string, promptTokens, completionTokens int) *int64 {
	m := strings.ToLower(model)
	for _, p := range modelPricingMicros {
		if strings.Contains(m, p.match) {
			cost := int64(promptTokens)*p.inputUSDM/1_000_000 +
				int64(completionTokens)*p.outputUSDM/1_000_000
			return &cost
		}
	}
	return nil
}
