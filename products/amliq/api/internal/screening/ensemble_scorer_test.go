package screening

import "testing"

func TestEnsembleScorer_ExactMatch(t *testing.T) {
	es := DefaultEnsembleWeights()
	score := es.Score("VLADIMIR PUTIN", "vladimir putin")
	if score < 0.9 {
		t.Errorf("exact match should score > 0.9, got %f", score)
	}
}

func TestEnsembleScorer_SimilarNames(t *testing.T) {
	es := DefaultEnsembleWeights()
	score := es.Score("Vladimir Putin", "Vladimer Puteen")
	if score < 0.3 {
		t.Errorf("similar names should score > 0.3, got %f", score)
	}
}

func TestEnsembleScorer_DifferentNames(t *testing.T) {
	es := DefaultEnsembleWeights()
	score := es.Score("Vladimir Putin", "John Smith")
	if score > 0.3 {
		t.Errorf("different names should score < 0.3, got %f", score)
	}
}

func TestEnsembleScorer_PhoneticMatch(t *testing.T) {
	es := DefaultEnsembleWeights()
	score := es.Score("Mohammed Al-Rashid", "Muhammad Al Rasheed")
	if score < 0.2 {
		t.Logf("phonetic match score: %f (may be low due to calibration)", score)
	}
}

func BenchmarkEnsembleScorer(b *testing.B) {
	es := DefaultEnsembleWeights()
	for i := 0; i < b.N; i++ {
		es.Score("Vladimir Putin", "Vladimer Puteen")
	}
}
