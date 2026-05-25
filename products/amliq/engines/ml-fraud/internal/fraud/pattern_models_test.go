package fraud

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPatternSharingConfig_Validate_RequiresTenantID(t *testing.T) {
	cfg := &PatternSharingConfig{AnonymizationThreshold: 5, SharingScope: "industry_wide"}
	assert.EqualError(t, cfg.Validate(), "tenant_id is required")
}

func TestPatternSharingConfig_Validate_MinAnonymizationThreshold(t *testing.T) {
	cfg := &PatternSharingConfig{TenantID: "t1", AnonymizationThreshold: 2, SharingScope: "industry_wide"}
	assert.EqualError(t, cfg.Validate(), "anonymization_threshold must be >= 3 (minimum k-anonymity)")
}

func TestPatternSharingConfig_Validate_InvalidScope(t *testing.T) {
	cfg := &PatternSharingConfig{TenantID: "t1", AnonymizationThreshold: 5, SharingScope: "invalid"}
	assert.Error(t, cfg.Validate())
}

func TestPatternSharingConfig_Validate_Valid(t *testing.T) {
	cfg := &PatternSharingConfig{TenantID: "t1", AnonymizationThreshold: 5, SharingScope: "industry_wide"}
	assert.NoError(t, cfg.Validate())

	cfg.SharingScope = "region_specific"
	assert.NoError(t, cfg.Validate())
}

func TestPatternContribution_Validate_RequiresTenantID(t *testing.T) {
	c := &PatternContribution{Patterns: []SharedPattern{{PatternType: "velocity"}}}
	assert.EqualError(t, c.Validate(), "tenant_id is required")
}

func TestPatternContribution_Validate_RequiresPatterns(t *testing.T) {
	c := &PatternContribution{TenantID: "t1", Patterns: []SharedPattern{}}
	assert.EqualError(t, c.Validate(), "at least one pattern is required")
}

func TestPatternContribution_Validate_PatternTypeRequired(t *testing.T) {
	c := &PatternContribution{TenantID: "t1", Patterns: []SharedPattern{{PatternType: ""}}}
	assert.Error(t, c.Validate())
}

func TestPatternContribution_Validate_Valid(t *testing.T) {
	c := &PatternContribution{
		TenantID: "t1",
		Patterns: []SharedPattern{
			{PatternType: "velocity_attack", Frequency: 10, RiskIndicators: []string{"high_speed"}},
		},
	}
	assert.NoError(t, c.Validate())
}

func TestSharedPattern_JSONSerialization(t *testing.T) {
	pattern := SharedPattern{
		PatternID: "p1", PatternType: "velocity_attack", Frequency: 42,
		RiskIndicators: []string{"high_speed", "multiple_cards"},
		AnonymizedStats: &AnonymizedStats{AvgFrequency: 35.0, AvgRiskScore: 0.82},
		FirstSeen: time.Now().Add(-24 * time.Hour), LastSeen: time.Now(),
		TenantCount: 8,
	}

	data, err := json.Marshal(pattern)
	require.NoError(t, err)

	var decoded SharedPattern
	require.NoError(t, json.Unmarshal(data, &decoded))
	assert.Equal(t, pattern.PatternType, decoded.PatternType)
	assert.Equal(t, pattern.Frequency, decoded.Frequency)
	assert.Equal(t, pattern.TenantCount, decoded.TenantCount)
}

func TestAggregatePatternStats_JSONSerialization(t *testing.T) {
	stats := AggregatePatternStats{
		TotalPatterns:       100,
		ContributingTenants: 12,
		TopPatternTypes: []PatternFrequency{
			{PatternType: "velocity", Frequency: 50, TenantCount: 10},
		},
	}

	data, err := json.Marshal(stats)
	require.NoError(t, err)

	var decoded AggregatePatternStats
	require.NoError(t, json.Unmarshal(data, &decoded))
	assert.Equal(t, 100, decoded.TotalPatterns)
	assert.Len(t, decoded.TopPatternTypes, 1)
}

func TestDefaultPatternConfig(t *testing.T) {
	cfg := DefaultPatternConfig("tenant-x")
	assert.Equal(t, "tenant-x", cfg.TenantID)
	assert.False(t, cfg.OptIn)
	assert.Equal(t, 5, cfg.AnonymizationThreshold)
	assert.Equal(t, "industry_wide", cfg.SharingScope)
}
