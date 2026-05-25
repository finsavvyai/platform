package screening

import (
	"math"
	"strings"
)

// TFIDF computes TF-IDF weighted similarity scores for name matching.
type TFIDF struct {
	docFreq    map[string]int
	totalDocs  int
	normalizer *Normalizer
}

// NewTFIDF creates a new TF-IDF scorer.
func NewTFIDF() *TFIDF {
	return &TFIDF{
		docFreq:    make(map[string]int),
		normalizer: NewNormalizer(),
	}
}

// Build computes IDF from a corpus of entity names.
func (t *TFIDF) Build(names []string) {
	t.totalDocs = len(names)
	t.docFreq = make(map[string]int)
	for _, name := range names {
		seen := make(map[string]bool)
		for _, tok := range t.tokenize(name) {
			if !seen[tok] {
				t.docFreq[tok]++
				seen[tok] = true
			}
		}
	}
}

// Score returns a TF-IDF weighted Jaro-Winkler similarity.
func (t *TFIDF) Score(query, candidate string) float64 {
	qTokens := t.tokenize(query)
	cTokens := t.tokenize(candidate)
	if len(qTokens) == 0 || len(cTokens) == 0 {
		return 0.0
	}

	totalWeight := 0.0
	totalScore := 0.0

	for _, qt := range qTokens {
		bestSim := 0.0
		for _, ct := range cTokens {
			sim := jaroWinklerSimilarity(qt, ct)
			if sim > bestSim {
				bestSim = sim
			}
		}
		idf := t.idf(qt)
		totalWeight += idf
		totalScore += bestSim * idf
	}

	if totalWeight == 0 {
		return 0.0
	}
	return totalScore / totalWeight
}

// IDF returns the inverse document frequency for a token.
func (t *TFIDF) idf(token string) float64 {
	df, ok := t.docFreq[token]
	if !ok || t.totalDocs == 0 {
		return 1.0
	}
	return math.Log(1.0+float64(t.totalDocs)/float64(df)) + 1.0
}

func (t *TFIDF) tokenize(s string) []string {
	s = t.normalizer.Normalize(s)
	parts := strings.Fields(s)
	var tokens []string
	for _, p := range parts {
		if len(p) > 1 {
			tokens = append(tokens, p)
		}
	}
	return tokens
}
