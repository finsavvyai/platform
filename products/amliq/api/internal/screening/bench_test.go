package screening

import (
	"testing"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

var benchNames = []domain.Name{
	{Full: "VLADIMIR VLADIMIROVICH PUTIN"},
	{Full: "KIM JONG UN"},
	{Full: "ALI KHAMENEI"},
	{Full: "HASSAN NASRALLAH"},
	{Full: "BASHAR AL ASSAD"},
	{Full: "NICOLAS MADURO MOROS"},
	{Full: "ALEXANDER LUKASHENKO"},
	{Full: "MUAMMAR GADDAFI"},
	{Full: "OSAMA BIN LADEN"},
	{Full: "SADDAM HUSSEIN"},
}

var benchQuery = domain.Name{Full: "Vladimir Putin"}

func BenchmarkJaroWinkler(b *testing.B) {
	for i := 0; i < b.N; i++ {
		jaroWinklerSimilarity("vladimir putin", "vladimir vladimirovich putin")
	}
}

func BenchmarkJaroSimilarity(b *testing.B) {
	for i := 0; i < b.N; i++ {
		jaroSimilarity("vladimir putin", "vladimir vladimirovich putin")
	}
}

func BenchmarkSoundexCode(b *testing.B) {
	for i := 0; i < b.N; i++ {
		soundexCode("VLADIMIR")
	}
}

func BenchmarkMetaphoneCode(b *testing.B) {
	for i := 0; i < b.N; i++ {
		metaphoneCode("VLADIMIR")
	}
}

func BenchmarkNormalize(b *testing.B) {
	n := NewNormalizer()
	for i := 0; i < b.N; i++ {
		n.Normalize("VLADIMIR VLADIMIROVICH PUTIN, Jr.")
	}
}

func BenchmarkNormalizeExact(b *testing.B) {
	for i := 0; i < b.N; i++ {
		normalizeExact("VLADIMIR VLADIMIROVICH PUTIN, Jr.")
	}
}

func BenchmarkExactMatcher(b *testing.B) {
	m := NewExactMatcher()
	for i := 0; i < b.N; i++ {
		m.Match(benchQuery, benchNames)
	}
}

func BenchmarkFuzzyMatcher(b *testing.B) {
	m := NewFuzzyMatcher(0.75)
	for i := 0; i < b.N; i++ {
		m.Match(benchQuery, benchNames)
	}
}

func BenchmarkPhoneticMatcher(b *testing.B) {
	m := NewPhoneticMatcher()
	for i := 0; i < b.N; i++ {
		m.Match(benchQuery, benchNames)
	}
}

func BenchmarkTokenMatcher(b *testing.B) {
	m := NewTokenMatcher()
	for i := 0; i < b.N; i++ {
		m.Match(benchQuery, benchNames)
	}
}

func BenchmarkBloomFilter_Add(b *testing.B) {
	bf := NewBloom(100000, 0.001)
	for i := 0; i < b.N; i++ {
		bf.Add("vladimir putin")
	}
}

func BenchmarkBloomFilter_MayContain(b *testing.B) {
	bf := NewBloom(100000, 0.001)
	for i := 0; i < 10000; i++ {
		bf.Add("name_" + string(rune(i+'a')))
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		bf.MayContain("vladimir putin")
	}
}

func BenchmarkLRUCache_Set(b *testing.B) {
	c := NewLRUCache(10000, 5*time.Minute)
	candidates := []Candidate{{Score: 0.9, Source: "test"}}
	for i := 0; i < b.N; i++ {
		c.Set("key", candidates)
	}
}

func BenchmarkLRUCache_Get(b *testing.B) {
	c := NewLRUCache(10000, 5*time.Minute)
	candidates := []Candidate{{Score: 0.9, Source: "test"}}
	c.Set("key", candidates)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		c.Get("key")
	}
}

func BenchmarkBestWordMatch(b *testing.B) {
	for i := 0; i < b.N; i++ {
		bestWordMatch("putin", "vladimir vladimirovich putin")
	}
}

func BenchmarkRRF(b *testing.B) {
	dense := make([]SearchResult, 100)
	sparse := make([]SearchResult, 100)
	for i := 0; i < 100; i++ {
		id := string(rune('A' + i%26))
		dense[i] = SearchResult{EntityID: "d_" + id, Score: float64(100-i) / 100}
		sparse[i] = SearchResult{EntityID: "s_" + id, Score: float64(100-i) / 100}
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ReciprocalRankFusion(dense, sparse, 10, 60)
	}
}

func BenchmarkBloomNormalize(b *testing.B) {
	for i := 0; i < b.N; i++ {
		bloomNormalize("VLADIMIR VLADIMIROVICH PUTIN, Jr.")
	}
}

func BenchmarkPhoneticCodes(b *testing.B) {
	for i := 0; i < b.N; i++ {
		phoneticCodes("VLADIMIR VLADIMIROVICH PUTIN")
	}
}
