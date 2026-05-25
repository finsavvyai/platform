package screening

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestEmbeddingMatcher(t *testing.T) {
	em := NewEmbeddingMatcher()
	em.SetVector("John Smith", []float64{1, 0, 0})
	em.SetVector("John Smithe", []float64{0.9, 0.1, 0})
	em.SetVector("Jane Doe", []float64{0, 1, 0})

	tests := []struct {
		name          string
		query         domain.Name
		candidates    []domain.Name
		expectedCount int
	}{
		{
			name:          "match_above_threshold",
			query:         domain.Name{Full: "John Smith"},
			candidates:    []domain.Name{{Full: "John Smithe"}},
			expectedCount: 1,
		},
		{
			name:          "no_match_below_threshold",
			query:         domain.Name{Full: "John Smith"},
			candidates:    []domain.Name{{Full: "Jane Doe"}},
			expectedCount: 0,
		},
		{
			name:          "missing_vector",
			query:         domain.Name{Full: "Unknown"},
			candidates:    []domain.Name{{Full: "John Smith"}},
			expectedCount: 0,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := em.Match(tt.query, tt.candidates)
			if len(got) != tt.expectedCount {
				t.Errorf("Match() returned %d results, want %d", len(got), tt.expectedCount)
			}
		})
	}
}
