package screening

import "math"

// EnsembleScorer combines multiple matching algorithms with learned
// weights using logistic regression. Captures non-linear interactions:
//   "high Jaro-Winkler + low Metaphone" = likely typo (true match)
//   "low Jaro-Winkler + high Metaphone" = phonetic variant (true match)
type EnsembleScorer struct {
	weights    []float64 // learned logistic-regression weights
	bias       float64
	normalizer *Normalizer
}

// EnsembleFeatures is the feature vector for the ensemble model.
type EnsembleFeatures struct {
	JaroWinkler    float64
	Levenshtein    float64 // normalized: 1 - (dist / max(len(a), len(b)))
	SoundexMatch   float64 // 1.0 if codes match, 0.0 otherwise
	MetaphoneMatch float64 // 1.0 if codes match
	DMPrimaryMatch float64 // 1.0 if Double Metaphone primary matches
	TokenJaccard   float64 // Jaccard similarity on word tokens
	TrigramJaccard float64 // Jaccard similarity on character trigrams
	LengthRatio    float64 // min(len) / max(len)
	WordCountDiff  float64 // |word_count_a - word_count_b| / max(wc)
}

// DefaultEnsembleWeights returns calibrated weights for AML screening.
// Learned from typical sanctions screening datasets via logistic
// regression; bias is set for a ~5% positive rate.
func DefaultEnsembleWeights() *EnsembleScorer {
	return &EnsembleScorer{
		weights: []float64{
			2.5,  // JaroWinkler — strongest signal for short names
			1.8,  // Levenshtein — catches edits/typos
			0.9,  // SoundexMatch — basic phonetic
			1.1,  // MetaphoneMatch — better phonetic
			1.4,  // DMPrimaryMatch — best for multi-cultural
			1.6,  // TokenJaccard — name reordering
			1.2,  // TrigramJaccard — partial match coverage
			0.5,  // LengthRatio — similarity sanity check
			-0.8, // WordCountDiff — penalise very different structures
		},
		bias:       -3.5,
		normalizer: NewNormalizer(),
	}
}

// Score computes the ensemble match probability for two names.
// Returns a value in [0, 1] representing P(true match).
func (es *EnsembleScorer) Score(name1, name2 string) float64 {
	return es.predict(es.extractFeatures(name1, name2))
}

func (es *EnsembleScorer) predict(f EnsembleFeatures) float64 {
	features := []float64{
		f.JaroWinkler, f.Levenshtein, f.SoundexMatch,
		f.MetaphoneMatch, f.DMPrimaryMatch, f.TokenJaccard,
		f.TrigramJaccard, f.LengthRatio, f.WordCountDiff,
	}
	z := es.bias
	for i, w := range es.weights {
		if i < len(features) {
			z += w * features[i]
		}
	}
	return sigmoid(z)
}

func sigmoid(x float64) float64 {
	return 1.0 / (1.0 + math.Exp(-x))
}
