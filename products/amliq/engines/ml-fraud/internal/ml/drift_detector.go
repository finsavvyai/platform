package ml

import (
	"context"
	"fmt"
	"time"
)

// DriftRecommendation indicates the action to take based on drift analysis.
type DriftRecommendation string

const (
	DriftRecommendationRetrain DriftRecommendation = "RETRAIN"
	DriftRecommendationMonitor DriftRecommendation = "MONITOR"
	DriftRecommendationStable  DriftRecommendation = "STABLE"
)

// DriftMetric holds statistical drift measurements for a single feature.
type DriftMetric struct {
	FeatureName          string    `json:"feature_name" validate:"required"`
	BaselineDistribution []float64 `json:"baseline_distribution"`
	CurrentDistribution  []float64 `json:"current_distribution"`
	KLDivergence         float64   `json:"kl_divergence" validate:"min=0"`
	PSI                  float64   `json:"psi" validate:"min=0"`
	PValue               float64   `json:"p_value" validate:"min=0,max=1"`
	IsDrifted            bool      `json:"is_drifted"`
}

// DriftReport summarizes drift detection results for a tenant.
type DriftReport struct {
	ID                 string              `json:"id"`
	TenantID           string              `json:"tenant_id" validate:"required"`
	Timestamp          time.Time           `json:"timestamp"`
	Metrics            []DriftMetric       `json:"metrics"`
	OverallDriftScore  float64             `json:"overall_drift_score" validate:"min=0,max=1"`
	Recommendation     DriftRecommendation `json:"recommendation"`
	WindowHours        int                 `json:"window_hours" validate:"min=1"`
	SampleCount        int                 `json:"sample_count" validate:"min=0"`
}

// DriftConfig defines parameters for drift detection.
type DriftConfig struct {
	Threshold    float64  `json:"threshold" validate:"min=0,max=1"`
	WindowHours  int      `json:"window_hours" validate:"min=1"`
	MinSamples   int      `json:"min_samples" validate:"min=1"`
	Features     []string `json:"features" validate:"required"`
	PSIThreshold float64  `json:"psi_threshold" validate:"min=0,max=1"`
}

// DriftDetector defines the interface for detecting data drift.
type DriftDetector interface {
	Detect(ctx context.Context, tenantID string, windowHours int) (*DriftReport, error)
}

// IsActionRequired returns true when the drift report recommends retraining.
func (r *DriftReport) IsActionRequired() bool {
	return r.Recommendation == DriftRecommendationRetrain
}

// ValidateDriftConfig checks that a DriftConfig has valid field values.
func ValidateDriftConfig(cfg DriftConfig) error {
	if cfg.Threshold < 0 || cfg.Threshold > 1 {
		return fmt.Errorf("threshold must be between 0 and 1, got %f", cfg.Threshold)
	}
	if cfg.WindowHours < 1 {
		return fmt.Errorf("window_hours must be >= 1, got %d", cfg.WindowHours)
	}
	if cfg.MinSamples < 1 {
		return fmt.Errorf("min_samples must be >= 1, got %d", cfg.MinSamples)
	}
	if len(cfg.Features) == 0 {
		return fmt.Errorf("features must not be empty")
	}
	if cfg.PSIThreshold < 0 || cfg.PSIThreshold > 1 {
		return fmt.Errorf("psi_threshold must be between 0 and 1, got %f", cfg.PSIThreshold)
	}
	return nil
}

// DefaultDriftConfig returns a sensible default configuration.
func DefaultDriftConfig() DriftConfig {
	return DriftConfig{
		Threshold:    0.3,
		WindowHours:  24,
		MinSamples:   100,
		Features:     []string{"amount", "frequency", "location", "device"},
		PSIThreshold: 0.2,
	}
}
