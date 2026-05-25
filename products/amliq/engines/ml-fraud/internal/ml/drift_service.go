package ml

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
)

// TransactionFeatureStore provides access to feature distributions.
type TransactionFeatureStore interface {
	GetFeatureDistribution(ctx context.Context, tenantID string, featureName string, windowHours int) ([]float64, error)
	GetBaselineDistribution(ctx context.Context, tenantID string, featureName string) ([]float64, error)
}

// DriftService implements DriftDetector using statistical divergence measures.
type DriftService struct {
	config DriftConfig
	store  TransactionFeatureStore
}

// NewDriftService creates a DriftService with the given config and store.
func NewDriftService(config DriftConfig, store TransactionFeatureStore) *DriftService {
	return &DriftService{config: config, store: store}
}

// Detect iterates configured features, computes KL divergence and PSI,
// and returns an overall drift report with a recommendation.
func (s *DriftService) Detect(ctx context.Context, tenantID string, windowHours int) (*DriftReport, error) {
	var metrics []DriftMetric
	var totalKL float64

	for _, feature := range s.config.Features {
		baseline, err := s.store.GetBaselineDistribution(ctx, tenantID, feature)
		if err != nil {
			return nil, fmt.Errorf("baseline for %s: %w", feature, err)
		}
		current, err := s.store.GetFeatureDistribution(ctx, tenantID, feature, windowHours)
		if err != nil {
			return nil, fmt.Errorf("current for %s: %w", feature, err)
		}

		kl := calculateKLDivergence(baseline, current)
		psi := calculatePSI(baseline, current)
		isDrifted := kl > s.config.Threshold

		metrics = append(metrics, DriftMetric{
			FeatureName:          feature,
			BaselineDistribution: baseline,
			CurrentDistribution:  current,
			KLDivergence:         kl,
			PSI:                  psi,
			IsDrifted:            isDrifted,
		})
		totalKL += kl
	}

	overallScore := 0.0
	if len(s.config.Features) > 0 {
		overallScore = totalKL / float64(len(s.config.Features))
	}

	return &DriftReport{
		ID:                uuid.New().String(),
		TenantID:          tenantID,
		Timestamp:         time.Now(),
		Metrics:           metrics,
		OverallDriftScore: overallScore,
		Recommendation:    classifyDrift(overallScore, s.config),
		WindowHours:       windowHours,
	}, nil
}

// calculateKLDivergence computes the Kullback-Leibler divergence from
// baseline (P) to current (Q). Uses a small epsilon to avoid log(0).
func calculateKLDivergence(baseline, current []float64) float64 {
	const epsilon = 1e-10
	n := len(baseline)
	if n == 0 || len(current) != n {
		return 0
	}

	var kl float64
	for i := 0; i < n; i++ {
		p := baseline[i] + epsilon
		q := current[i] + epsilon
		kl += p * math.Log(p/q)
	}
	return math.Max(kl, 0)
}

// calculatePSI computes the Population Stability Index between baseline
// and current distributions.
func calculatePSI(baseline, current []float64) float64 {
	const epsilon = 1e-10
	n := len(baseline)
	if n == 0 || len(current) != n {
		return 0
	}

	var psi float64
	for i := 0; i < n; i++ {
		p := baseline[i] + epsilon
		q := current[i] + epsilon
		psi += (p - q) * math.Log(p/q)
	}
	return math.Max(psi, 0)
}

// classifyDrift maps an overall drift score to a recommendation.
func classifyDrift(overallScore float64, config DriftConfig) DriftRecommendation {
	if overallScore > config.Threshold {
		return DriftRecommendationRetrain
	}
	if overallScore > config.Threshold*0.5 {
		return DriftRecommendationMonitor
	}
	return DriftRecommendationStable
}
