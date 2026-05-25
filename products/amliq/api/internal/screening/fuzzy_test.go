package screening

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestFuzzyMatcher(t *testing.T) {
	fm := NewFuzzyMatcher(0.75)
	tests := []struct {
		name          string
		query         domain.Name
		candidates    []domain.Name
		expectedCount int
	}{
		{
			name:          "exact_match",
			query:         domain.Name{Full: "John Smith"},
			candidates:    []domain.Name{{Full: "John Smith"}},
			expectedCount: 1,
		},
		{
			name:          "fuzzy_match",
			query:         domain.Name{Full: "John Smith"},
			candidates:    []domain.Name{{Full: "John Smithe"}},
			expectedCount: 1,
		},
		{
			name:          "low_threshold",
			query:         domain.Name{Full: "John"},
			candidates:    []domain.Name{{Full: "Jane"}},
			expectedCount: 0,
		},
		{
			name:  "multiple_matches",
			query: domain.Name{Full: "John Smith"},
			candidates: []domain.Name{
				{Full: "John Smith"},
				{Full: "John Smithe"},
				{Full: "Jane Doe"},
			},
			expectedCount: 2,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := fm.Match(tt.query, tt.candidates)
			if len(got) != tt.expectedCount {
				t.Errorf("Match() returned %d results, want %d", len(got), tt.expectedCount)
			}
		})
	}
}
