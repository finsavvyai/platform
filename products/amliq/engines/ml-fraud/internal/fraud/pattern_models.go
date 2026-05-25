package fraud

import (
	"fmt"
	"time"
)

// SharedPattern represents an anonymized fraud pattern shared across tenants.
type SharedPattern struct {
	PatternID      string            `json:"pattern_id"`
	PatternType    string            `json:"pattern_type" validate:"required"`
	Frequency      int               `json:"frequency"`
	RiskIndicators []string          `json:"risk_indicators"`
	AnonymizedStats *AnonymizedStats `json:"anonymized_stats"`
	FirstSeen      time.Time         `json:"first_seen"`
	LastSeen       time.Time         `json:"last_seen"`
	TenantCount    int               `json:"tenant_count"`
}

// AnonymizedStats holds aggregate statistics without tenant-identifiable data.
type AnonymizedStats struct {
	AvgFrequency    float64 `json:"avg_frequency"`
	AvgRiskScore    float64 `json:"avg_risk_score"`
	RegionBreakdown map[string]int `json:"region_breakdown,omitempty"`
}

// PatternSharingConfig defines a tenant's opt-in settings for pattern sharing.
type PatternSharingConfig struct {
	TenantID              string `json:"tenant_id" validate:"required"`
	OptIn                 bool   `json:"opt_in"`
	AnonymizationThreshold int   `json:"anonymization_threshold" validate:"min=3"`
	SharingScope          string `json:"sharing_scope" validate:"oneof=industry_wide region_specific"`
	LastUpdated           time.Time `json:"last_updated"`
}

// AggregatePatternStats holds cross-tenant aggregate pattern statistics.
type AggregatePatternStats struct {
	TotalPatterns          int                `json:"total_patterns"`
	ContributingTenants    int                `json:"contributing_tenants"`
	TopPatternTypes        []PatternFrequency `json:"top_pattern_types"`
	TrendData              []PatternTrendPoint `json:"trend_data"`
	LastAggregated         time.Time           `json:"last_aggregated"`
}

// PatternFrequency pairs a pattern type with its frequency count.
type PatternFrequency struct {
	PatternType string `json:"pattern_type"`
	Frequency   int    `json:"frequency"`
	TenantCount int    `json:"tenant_count"`
}

// PatternTrendPoint represents pattern activity at a point in time.
type PatternTrendPoint struct {
	Date    string `json:"date"`
	Count   int    `json:"count"`
	NewPatterns int `json:"new_patterns"`
}

// PatternContribution represents what a tenant contributes (anonymized).
type PatternContribution struct {
	TenantID      string           `json:"tenant_id" validate:"required"`
	Patterns      []SharedPattern  `json:"patterns" validate:"required,min=1"`
	ContributedAt time.Time        `json:"contributed_at"`
}

// Validate checks that a PatternSharingConfig has valid fields.
func (c *PatternSharingConfig) Validate() error {
	if c.TenantID == "" {
		return fmt.Errorf("tenant_id is required")
	}
	if c.AnonymizationThreshold < 3 {
		return fmt.Errorf("anonymization_threshold must be >= 3 (minimum k-anonymity)")
	}
	if c.SharingScope != "industry_wide" && c.SharingScope != "region_specific" {
		return fmt.Errorf("sharing_scope must be 'industry_wide' or 'region_specific'")
	}
	return nil
}

// Validate checks that a PatternContribution has valid fields.
func (c *PatternContribution) Validate() error {
	if c.TenantID == "" {
		return fmt.Errorf("tenant_id is required")
	}
	if len(c.Patterns) == 0 {
		return fmt.Errorf("at least one pattern is required")
	}
	for i, p := range c.Patterns {
		if p.PatternType == "" {
			return fmt.Errorf("pattern[%d].pattern_type is required", i)
		}
	}
	return nil
}

// DefaultPatternConfig returns a default opt-out configuration.
func DefaultPatternConfig(tenantID string) *PatternSharingConfig {
	return &PatternSharingConfig{
		TenantID:              tenantID,
		OptIn:                 false,
		AnonymizationThreshold: 5,
		SharingScope:          "industry_wide",
		LastUpdated:           time.Now(),
	}
}
