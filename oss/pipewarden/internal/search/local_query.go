package search

import (
	"math"
	"sort"
	"strings"
)

// SearchMode selects the scoring strategy. The default is "hybrid".
type SearchMode string

const (
	ModeKeyword  SearchMode = "keyword"  // BM25 only
	ModeSemantic SearchMode = "semantic" // char-trigram cosine only
	ModeHybrid   SearchMode = "hybrid"   // 0.5 * BM25 + 0.5 * cosine, both normalized
)

// k1 and b are the standard BM25 tuning constants. Defaults from the
// original paper; both can be tuned later if recall/precision shifts.
const (
	bm25k1 = 1.2
	bm25b  = 0.75
)

// Search scores all documents against the query and returns the top k
// hits (ordered by score, highest first). k <= 0 means no cap.
func (i *LocalIndex) Search(q string, mode SearchMode, k int) []LocalHit {
	q = strings.TrimSpace(q)
	if q == "" {
		return nil
	}
	if mode == "" {
		mode = ModeHybrid
	}

	queryTokens := tokenize(q)
	queryTris := trigrams(q)

	i.mu.RLock()
	defer i.mu.RUnlock()

	if len(i.docs) == 0 {
		return nil
	}

	type scored struct {
		hit       LocalHit
		bm25, cos float64
	}
	scores := make([]scored, 0, len(i.docs))

	maxBM, maxCos := 0.0, 0.0
	for _, d := range i.docs {
		var bm float64
		if mode == ModeKeyword || mode == ModeHybrid {
			bm = bm25Score(d, queryTokens, len(i.docs), i.df, i.avgLen)
		}
		var cos float64
		if mode == ModeSemantic || mode == ModeHybrid {
			cos = trigramCosine(d.trigrams, queryTris)
		}
		if bm == 0 && cos == 0 {
			continue
		}
		if bm > maxBM {
			maxBM = bm
		}
		if cos > maxCos {
			maxCos = cos
		}
		scores = append(scores, scored{
			hit:  LocalHit{ID: d.id, Label: d.label},
			bm25: bm,
			cos:  cos,
		})
	}

	// Normalize each component to [0,1] for fair blending.
	for j := range scores {
		var s float64
		switch mode {
		case ModeKeyword:
			if maxBM > 0 {
				s = scores[j].bm25 / maxBM
			}
		case ModeSemantic:
			s = scores[j].cos
		default: // hybrid
			var nb, nc float64
			if maxBM > 0 {
				nb = scores[j].bm25 / maxBM
			}
			nc = scores[j].cos
			s = 0.5*nb + 0.5*nc
		}
		scores[j].hit.Score = s
	}

	sort.Slice(scores, func(a, b int) bool { return scores[a].hit.Score > scores[b].hit.Score })

	if k > 0 && len(scores) > k {
		scores = scores[:k]
	}
	out := make([]LocalHit, len(scores))
	for j, s := range scores {
		out[j] = s.hit
	}
	return out
}

// bm25Score computes Okapi BM25 for a single document against query terms.
func bm25Score(d docEntry, queryTokens []string, totalDocs int, df map[string]int, avgLen float64) float64 {
	if d.length == 0 || avgLen == 0 {
		return 0
	}
	score := 0.0
	dlNorm := float64(d.length) / avgLen
	for _, q := range queryTokens {
		tf, ok := d.tokens[q]
		if !ok {
			continue
		}
		nq := df[q]
		if nq == 0 {
			continue
		}
		idf := math.Log(1.0 + (float64(totalDocs)-float64(nq)+0.5)/(float64(nq)+0.5))
		num := float64(tf) * (bm25k1 + 1)
		den := float64(tf) + bm25k1*(1-bm25b+bm25b*dlNorm)
		score += idf * num / den
	}
	return score
}

// trigramCosine returns cosine similarity over unique char-trigram sets.
// Cheap, language-agnostic, catches partial-word matches that BM25 misses.
func trigramCosine(a, b map[string]struct{}) float64 {
	if len(a) == 0 || len(b) == 0 {
		return 0
	}
	overlap := 0
	smaller, larger := a, b
	if len(b) < len(a) {
		smaller, larger = b, a
	}
	for tri := range smaller {
		if _, ok := larger[tri]; ok {
			overlap++
		}
	}
	return float64(overlap) / math.Sqrt(float64(len(a))*float64(len(b)))
}
