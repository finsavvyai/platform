package screening

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestTokenMatcher(t *testing.T) {
	tm := NewTokenMatcher()
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
			name:          "token_overlap",
			query:         domain.Name{Full: "John Smith"},
			candidates:    []domain.Name{{Full: "John Smithson"}},
			expectedCount: 0,
		},
		{
			name:          "no_overlap",
			query:         domain.Name{Full: "John Smith"},
			candidates:    []domain.Name{{Full: "Jane Doe"}},
			expectedCount: 0,
		},
		{
			name:  "multiple_candidates",
			query: domain.Name{Full: "John Smith"},
			candidates: []domain.Name{
				{Full: "John Smith"},
				{Full: "Jane Doe"},
				{Full: "John Johnson"},
			},
			expectedCount: 1,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tm.Match(tt.query, tt.candidates)
			if len(got) != tt.expectedCount {
				t.Errorf("Match() returned %d results, want %d", len(got), tt.expectedCount)
			}
		})
	}
}
