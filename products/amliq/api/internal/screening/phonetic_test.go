package screening

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestPhoneticMatcher(t *testing.T) {
	pm := NewPhoneticMatcher()
	tests := []struct {
		name          string
		query         domain.Name
		candidates    []domain.Name
		expectedCount int
	}{
		{
			name:          "soundex_match",
			query:         domain.Name{Full: "Smith"},
			candidates:    []domain.Name{{Full: "Smythe"}},
			expectedCount: 1,
		},
		{
			name:          "no_match",
			query:         domain.Name{Full: "John"},
			candidates:    []domain.Name{{Full: "Bob"}},
			expectedCount: 0,
		},
		{
			name:  "multiple_candidates",
			query: domain.Name{Full: "Robert"},
			candidates: []domain.Name{
				{Full: "Rupert"},
				{Full: "Jane"},
				{Full: "Robert"},
			},
			expectedCount: 2,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := pm.Match(tt.query, tt.candidates)
			if len(got) != tt.expectedCount {
				t.Errorf("Match() returned %d results, want %d", len(got), tt.expectedCount)
			}
		})
	}
}
