package screening

import (
	"context"

	"github.com/aegis-aml/aegis/internal/domain"
)

// EmbeddingLayer is the engine-facing contract for the embedding cascade.
// Implementations: PgvectorMatcher (production, DB-backed) and
// InMemoryEmbeddingMatcher (offline / public-demo).
type EmbeddingLayer interface {
	MatchWithContext(
		ctx context.Context,
		tenantID domain.TenantID,
		query domain.Name,
	) ([]domain.MatchEvidence, error)
}

// InMemoryEmbeddingMatcher computes character-trigram cosine similarity
// between a query and a pre-registered corpus. Designed for the
// public-demo offline path: no DB, no network, deterministic.
//
// Vector encoding: each name is normalised via normalizeExact (lowercase
// + strip punct + collapse whitespace) then padded and decomposed into
// character trigrams (e.g. "putin" -> "  p", " pu", "put", "uti", "tin",
// "in ", "n  "). Each trigram is hashed via FNV-1a into a fixed-dim
// bucket array; the bucket counts form the raw vector. Cosine similarity
// re-uses the package-level cosineSimilarity helper.
type InMemoryEmbeddingMatcher struct {
	dim       int
	threshold float64
	corpus    []embCandidate
}

type embCandidate struct {
	name string
	vec  []float64
}

// NewInMemoryEmbeddingMatcher returns a matcher with the given vector
// dim and cosine threshold. Zero / negative values fall back to defaults
// (256-dim, threshold 0.62 — empirically the cut between aliased and
// unrelated names for character trigrams).
func NewInMemoryEmbeddingMatcher(dim int, threshold float64) *InMemoryEmbeddingMatcher {
	if dim <= 0 {
		dim = 256
	}
	if threshold <= 0 {
		threshold = 0.62
	}
	return &InMemoryEmbeddingMatcher{dim: dim, threshold: threshold}
}

// SetCandidates registers the corpus of candidate names. Idempotent —
// successive calls replace the corpus. Names are stored verbatim so the
// emitted MatchEvidence.MatchedValue equals a candidate Name.Full, which
// is the key filterEvidenceForEntity uses to attribute evidence to an
// entity. Empty names and names that normalise to "" are skipped.
func (m *InMemoryEmbeddingMatcher) SetCandidates(names []string) {
	if cap(m.corpus) >= len(names) {
		m.corpus = m.corpus[:0]
	} else {
		m.corpus = make([]embCandidate, 0, len(names))
	}
	seen := make(map[string]struct{}, len(names))
	for _, n := range names {
		if _, dup := seen[n]; dup {
			continue
		}
		v := m.vectorize(n)
		if len(v) == 0 {
			continue
		}
		seen[n] = struct{}{}
		m.corpus = append(m.corpus, embCandidate{name: n, vec: v})
	}
}

// CorpusSize returns the number of registered candidates. Useful for
// tests; not part of EmbeddingLayer.
func (m *InMemoryEmbeddingMatcher) CorpusSize() int {
	return len(m.corpus)
}

// MatchWithContext satisfies EmbeddingLayer. The tenantID argument is
// ignored here — the in-memory matcher has no multi-tenant slicing.
// Returns nil evidence (not an error) for an empty query, empty corpus,
// or sub-threshold cosine across the board.
func (m *InMemoryEmbeddingMatcher) MatchWithContext(
	_ context.Context, _ domain.TenantID, query domain.Name,
) ([]domain.MatchEvidence, error) {
	qv := m.vectorize(query.Full)
	if len(qv) == 0 || len(m.corpus) == 0 {
		return nil, nil
	}
	out := make([]domain.MatchEvidence, 0, 4)
	for _, c := range m.corpus {
		score := cosineSimilarity(qv, c.vec)
		if score < m.threshold {
			continue
		}
		out = append(out, domain.NewMatchEvidence(
			domain.MatchLayerEmbedding,
			"trigram_cosine",
			score,
			m.threshold,
			query.Full,
			c.name,
			"Character-trigram cosine embedding",
		))
	}
	return out, nil
}

// vectorize converts a name into its trigram bucket vector. The input is
// first normalised so "Kim Jong-un", "kim jong un", and "  Kim Jong-Un "
// share identical vectors.
func (m *InMemoryEmbeddingMatcher) vectorize(s string) []float64 {
	s = normalizeExact(s)
	if s == "" {
		return nil
	}
	padded := "  " + s + "  "
	runes := []rune(padded)
	if len(runes) < 3 {
		return nil
	}
	vec := make([]float64, m.dim)
	for i := 0; i+3 <= len(runes); i++ {
		tri := string(runes[i : i+3])
		h := fnv1aHash(tri) % uint32(m.dim)
		vec[h] += 1.0
	}
	return vec
}

// fnv1aHash is an inlined 32-bit FNV-1a. hash/fnv would work but
// inlining keeps the file self-contained and the call hot-loop branch
// free.
func fnv1aHash(s string) uint32 {
	var h uint32 = 2166136261
	for i := 0; i < len(s); i++ {
		h ^= uint32(s[i])
		h *= 16777619
	}
	return h
}
