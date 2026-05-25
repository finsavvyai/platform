package screening

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestExactMatcher(t *testing.T) {
	em := NewExactMatcher()
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
			name:          "case_insensitive",
			query:         domain.Name{Full: "JOHN SMITH"},
			candidates:    []domain.Name{{Full: "john smith"}},
			expectedCount: 1,
		},
		{
			name:          "no_match",
			query:         domain.Name{Full: "John Smith"},
			candidates:    []domain.Name{{Full: "Jane Doe"}},
			expectedCount: 0,
		},
		{
			name:  "multiple_candidates",
			query: domain.Name{Full: "John Smith"},
			candidates: []domain.Name{
				{Full: "John Smith"},
				{Full: "jane doe"},
				{Full: "JOHN SMITH"},
			},
			expectedCount: 2,
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
