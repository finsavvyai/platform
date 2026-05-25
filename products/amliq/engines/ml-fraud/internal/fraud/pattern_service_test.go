package fraud

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newSeededPatternStore() *InMemoryPatternStore {
	store := NewInMemoryPatternStore()
	// Opt in 6 tenants
	for _, tid := range []string{"t1", "t2", "t3", "t4", "t5", "t6"} {
		_ = store.UpdateTenantConfig(&PatternSharingConfig{
			TenantID: tid, OptIn: true, AnonymizationThreshold: 5, SharingScope: "industry_wide",
		})
	}
	// Each tenant contributes the same pattern type "velocity_attack"
	for _, tid := range []string{"t1", "t2", "t3", "t4", "t5", "t6"} {
		_ = store.ContributePatterns(&PatternContribution{
			TenantID: tid,
			Patterns: []SharedPattern{
				{PatternType: "velocity_attack", Frequency: 10, RiskIndicators: []string{"high_speed"}},
			},
		})
	}
	// Only 2 tenants contribute "card_testing" (below k-anonymity=5)
	for _, tid := range []string{"t1", "t2"} {
		_ = store.ContributePatterns(&PatternContribution{
			TenantID: tid,
			Patterns: []SharedPattern{
				{PatternType: "card_testing", Frequency: 3, RiskIndicators: []string{"small_amounts"}},
			},
		})
	}
	return store
}

func TestSvcContributePatterns_Success(t *testing.T) {
	store := NewInMemoryPatternStore()
	_ = store.UpdateTenantConfig(&PatternSharingConfig{
		TenantID: "t1", OptIn: true, AnonymizationThreshold: 5, SharingScope: "industry_wide",
	})
	err := store.ContributePatterns(&PatternContribution{
		TenantID: "t1",
		Patterns: []SharedPattern{{PatternType: "velocity", Frequency: 5}},
	})
	assert.NoError(t, err)
}

func TestSvcContributePatterns_NotOptedIn(t *testing.T) {
	store := NewInMemoryPatternStore()
	_ = store.UpdateTenantConfig(&PatternSharingConfig{
		TenantID: "t1", OptIn: false, AnonymizationThreshold: 5, SharingScope: "industry_wide",
	})
	err := store.ContributePatterns(&PatternContribution{
		TenantID: "t1",
		Patterns: []SharedPattern{{PatternType: "velocity", Frequency: 5}},
	})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not opted in")
}

func TestContributePatterns_InvalidContribution(t *testing.T) {
	store := NewInMemoryPatternStore()
	err := store.ContributePatterns(&PatternContribution{TenantID: "", Patterns: nil})
	assert.Error(t, err)
}

func TestGetAggregatePatterns_KAnonymity(t *testing.T) {
	store := newSeededPatternStore()
	patterns, err := store.GetAggregatePatterns("t1", 5)
	require.NoError(t, err)

	// velocity_attack has 6 tenants (>= 5), should be included
	// card_testing has 2 tenants (< 5), should be excluded
	assert.Len(t, patterns, 1)
	assert.Equal(t, "velocity_attack", patterns[0].PatternType)
	assert.Equal(t, 6, patterns[0].TenantCount)
}

func TestGetAggregatePatterns_LowerThreshold(t *testing.T) {
	store := newSeededPatternStore()
	patterns, err := store.GetAggregatePatterns("t1", 3)
	require.NoError(t, err)

	// With threshold=3, only velocity_attack (6 tenants) still qualifies
	// card_testing has only 2 tenants
	assert.Len(t, patterns, 1)
}

func TestSvcGetAggregatePatterns_NotOptedIn(t *testing.T) {
	store := NewInMemoryPatternStore()
	_ = store.UpdateTenantConfig(&PatternSharingConfig{
		TenantID: "t1", OptIn: false, AnonymizationThreshold: 5, SharingScope: "industry_wide",
	})
	_, err := store.GetAggregatePatterns("t1", 5)
	assert.Error(t, err)
}

func TestGetAggregatePatterns_RequiresTenantID(t *testing.T) {
	store := NewInMemoryPatternStore()
	_, err := store.GetAggregatePatterns("", 5)
	assert.Error(t, err)
}

func TestGetTenantConfig_Default(t *testing.T) {
	store := NewInMemoryPatternStore()
	cfg, err := store.GetTenantConfig("new-tenant")
	require.NoError(t, err)
	assert.Equal(t, "new-tenant", cfg.TenantID)
	assert.False(t, cfg.OptIn)
}

func TestGetTenantConfig_Existing(t *testing.T) {
	store := NewInMemoryPatternStore()
	_ = store.UpdateTenantConfig(&PatternSharingConfig{
		TenantID: "t1", OptIn: true, AnonymizationThreshold: 5, SharingScope: "region_specific",
	})
	cfg, err := store.GetTenantConfig("t1")
	require.NoError(t, err)
	assert.True(t, cfg.OptIn)
	assert.Equal(t, "region_specific", cfg.SharingScope)
}

func TestUpdateTenantConfig_InvalidThreshold(t *testing.T) {
	store := NewInMemoryPatternStore()
	err := store.UpdateTenantConfig(&PatternSharingConfig{
		TenantID: "t1", AnonymizationThreshold: 1, SharingScope: "industry_wide",
	})
	assert.Error(t, err)
}

func TestGetAggregateStats(t *testing.T) {
	store := newSeededPatternStore()
	stats, err := store.GetAggregateStats()
	require.NoError(t, err)
	assert.Equal(t, 6, stats.ContributingTenants)
	assert.GreaterOrEqual(t, stats.TotalPatterns, 1)
	assert.NotEmpty(t, stats.TopPatternTypes)
}

func TestTenantIsolation_CannotSeeRawData(t *testing.T) {
	store := newSeededPatternStore()
	// t1 gets aggregate patterns, not raw data from t2
	patterns, err := store.GetAggregatePatterns("t1", 5)
	require.NoError(t, err)
	for _, p := range patterns {
		// Patterns should be aggregated, not tenant-specific
		assert.Greater(t, p.TenantCount, 1)
	}
}
