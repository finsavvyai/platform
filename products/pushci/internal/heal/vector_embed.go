package heal

// Hashing-based embedder (Option C). Deterministic, pure-Go,
// zero-dependency. Tokenize -> FNV-1a hash into a fixed-width
// float bucket -> L2 normalize. Good enough to cluster near-duplicate
// failure strings; will miss paraphrased semantics. Upgrade to a real
// neural embedder in v1.8.0 (see vector.go header comment).

import (
	"hash/fnv"
	"math"
	"strings"
	"unicode"
)

// embedDim is the output dimension. 256 keeps JSON files small
// while preserving enough bucket resolution for CI error strings.
const embedDim = 256

// hashEmbed turns free text into a unit vector deterministically.
func hashEmbed(text string) []float32 {
	vec := make([]float32, embedDim)
	for _, tok := range tokenize(text) {
		h := fnv.New32a()
		h.Write([]byte(tok))
		s := h.Sum32()
		idx := int(s % embedDim)
		// Sign bit: +1 / -1 deterministically from the high bit.
		// This gives the embedding a signed component so anti-
		// correlated tokens can cancel instead of always accumulating.
		if s&0x80000000 != 0 {
			vec[idx] -= 1
		} else {
			vec[idx] += 1
		}
	}
	return normalize(vec)
}

// tokenize lowercases and splits text into alphanumeric runs of >=2 chars.
func tokenize(s string) []string {
	s = strings.ToLower(s)
	var toks []string
	var b strings.Builder
	flush := func() {
		if b.Len() >= 2 {
			toks = append(toks, b.String())
		}
		b.Reset()
	}
	for _, r := range s {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
		} else {
			flush()
		}
	}
	flush()
	return toks
}

func normalize(v []float32) []float32 {
	var sum float64
	for _, x := range v {
		sum += float64(x) * float64(x)
	}
	n := math.Sqrt(sum)
	if n == 0 {
		return v
	}
	out := make([]float32, len(v))
	for i, x := range v {
		out[i] = float32(float64(x) / n)
	}
	return out
}

// cosine returns cosine similarity for two unit vectors (or raw dot product).
func cosine(a, b []float32) float64 {
	if len(a) != len(b) {
		return 0
	}
	var dot float64
	for i := range a {
		dot += float64(a[i]) * float64(b[i])
	}
	return dot
}
