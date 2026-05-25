package domain

import "testing"

func TestPEPTierRiskWeight(t *testing.T) {
	tests := []struct {
		tier PEPTier
		want float64
	}{
		{PEPTier1, 1.0},
		{PEPTier2, 0.8},
		{PEPTier3, 0.5},
		{PEPTier4, 0.6},
		{PEPTierNone, 0.0},
	}
	for _, tt := range tests {
		t.Run(tt.tier.String(), func(t *testing.T) {
			got := tt.tier.RiskWeight()
			if got != tt.want {
				t.Errorf("RiskWeight=%f, want=%f", got, tt.want)
			}
		})
	}
}

func TestParsePEPTier(t *testing.T) {
	tests := []struct {
		input   string
		want    PEPTier
		wantErr bool
	}{
		{"tier1", PEPTier1, false},
		{"tier2", PEPTier2, false},
		{"tier3", PEPTier3, false},
		{"tier4", PEPTier4, false},
		{"none", PEPTierNone, false},
		{"invalid", PEPTierNone, true},
	}
	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got, err := ParsePEPTier(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("err=%v, wantErr=%v", err, tt.wantErr)
			}
			if got != tt.want {
				t.Errorf("tier=%d, want=%d", got, tt.want)
			}
		})
	}
}

func TestPEPProfile(t *testing.T) {
	p := NewPEPProfile("ent_1", PEPTier1, "President", "US")
	if !p.IsActive {
		t.Error("new profile should be active")
	}
	if p.Tier != PEPTier1 {
		t.Errorf("tier=%d, want tier1", p.Tier)
	}
}
