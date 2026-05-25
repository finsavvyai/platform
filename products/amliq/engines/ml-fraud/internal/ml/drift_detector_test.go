package ml

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDriftRecommendationConstants(t *testing.T) {
	assert.Equal(t, DriftRecommendation("RETRAIN"), DriftRecommendationRetrain)
	assert.Equal(t, DriftRecommendation("MONITOR"), DriftRecommendationMonitor)
	assert.Equal(t, DriftRecommendation("STABLE"), DriftRecommendationStable)
}

func TestDriftMetricFields(t *testing.T) {
	m := DriftMetric{
		FeatureName:          "amount",
		BaselineDistribution: []float64{0.1, 0.2, 0.7},
		CurrentDistribution:  []float64{0.3, 0.3, 0.4},
		KLDivergence:         0.15,
		PSI:                  0.12,
		PValue:               0.03,
		IsDrifted:            true,
	}
	assert.Equal(t, "amount", m.FeatureName)
	assert.Equal(t, 0.15, m.KLDivergence)
	assert.Equal(t, 0.12, m.PSI)
	assert.Equal(t, 0.03, m.PValue)
	assert.True(t, m.IsDrifted)
	assert.Len(t, m.BaselineDistribution, 3)
	assert.Len(t, m.CurrentDistribution, 3)
}

func TestDriftReportIsActionRequired(t *testing.T) {
	tests := []struct {
		name           string
		recommendation DriftRecommendation
		expected       bool
	}{
		{"retrain requires action", DriftRecommendationRetrain, true},
		{"monitor does not require action", DriftRecommendationMonitor, false},
		{"stable does not require action", DriftRecommendationStable, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			report := &DriftReport{Recommendation: tc.recommendation}
			assert.Equal(t, tc.expected, report.IsActionRequired())
		})
	}
}

func TestValidateDriftConfigValid(t *testing.T) {
	cfg := DefaultDriftConfig()
	err := ValidateDriftConfig(cfg)
	require.NoError(t, err)
}

func TestValidateDriftConfigInvalidThreshold(t *testing.T) {
	tests := []struct {
		name      string
		threshold float64
	}{
		{"negative threshold", -0.1},
		{"threshold above 1", 1.5},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			cfg := DefaultDriftConfig()
			cfg.Threshold = tc.threshold
			err := ValidateDriftConfig(cfg)
			require.Error(t, err)
			assert.Contains(t, err.Error(), "threshold")
		})
	}
}

func TestValidateDriftConfigInvalidWindowHours(t *testing.T) {
	cfg := DefaultDriftConfig()
	cfg.WindowHours = 0
	err := ValidateDriftConfig(cfg)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "window_hours")
}

func TestValidateDriftConfigInvalidMinSamples(t *testing.T) {
	cfg := DefaultDriftConfig()
	cfg.MinSamples = 0
	err := ValidateDriftConfig(cfg)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "min_samples")
}

func TestValidateDriftConfigEmptyFeatures(t *testing.T) {
	cfg := DefaultDriftConfig()
	cfg.Features = []string{}
	err := ValidateDriftConfig(cfg)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "features")
}

func TestValidateDriftConfigInvalidPSIThreshold(t *testing.T) {
	tests := []struct {
		name string
		psi  float64
	}{
		{"negative PSI", -0.01},
		{"PSI above 1", 1.1},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			cfg := DefaultDriftConfig()
			cfg.PSIThreshold = tc.psi
			err := ValidateDriftConfig(cfg)
			require.Error(t, err)
			assert.Contains(t, err.Error(), "psi_threshold")
		})
	}
}

func TestDefaultDriftConfigReturnsValidConfig(t *testing.T) {
	cfg := DefaultDriftConfig()
	assert.Equal(t, 0.3, cfg.Threshold)
	assert.Equal(t, 24, cfg.WindowHours)
	assert.Equal(t, 100, cfg.MinSamples)
	assert.Equal(t, 0.2, cfg.PSIThreshold)
	assert.NotEmpty(t, cfg.Features)
	assert.Contains(t, cfg.Features, "amount")
	assert.Contains(t, cfg.Features, "frequency")
	assert.Contains(t, cfg.Features, "location")
	assert.Contains(t, cfg.Features, "device")

	// Default config must pass validation
	err := ValidateDriftConfig(cfg)
	require.NoError(t, err)
}

func TestValidateDriftConfigBoundaryValues(t *testing.T) {
	cfg := DriftConfig{
		Threshold:    0.0,
		WindowHours:  1,
		MinSamples:   1,
		Features:     []string{"x"},
		PSIThreshold: 0.0,
	}
	require.NoError(t, ValidateDriftConfig(cfg))

	cfg.Threshold = 1.0
	cfg.PSIThreshold = 1.0
	require.NoError(t, ValidateDriftConfig(cfg))
}

func TestValidateDriftConfigNilFeatures(t *testing.T) {
	cfg := DriftConfig{
		Threshold:    0.3,
		WindowHours:  24,
		MinSamples:   100,
		Features:     nil,
		PSIThreshold: 0.2,
	}
	err := ValidateDriftConfig(cfg)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "features")
}
