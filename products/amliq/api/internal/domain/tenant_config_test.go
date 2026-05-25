package domain

import (
	"testing"
)

func TestNewTenantConfig(t *testing.T) {
	tests := []struct {
		name      string
		country   string
		checkFunc func(TenantConfig) bool
	}{
		{
			name:    "default US",
			country: "US",
			checkFunc: func(tc TenantConfig) bool {
				return tc.Country == "US" && tc.DefaultThreshold == 0.7
			},
		},
		{
			name:    "empty defaults to US",
			country: "",
			checkFunc: func(tc TenantConfig) bool {
				return tc.Country == "US"
			},
		},
		{
			name:    "israel config",
			country: "IL",
			checkFunc: func(tc TenantConfig) bool {
				return tc.Country == "IL" && len(tc.EnabledLists) > 0
			},
		},
		{
			name:    "uk config",
			country: "GB",
			checkFunc: func(tc TenantConfig) bool {
				return tc.Country == "GB" && len(tc.EnabledLists) >= 3
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := NewTenantConfig(tt.country)
			if err != nil {
				t.Errorf("NewTenantConfig(%s) error = %v", tt.country, err)
				return
			}
			if !tt.checkFunc(got) {
				t.Errorf("NewTenantConfig(%s) check failed", tt.country)
			}
		})
	}
}

func TestTenantConfigValidate(t *testing.T) {
	tests := []struct {
		name    string
		config  TenantConfig
		wantErr bool
	}{
		{
			name: "valid config",
			config: TenantConfig{
				Country:           "US",
				DefaultThreshold:  0.7,
				AutoDismissBelow:  0.3,
				AutoEscalateAbove: 0.8,
				MaxBatchSize:      1000,
				MatchWeights:      DefaultMatchWeights(),
			},
		},
		{
			name:    "missing country",
			config:  TenantConfig{MaxBatchSize: 1000},
			wantErr: true,
		},
		{
			name: "threshold too high",
			config: TenantConfig{
				Country:          "US",
				DefaultThreshold: 150.0,
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
