package ingestion

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestParseDOB(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantNil bool
		wantYr  int
	}{
		{"iso_full", "1985-03-15", false, 1985},
		{"iso_month", "1990-06", false, 1990},
		{"year_only", "1972", false, 1972},
		{"us_slash", "03/15/1985", false, 1985},
		{"semicolon_multi", "1985-03-15; 1986-01-01", false, 1985},
		{"empty", "", true, 0},
		{"garbage", "not-a-date", true, 0},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			ent := &domain.Entity{
				Metadata: make(map[string]interface{}),
			}
			parseDOB(ent, tc.input)
			if tc.wantNil && ent.DOB != nil {
				t.Errorf("expected nil DOB, got %v", ent.DOB)
			}
			if !tc.wantNil {
				if ent.DOB == nil {
					t.Fatal("expected non-nil DOB")
				}
				if ent.DOB.Year() != tc.wantYr {
					t.Errorf("year = %d, want %d",
						ent.DOB.Year(), tc.wantYr)
				}
			}
		})
	}
}
