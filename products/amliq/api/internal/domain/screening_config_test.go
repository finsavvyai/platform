package domain

import "testing"

func TestScreeningConfig(t *testing.T) {
	tests := []struct {
		name    string
		cfg     ScreeningConfig
		wantErr bool
	}{
		{
			name:    "default_is_valid",
			cfg:     DefaultScreeningConfig(),
			wantErr: false,
		},
		{
			name: "weights_not_100",
			cfg: func() ScreeningConfig {
				c := DefaultScreeningConfig()
				c.LayerWeights["Exact"] = 50
				return c
			}(),
			wantErr: true,
		},
		{
			name: "negative_weight",
			cfg: func() ScreeningConfig {
				c := DefaultScreeningConfig()
				c.LayerWeights["Exact"] = -5
				c.LayerWeights["Fuzzy"] = 50
				return c
			}(),
			wantErr: true,
		},
		{
			name: "threshold_out_of_range",
			cfg: func() ScreeningConfig {
				c := DefaultScreeningConfig()
				c.LayerThresholds["Fuzzy"] = 1.5
				return c
			}(),
			wantErr: true,
		},
		{
			name: "dismiss_gte_escalate",
			cfg: func() ScreeningConfig {
				c := DefaultScreeningConfig()
				c.AutoDismiss = 0.9
				c.AutoEscalate = 0.5
				return c
			}(),
			wantErr: true,
		},
		{
			name: "zero_max_results",
			cfg: func() ScreeningConfig {
				c := DefaultScreeningConfig()
				c.MaxResults = 0
				return c
			}(),
			wantErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateConfig(tt.cfg)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateConfig() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestConfigForRiskLevel(t *testing.T) {
	tests := []struct {
		level         string
		wantThreshold float64
		wantLLM       bool
	}{
		{"low", 0.7, false},
		{"medium", 0.5, false},
		{"high", 0.3, true},
		{"critical", 0.2, true},
	}
	for _, tt := range tests {
		t.Run(tt.level, func(t *testing.T) {
			cfg := ConfigForRiskLevel(tt.level)
			if err := ValidateConfig(cfg); err != nil {
				t.Fatalf("preset %s invalid: %v", tt.level, err)
			}
			if cfg.OverallThreshold != tt.wantThreshold {
				t.Errorf("threshold = %v, want %v", cfg.OverallThreshold, tt.wantThreshold)
			}
			if cfg.LLMCascade != tt.wantLLM {
				t.Errorf("llm_cascade = %v, want %v", cfg.LLMCascade, tt.wantLLM)
			}
		})
	}
}
