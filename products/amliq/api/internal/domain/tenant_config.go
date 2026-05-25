package domain

import (
	"fmt"
	"time"
)

// TenantConfig holds organization-wide configuration.
type TenantConfig struct {
	Country             string
	RegulationFramework []string
	EnabledLists        []ListConfig
	DefaultThreshold    float64
	MatchWeights        MatchWeights
	AutoDismissBelow    float64
	AutoEscalateAbove   float64
	ScreeningMode       ScreeningMode
	BatchSchedule       string
	MaxBatchSize        int
	Webhooks            WebhookConfig
	EnabledProducts     []Product
	CreatedAt           time.Time
	UpdatedAt           time.Time
}

// NewTenantConfig returns a new config with sensible defaults.
func NewTenantConfig(country string) (TenantConfig, error) {
	if country == "" {
		country = "US"
	}
	now := time.Now().UTC()
	cfg := TenantConfig{
		Country:           country,
		DefaultThreshold:  0.7,
		AutoDismissBelow:  0.3,
		AutoEscalateAbove: 0.8,
		ScreeningMode:     ScreeningModeRealtime,
		BatchSchedule:     "0 2 * * *",
		MaxBatchSize:      10000,
		MatchWeights:      DefaultMatchWeights(),
		CreatedAt:         now,
		UpdatedAt:         now,
	}
	cfg.EnabledLists = SuggestedLists(country)
	return cfg, cfg.Validate()
}

// Validate checks that config is sound.
func (tc TenantConfig) Validate() error {
	if tc.Country == "" {
		return fmt.Errorf("country required")
	}
	if tc.DefaultThreshold < 0 || tc.DefaultThreshold > 100 {
		return fmt.Errorf("defaultThreshold must be 0-100")
	}
	if tc.AutoDismissBelow >= tc.AutoEscalateAbove {
		return fmt.Errorf("autoDismissBelow must be less than autoEscalateAbove")
	}
	if tc.MaxBatchSize <= 0 {
		return fmt.Errorf("maxBatchSize must be positive")
	}
	if err := tc.MatchWeights.Validate(); err != nil {
		return err
	}
	for _, lc := range tc.EnabledLists {
		if err := lc.Validate(); err != nil {
			return err
		}
	}
	return nil
}
