package screening

import "testing"

// Cached normalizer + phonetic paths are on every screen's hot loop.
// These tests fail CI if the memoization regresses to the allocating
// path. Hard caps, not perf hints.

func TestNormalizeCachedAllocs(t *testing.T) {
	n := NewNormalizer()
	const name = "PUTIN, Vladimir Vladimirovich (President of Russia)"
	_ = n.Normalize(name) // warm cache
	got := testing.AllocsPerRun(100, func() {
		_ = n.Normalize(name)
	})
	if got > 0 {
		t.Fatalf("Normalize cached path regressed: %.2f allocs/op (cap 0)", got)
	}
}

func TestPhoneticCodesCachedAllocs(t *testing.T) {
	const name = "Vladimir Vladimirovich Putin"
	_ = phoneticCodes(name) // warm cache
	got := testing.AllocsPerRun(100, func() {
		_ = phoneticCodes(name)
	})
	if got > 0 {
		t.Fatalf("phoneticCodes cached path regressed: %.2f allocs/op (cap 0)", got)
	}
}
