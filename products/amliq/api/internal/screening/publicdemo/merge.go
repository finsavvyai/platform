package publicdemo

import (
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// collectCandidateNames flattens every Name on every Entity into a
// single de-duplicated slice of display strings. Used by the handler to
// populate the in-memory embedding matcher's corpus before each engine
// pass. Primary names AND aliases are included so the embedding layer
// can match a query against either form.
func collectCandidateNames(ents []domain.Entity) []string {
	if len(ents) == 0 {
		return nil
	}
	seen := make(map[string]struct{}, len(ents)*2)
	out := make([]string, 0, len(ents)*2)
	for _, e := range ents {
		for _, n := range e.Names {
			full := strings.TrimSpace(n.Full)
			if full == "" {
				continue
			}
			if _, dup := seen[full]; dup {
				continue
			}
			seen[full] = struct{}{}
			out = append(out, full)
		}
	}
	return out
}

// mergeMatches merges a new batch of matches into an accumulator,
// deduping on EntityID. For an entity already present the higher
// confidence wins; layer rows are unioned (best score per layer name).
// Used by the variant-expansion loop in runScreening so multiple engine
// passes collapse cleanly into a single matches[] slice in the
// response, and the response stays deterministic regardless of variant
// order.
func mergeMatches(prev, next []Match) []Match {
	if len(prev) == 0 {
		return next
	}
	if len(next) == 0 {
		return prev
	}
	idx := make(map[string]int, len(prev))
	for i, m := range prev {
		idx[m.EntityID] = i
	}
	for _, m := range next {
		i, ok := idx[m.EntityID]
		if !ok {
			idx[m.EntityID] = len(prev)
			prev = append(prev, m)
			continue
		}
		if m.Confidence > prev[i].Confidence {
			prev[i].Confidence = m.Confidence
		}
		prev[i].Layers = unionLayers(prev[i].Layers, m.Layers)
	}
	return prev
}

// unionLayers keeps the highest-scoring entry per layer name across the
// two slices. Output order matches projectLayers (Exact, Fuzzy,
// Phonetic, Token, Embedding) for determinism.
func unionLayers(a, b []LayerResult) []LayerResult {
	best := map[string]LayerResult{}
	for _, lr := range a {
		best[lr.Layer] = lr
	}
	for _, lr := range b {
		cur, ok := best[lr.Layer]
		if !ok || lr.Score > cur.Score {
			best[lr.Layer] = lr
		}
	}
	out := make([]LayerResult, 0, len(best))
	for _, layer := range []string{"Exact", "Fuzzy", "Phonetic", "Token", "Embedding"} {
		if lr, ok := best[layer]; ok {
			out = append(out, lr)
		}
	}
	return out
}
