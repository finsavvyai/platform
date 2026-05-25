package screening

import (
	"math"
	"strings"
	"unicode"
)

// BloomFilter provides fast "definitely not on any list" checks.
type BloomFilter struct {
	bits    []uint64
	nBits   uint
	nHashes uint
	count   int
}

// NewBloom creates a bloom filter sized for expectedItems at fpRate.
func NewBloom(expectedItems int, fpRate float64) *BloomFilter {
	if expectedItems < 1 {
		expectedItems = 1
	}
	if fpRate <= 0 || fpRate >= 1 {
		fpRate = 0.001
	}
	n := float64(expectedItems)
	m := -1.0 * n * math.Log(fpRate) / (math.Log(2) * math.Log(2))
	k := (m / n) * math.Log(2)

	nBits := uint(math.Ceil(m))
	nHashes := uint(math.Ceil(k))
	if nHashes < 1 {
		nHashes = 1
	}
	words := (nBits + 63) / 64
	return &BloomFilter{
		bits:    make([]uint64, words),
		nBits:   nBits,
		nHashes: nHashes,
	}
}

// Add inserts a normalized name into the filter.
func (bf *BloomFilter) Add(item string) {
	item = bloomNormalize(item)
	h1, h2 := bloomHash(item)
	for i := uint(0); i < bf.nHashes; i++ {
		pos := (h1 + i*h2) % bf.nBits
		bf.bits[pos/64] |= 1 << (pos % 64)
	}
	bf.count++
}

// MayContain returns false if item is definitely not in the set.
func (bf *BloomFilter) MayContain(item string) bool {
	item = bloomNormalize(item)
	h1, h2 := bloomHash(item)
	for i := uint(0); i < bf.nHashes; i++ {
		pos := (h1 + i*h2) % bf.nBits
		if bf.bits[pos/64]&(1<<(pos%64)) == 0 {
			return false
		}
	}
	return true
}

// Count returns the number of items added.
func (bf *BloomFilter) Count() int { return bf.count }

// MemoryBytes returns approximate RAM usage.
func (bf *BloomFilter) MemoryBytes() int { return len(bf.bits) * 8 }

// bloomHash produces two independent hashes using FNV-style mixing.
func bloomHash(s string) (uint, uint) {
	var h1, h2 uint
	h1 = 2166136261
	h2 = 84696351
	for _, c := range s {
		h1 ^= uint(c)
		h1 *= 16777619
		h2 ^= uint(c)
		h2 *= 134775813
		h2 += 1
	}
	return h1, h2
}

// bloomNormalize lowercases and strips non-letter/space characters.
func bloomNormalize(s string) string {
	s = strings.ToLower(s)
	return strings.Map(func(r rune) rune {
		if unicode.IsLetter(r) || r == ' ' {
			return r
		}
		return -1
	}, s)
}
