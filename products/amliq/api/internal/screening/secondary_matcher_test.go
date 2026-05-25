package screening

import (
	"testing"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestSecondaryMatcher(t *testing.T) {
	tests := []struct {
		name              string
		query             domain.Entity
		candidate         domain.Entity
		baseScore         float64
		expectedAdjustment float64
	}{
		{
			name: "DOB exact match boost",
			query: domain.Entity{
				DOB: mustParseDOB("1985-03-15"),
			},
			candidate: domain.Entity{
				DOB: mustParseDOB("1985-03-15"),
			},
			baseScore:          0.70,
			expectedAdjustment: 0.85, // 0.70 + 0.15
		},
		{
			name: "DOB year-only match boost",
			query: domain.Entity{
				DOB: mustParseDOB("1985-03-15"),
			},
			candidate: domain.Entity{
				DOB: mustParseDOB("1985-06-20"),
			},
			baseScore:          0.70,
			expectedAdjustment: 0.75, // 0.70 + 0.05
		},
		{
			name: "Nationality overlap boost",
			query: domain.Entity{
				Nationalities: []string{"US", "UK"},
			},
			candidate: domain.Entity{
				Nationalities: []string{"UK", "FR"},
			},
			baseScore:          0.60,
			expectedAdjustment: 0.70, // 0.60 + 0.10
		},
		{
			name: "Nationality conflict penalty",
			query: domain.Entity{
				Nationalities: []string{"US"},
			},
			candidate: domain.Entity{
				Nationalities: []string{"IR"},
			},
			baseScore:          0.75,
			expectedAdjustment: 0.65, // 0.75 - 0.10
		},
		{
			name: "No secondary data no change",
			query: domain.Entity{
				DOB: nil,
			},
			candidate: domain.Entity{
				DOB: nil,
			},
			baseScore:          0.80,
			expectedAdjustment: 0.80,
		},
		{
			name: "Score clamped at 1.0",
			query: domain.Entity{
				DOB:           mustParseDOB("1985-03-15"),
				Nationalities: []string{"US"},
			},
			candidate: domain.Entity{
				DOB:           mustParseDOB("1985-03-15"),
				Nationalities: []string{"US"},
			},
			baseScore:          0.95, // 0.95 + 0.15 + 0.10 = 1.20 → clamped to 1.0
			expectedAdjustment: 1.0,
		},
		{
			name: "Score clamped at 0.0",
			query: domain.Entity{
				Nationalities: []string{"US"},
			},
			candidate: domain.Entity{
				Nationalities: []string{"IR"},
			},
			baseScore:          0.05, // 0.05 - 0.10 = -0.05 → clamped to 0.0
			expectedAdjustment: 0.0,
		},
		{
			name: "Only query has DOB (no adjustment)",
			query: domain.Entity{
				DOB: mustParseDOB("1985-03-15"),
			},
			candidate: domain.Entity{
				DOB: nil,
			},
			baseScore:          0.50,
			expectedAdjustment: 0.50,
		},
		{
			name: "Only candidate has DOB (no adjustment)",
			query: domain.Entity{
				DOB: nil,
			},
			candidate: domain.Entity{
				DOB: mustParseDOB("1985-03-15"),
			},
			baseScore:          0.50,
			expectedAdjustment: 0.50,
		},
		{
			name: "DOB differs but both present (no adjustment)",
			query: domain.Entity{
				DOB: mustParseDOB("1985-03-15"),
			},
			candidate: domain.Entity{
				DOB: mustParseDOB("1990-05-20"),
			},
			baseScore:          0.70,
			expectedAdjustment: 0.70,
		},
	}

	sm := NewSecondaryMatcher()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := sm.AdjustScore(tt.query, tt.candidate, tt.baseScore)
			if diff := floatDiff(got, tt.expectedAdjustment); diff > 0.001 {
				t.Errorf("AdjustScore() = %f, want %f (diff: %f)",
					got, tt.expectedAdjustment, diff)
			}
		})
	}
}

func mustParseDOB(s string) *time.Time {
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		panic(err)
	}
	return &t
}

func floatDiff(a, b float64) float64 {
	if a > b {
		return a - b
	}
	return b - a
}
