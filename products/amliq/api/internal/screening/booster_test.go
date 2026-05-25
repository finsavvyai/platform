package screening

import (
	"strings"
	"testing"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

func makeBoostEntity(name, list string, dob *time.Time, nat []string) domain.Entity {
	n, _ := domain.NewName(name, "", "", "")
	return domain.Entity{
		Names:         []domain.Name{n},
		DOB:           dob,
		Nationalities: nat,
		ListID:        list,
	}
}

func timePtr(y, m, d int) *time.Time {
	t := time.Date(y, time.Month(m), d, 0, 0, 0, 0, time.UTC)
	return &t
}

func TestTryBoost(t *testing.T) {
	dob := timePtr(1980, 3, 15)
	tests := []struct {
		name    string
		entity  domain.Entity
		cand    domain.Entity
		boosted bool
		substr  string
	}{
		{
			name:    "exact match all fields",
			entity:  makeBoostEntity("John Smith", "", dob, []string{"US"}),
			cand:    makeBoostEntity("John Smith", "ofac_sdn", dob, []string{"US"}),
			boosted: true,
			substr:  "Exact match",
		},
		{
			name:    "case insensitive name",
			entity:  makeBoostEntity("john smith", "", dob, []string{"US"}),
			cand:    makeBoostEntity("JOHN SMITH", "ofac_sdn", dob, []string{"US"}),
			boosted: true,
			substr:  "ofac_sdn",
		},
		{
			name:    "different name",
			entity:  makeBoostEntity("John Smith", "", dob, []string{"US"}),
			cand:    makeBoostEntity("Jane Doe", "ofac_sdn", dob, []string{"US"}),
			boosted: false,
		},
		{
			name:    "different DOB",
			entity:  makeBoostEntity("John Smith", "", dob, []string{"US"}),
			cand:    makeBoostEntity("John Smith", "ofac_sdn", timePtr(1990, 1, 1), []string{"US"}),
			boosted: false,
		},
		{
			name:    "nil DOB entity",
			entity:  makeBoostEntity("John Smith", "", nil, []string{"US"}),
			cand:    makeBoostEntity("John Smith", "ofac_sdn", dob, []string{"US"}),
			boosted: false,
		},
		{
			name:    "different country",
			entity:  makeBoostEntity("John Smith", "", dob, []string{"US"}),
			cand:    makeBoostEntity("John Smith", "ofac_sdn", dob, []string{"UK"}),
			boosted: false,
		},
		{
			name:    "empty nationalities",
			entity:  makeBoostEntity("John Smith", "", dob, nil),
			cand:    makeBoostEntity("John Smith", "ofac_sdn", dob, []string{"US"}),
			boosted: false,
		},
		{
			name:    "extra whitespace in name",
			entity:  makeBoostEntity("  John   Smith  ", "", dob, []string{"US"}),
			cand:    makeBoostEntity("John Smith", "ofac_sdn", dob, []string{"US"}),
			boosted: true,
			substr:  "Exact match",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, expl := TryBoost(tt.entity, tt.cand)
			if got != tt.boosted {
				t.Errorf("boosted = %v, want %v", got, tt.boosted)
			}
			if tt.boosted && !strings.Contains(expl, tt.substr) {
				t.Errorf("explanation %q missing %q", expl, tt.substr)
			}
			if !tt.boosted && expl != "" {
				t.Errorf("expected empty explanation, got %q", expl)
			}
		})
	}
}