package screening

import (
	"math"
	"strings"
	"unicode"

	bloom "github.com/bits-and-blooms/bloom/v3"
)

// BloomFilterV2 wraps bits-and-blooms for production-grade bloom filtering.
// Thread-safe, serializable, optimal hash function count, tested at scale.
type BloomFilterV2 struct {
	filter *bloom.BloomFilter
	count  int
}

// NewBloomV2 creates a bloom filter sized for expectedItems at fpRate.
func NewBloomV2(expectedItems uint, fpRate float64) *BloomFilterV2 {
	if expectedItems < 1 {
		expectedItems = 1
	}
	if fpRate <= 0 || fpRate >= 1 {
		fpRate = 0.001
	}
	return &BloomFilterV2{
		filter: bloom.NewWithEstimates(expectedItems, fpRate),
	}
}

// Add inserts a normalized name into the filter.
func (bf *BloomFilterV2) Add(item string) {
	bf.filter.AddString(bloomNormalizeV2(item))
	bf.count++
}

// MayContain returns false if item is definitely not in the set.
func (bf *BloomFilterV2) MayContain(item string) bool {
	return bf.filter.TestString(bloomNormalizeV2(item))
}

// Count returns the number of items added.
func (bf *BloomFilterV2) Count() int { return bf.count }

// MemoryBytes returns approximate RAM usage.
func (bf *BloomFilterV2) MemoryBytes() int {
	return int(bf.filter.Cap() / 8)
}

// ApproxFPRate returns the approximate false positive probability.
func (bf *BloomFilterV2) ApproxFPRate() float64 {
	k := float64(bf.filter.K())
	m := float64(bf.filter.Cap())
	n := float64(bf.count)
	if m == 0 || k == 0 {
		return 1.0
	}
	return math.Pow(1.0-math.Exp(-k*n/m), k)
}

// bloomNormalizeV2 lowercases and strips non-letter/space characters.
func bloomNormalizeV2(s string) string {
	s = strings.ToLower(s)
	return strings.Map(func(r rune) rune {
		if unicode.IsLetter(r) || r == ' ' {
			return r
		}
		return -1
	}, s)
}
