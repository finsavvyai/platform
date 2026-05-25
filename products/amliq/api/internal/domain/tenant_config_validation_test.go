package domain

import (
	"testing"
)

func TestTenantConfigValidateErrors(t *testing.T) {
	tests := []struct {
		name    string
		config  TenantConfig
		wantErr bool
	}{
		{
			name: "zero batch size",
			config: TenantConfig{
				Country:      "US",
				MaxBatchSize: 0,
				MatchWeights: DefaultMatchWeights(),
			},
			wantErr: true,
		},
		{
			name: "negative threshold",
			config: TenantConfig{
				Country:          "US",
				DefaultThreshold: -1.0,
				MaxBatchSize:     1000,
				MatchWeights:     DefaultMatchWeights(),
			},
			wantErr: true,
		},
		{
			name: "bad match weights",
			config: TenantConfig{
				Country:      "US",
				MaxBatchSize: 1000,
				MatchWeights: MatchWeights{Exact: 50, Fuzzy: 50},
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.config.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
