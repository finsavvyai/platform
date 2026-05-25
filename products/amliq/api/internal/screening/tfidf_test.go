package screening

import "testing"

func TestTFIDF(t *testing.T) {
	corpus := []string{
		"Mohammad Ali",
		"Mohammad Hassan",
		"Mohammad Ibrahim",
		"Ali Hassan",
		"Qassem Soleimani",
		"John Smith",
	}

	tfidf := NewTFIDF()
	tfidf.Build(corpus)

	tests := []struct {
		name      string
		query     string
		candidate string
		minScore  float64
		maxScore  float64
	}{
		{
			name:      "exact_match",
			query:     "Mohammad Ali",
			candidate: "Mohammad Ali",
			minScore:  0.9,
			maxScore:  1.0,
		},
		{
			name:      "partial_match",
			query:     "Mohammad Ali",
			candidate: "MOHAMMAD ALI HASSAN",
			minScore:  0.7,
			maxScore:  1.0,
		},
		{
			name:      "no_match",
			query:     "John Smith",
			candidate: "Qassem Soleimani",
			minScore:  0.0,
			maxScore:  0.5,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			score := tfidf.Score(tt.query, tt.candidate)
			if score < tt.minScore || score > tt.maxScore {
				t.Errorf("Score(%q, %q) = %f, want [%f, %f]",
					tt.query, tt.candidate, score, tt.minScore, tt.maxScore)
			}
		})
	}
}

func TestTFIDFRareTokenWeight(t *testing.T) {
	corpus := []string{
		"Mohammad Ali", "Mohammad Hassan", "Mohammad Ibrahim",
		"Ali Reza", "Ali Khamenei",
		"Qassem Soleimani",
	}
	tfidf := NewTFIDF()
	tfidf.Build(corpus)

	// "Soleimani" is rare (1 doc), "Mohammad" is common (3 docs)
	idfRare := tfidf.idf("soleimani")
	idfCommon := tfidf.idf("mohammad")
	if idfRare <= idfCommon {
		t.Errorf("rare IDF (%f) should be > common IDF (%f)",
			idfRare, idfCommon)
	}
}

func TestTFIDFEmptyInputs(t *testing.T) {
	tfidf := NewTFIDF()
	tfidf.Build([]string{"John Smith"})

	tests := []struct {
		name      string
		query     string
		candidate string
	}{
		{"empty_query", "", "John Smith"},
		{"empty_candidate", "John Smith", ""},
		{"both_empty", "", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			score := tfidf.Score(tt.query, tt.candidate)
			if score != 0.0 {
				t.Errorf("Score() = %f, want 0.0", score)
			}
		})
	}
}
