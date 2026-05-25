package marketing

import "testing"

// TestCanonicalIsInternallyConsistent guards against the marketing
// drift documented in the May 8 onboarding audit (different latency
// numbers across landing, llms.txt, og:description). Asserts the
// claims set is well-formed, not that the numbers themselves are
// correct — those are reviewed in the PR that touches Canonical().
func TestCanonicalIsInternallyConsistent(t *testing.T) {
	c := Canonical()
	if c.ProductName == "" || c.Tagline == "" || c.DomainCanonical == "" {
		t.Error("brand fields must be populated")
	}
	if c.ListCount <= 0 || c.EntityCount <= 0 {
		t.Errorf("list_count=%d entity_count=%d, both must be positive",
			c.ListCount, c.EntityCount)
	}
	if c.LatencyP50Microseconds <= 0 || c.LatencyTargetMs <= 0 {
		t.Error("latency claims must be positive")
	}
	if c.LatencyP50Microseconds >= c.LatencyTargetMs*1000 {
		t.Errorf("p50 (%dµs) must be well under target (%dms)",
			c.LatencyP50Microseconds, c.LatencyTargetMs)
	}
	if c.FreeDailyScreenings <= 0 {
		t.Error("free_daily_screenings must be positive")
	}
	if c.StarterPriceUSD <= 0 || c.ProPriceUSD <= 0 {
		t.Error("starter and pro prices must be positive")
	}
	if c.StarterPriceUSD >= c.ProPriceUSD {
		t.Errorf("starter (%d) must be cheaper than pro (%d)",
			c.StarterPriceUSD, c.ProPriceUSD)
	}
	if c.UpgradeURL == "" || c.DocsURL == "" {
		t.Error("upgrade and docs URLs must be set")
	}
}
