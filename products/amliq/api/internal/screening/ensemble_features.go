package screening

import "strings"

// extractFeatures builds the full EnsembleFeatures vector from a
// raw pair of names. Each helper below owns one feature family so
// tweaks (new phonetic algorithm, new normalisation) land in a
// single place.
func (es *EnsembleScorer) extractFeatures(a, b string) EnsembleFeatures {
	normA := strings.ToLower(strings.TrimSpace(a))
	normB := strings.ToLower(strings.TrimSpace(b))
	maxLen := maxStrLen(normA, normB)

	tokA := strings.Fields(normA)
	tokB := strings.Fields(normB)

	return EnsembleFeatures{
		JaroWinkler:    jaroWinklerSimilarity(normA, normB),
		Levenshtein:    levenshteinNorm(normA, normB, maxLen),
		SoundexMatch:   matchBool(soundexPair(normA, normB)),
		MetaphoneMatch: matchBool(metaphonePair(normA, normB)),
		DMPrimaryMatch: matchBool(doubleMetaphonePair(normA, normB)),
		TokenJaccard:   jaccardStrings(tokA, tokB),
		TrigramJaccard: jaccardStrings(computeTrigrams(normA), computeTrigrams(normB)),
		LengthRatio:    lengthRatio(normA, normB, maxLen),
		WordCountDiff:  wordCountDiff(tokA, tokB),
	}
}

func levenshteinNorm(a, b string, maxLen int) float64 {
	if maxLen == 0 {
		return 1.0
	}
	dist := levenshteinDistance(a, b)
	return 1.0 - float64(dist)/float64(maxLen)
}

func soundexPair(a, b string) (string, string) {
	return soundexCode(strings.ToUpper(a)), soundexCode(strings.ToUpper(b))
}

func metaphonePair(a, b string) (string, string) {
	return metaphoneCode(strings.ToUpper(a)), metaphoneCode(strings.ToUpper(b))
}

func doubleMetaphonePair(a, b string) (string, string) {
	pA, _ := DoubleMetaphone(a)
	pB, _ := DoubleMetaphone(b)
	return pA, pB
}

func matchBool(a, b string) float64 {
	if a != "" && a == b {
		return 1.0
	}
	return 0.0
}

func lengthRatio(a, b string, maxLen int) float64 {
	if maxLen == 0 {
		return 1.0
	}
	minLen := len(a)
	if len(b) < minLen {
		minLen = len(b)
	}
	return float64(minLen) / float64(maxLen)
}

func wordCountDiff(a, b []string) float64 {
	maxWC := len(a)
	if len(b) > maxWC {
		maxWC = len(b)
	}
	if maxWC == 0 {
		return 0
	}
	diff := len(a) - len(b)
	if diff < 0 {
		diff = -diff
	}
	return float64(diff) / float64(maxWC)
}

func maxStrLen(a, b string) int {
	if len(a) > len(b) {
		return len(a)
	}
	return len(b)
}
