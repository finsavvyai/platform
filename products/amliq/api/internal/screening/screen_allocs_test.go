package screening

import (
	"context"
	"fmt"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

// TestScreen50CandidatesAllocBudget gates the screening hot path's
// allocation count. Wall-time gates are too noisy in shared CI; alloc
// counts are deterministic and catch real regressions (extra slice
// growth, dropped memoization, accidental boxing).
//
// Baselines 2026-04-27 (see docs/perf/benchmarks-2026-04-27.txt):
//   - 1261 allocs/op without -race (raw reference)
//   - ~1597 allocs/op under -race (the mode pushci's test-go runs in)
//
// Cap set at 1800 — covers race-instrumented baseline plus ~13% headroom,
// still fails fast on doubling-class regressions of the hot path.
func TestScreen50CandidatesAllocBudget(t *testing.T) {
	const cap = 1800
	engine := NewEngine(NewWeightedScorer(nil))
	query := mustEntity("Vladimir Putin")
	cands := make([]domain.Entity, 50)
	for i := range cands {
		cands[i] = mustEntity(fmt.Sprintf("Vladimir Putin %d", i))
	}
	ctx := context.Background()
	// Warm any one-time global init.
	if _, err := engine.ScreenWithContext(ctx, domain.TenantID{}, query, cands, nil); err != nil {
		t.Fatalf("warmup: %v", err)
	}
	got := testing.AllocsPerRun(20, func() {
		_, _ = engine.ScreenWithContext(ctx, domain.TenantID{}, query, cands, nil)
	})
	if got > cap {
		t.Fatalf("Screen50Candidates regressed: %.0f allocs/op (cap %d)", got, cap)
	}
}
