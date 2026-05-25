package ingestion

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestFATFConfig(t *testing.T) {
	cfg := NewFATFConfig()

	tests := []struct {
		name        string
		code        string
		blacklisted bool
		greylisted  bool
		multiplier  float64
	}{
		{"iran_blacklisted", "IR", true, false, 3.0},
		{"north_korea_blacklisted", "KP", true, false, 3.0},
		{"myanmar_blacklisted", "MM", true, false, 3.0},
		{"nigeria_greylisted", "NG", false, true, 1.5},
		{"turkey_greylisted", "TR", false, true, 1.5},
		{"us_neither", "US", false, false, 1.0},
		{"gb_neither", "GB", false, false, 1.0},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := cfg.IsBlacklisted(tc.code); got != tc.blacklisted {
				t.Errorf("IsBlacklisted(%s) = %v, want %v",
					tc.code, got, tc.blacklisted)
			}
			if got := cfg.IsGreylisted(tc.code); got != tc.greylisted {
				t.Errorf("IsGreylisted(%s) = %v, want %v",
					tc.code, got, tc.greylisted)
			}
			if got := cfg.RiskMultiplier(tc.code); got != tc.multiplier {
				t.Errorf("RiskMultiplier(%s) = %v, want %v",
					tc.code, got, tc.multiplier)
			}
		})
	}
}

func TestFlagHighRiskCountry(t *testing.T) {
	cfg := NewFATFConfig()

	tests := []struct {
		name string
		nats []string
		want string
	}{
		{"blacklisted", []string{"IR"}, "FATF_BLACKLIST:IR"},
		{"greylisted", []string{"NG"}, "FATF_GREYLIST:NG"},
		{"clean", []string{"US"}, ""},
		{"empty", nil, ""},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			id, _ := domain.NewEntityID("ent_test1234ab")
			nm, _ := domain.NewName("Test Person", "", "", "")
			ent, _ := domain.NewEntity(
				id, domain.EntityTypeIndividual, []domain.Name{nm},
			)
			ent.Nationalities = tc.nats

			got := cfg.FlagHighRiskCountry(ent)
			if got != tc.want {
				t.Errorf("FlagHighRiskCountry() = %q, want %q",
					got, tc.want)
			}
		})
	}
}
