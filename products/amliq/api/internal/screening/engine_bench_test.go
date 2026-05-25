package screening

import (
	"context"
	"fmt"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

// BenchmarkScreen50Candidates measures the hot path that the API
// handler takes for every synchronous screen. 50 candidates is the
// value QuickSearch passes. Tracks regressions on normalization +
// matcher preallocation + phonetic memoization.
func BenchmarkScreen50Candidates(b *testing.B) {
	engine := NewEngine(NewWeightedScorer(nil))
	query := mustEntity("Vladimir Putin")
	cands := make([]domain.Entity, 50)
	for i := range cands {
		cands[i] = mustEntity(fmt.Sprintf("Vladimir Putin %d", i))
	}
	ctx := context.Background()
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, err := engine.ScreenWithContext(ctx, domain.TenantID{}, query, cands, nil); err != nil {
			b.Fatalf("Screen: %v", err)
		}
	}
}

// BenchmarkNormalize_Cached covers the shared-normalizer memoization.
// Second+ call for the same string must be ~constant-time.
func BenchmarkNormalize_Cached(b *testing.B) {
	n := NewNormalizer()
	const name = "PUTIN, Vladimir Vladimirovich (President of Russia)"
	_ = n.Normalize(name) // warm the cache
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = n.Normalize(name)
	}
}

// BenchmarkPhoneticCodes_Cached covers the phoneticCodesCache.
// Second+ call for the same string must be ~constant-time.
func BenchmarkPhoneticCodes_Cached(b *testing.B) {
	const name = "Vladimir Vladimirovich Putin"
	_ = phoneticCodes(name) // warm
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = phoneticCodes(name)
	}
}

func mustEntity(name string) domain.Entity {
	n, _ := domain.NewName(name, "", "", "")
	id, _ := domain.NewEntityID("ent_" + nameHash(name))
	e, _ := domain.NewEntity(id, domain.EntityTypeIndividual, []domain.Name{n})
	return e
}

func nameHash(s string) string {
	// Deterministic 12-char hex ID for test entities.
	const hex = "0123456789abcdef"
	var out [12]byte
	for i := 0; i < 12; i++ {
		if i < len(s) {
			out[i] = hex[int(s[i])%16]
		} else {
			out[i] = '0'
		}
	}
	return string(out[:])
}
