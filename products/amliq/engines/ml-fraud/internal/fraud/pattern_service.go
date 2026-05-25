package fraud

import (
	"fmt"
	"sort"
	"sync"
	"time"
)

// PatternSharingService defines the interface for cross-tenant pattern sharing.
type PatternSharingService interface {
	ContributePatterns(contribution *PatternContribution) error
	GetAggregatePatterns(tenantID string, threshold int) ([]SharedPattern, error)
	GetTenantConfig(tenantID string) (*PatternSharingConfig, error)
	UpdateTenantConfig(config *PatternSharingConfig) error
	GetAggregateStats() (*AggregatePatternStats, error)
}

// InMemoryPatternStore is an in-memory implementation of PatternSharingService.
type InMemoryPatternStore struct {
	mu            sync.RWMutex
	contributions map[string][]SharedPattern       // tenantID -> patterns
	configs       map[string]*PatternSharingConfig  // tenantID -> config
}

// NewInMemoryPatternStore creates a new in-memory pattern store.
func NewInMemoryPatternStore() *InMemoryPatternStore {
	return &InMemoryPatternStore{
		contributions: make(map[string][]SharedPattern),
		configs:       make(map[string]*PatternSharingConfig),
	}
}

// ContributePatterns accepts tenant patterns and stores them.
func (s *InMemoryPatternStore) ContributePatterns(contribution *PatternContribution) error {
	if err := contribution.Validate(); err != nil {
		return fmt.Errorf("invalid contribution: %w", err)
	}

	s.mu.RLock()
	config, exists := s.configs[contribution.TenantID]
	s.mu.RUnlock()

	if exists && !config.OptIn {
		return fmt.Errorf("tenant %s has not opted in to pattern sharing", contribution.TenantID)
	}

	now := time.Now()
	for i := range contribution.Patterns {
		contribution.Patterns[i].FirstSeen = now
		contribution.Patterns[i].LastSeen = now
		contribution.Patterns[i].TenantCount = 1
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.contributions[contribution.TenantID] = append(
		s.contributions[contribution.TenantID], contribution.Patterns...)
	return nil
}

// GetAggregatePatterns returns patterns meeting k-anonymity threshold.
func (s *InMemoryPatternStore) GetAggregatePatterns(tenantID string, threshold int) ([]SharedPattern, error) {
	if tenantID == "" {
		return nil, fmt.Errorf("tenant_id is required")
	}
	if threshold < 3 {
		threshold = 3
	}

	s.mu.RLock()
	config, exists := s.configs[tenantID]
	s.mu.RUnlock()

	if exists && !config.OptIn {
		return nil, fmt.Errorf("tenant %s has not opted in to pattern sharing", tenantID)
	}

	// Aggregate patterns across all tenants
	patternMap := s.aggregateByType()

	// Filter by k-anonymity: only include patterns seen by >= threshold tenants
	result := make([]SharedPattern, 0)
	for _, p := range patternMap {
		if p.TenantCount >= threshold {
			result = append(result, p)
		}
	}
	return result, nil
}

// GetTenantConfig returns the sharing config for a tenant.
func (s *InMemoryPatternStore) GetTenantConfig(tenantID string) (*PatternSharingConfig, error) {
	if tenantID == "" {
		return nil, fmt.Errorf("tenant_id is required")
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	config, exists := s.configs[tenantID]
	if !exists {
		return DefaultPatternConfig(tenantID), nil
	}
	return config, nil
}

// UpdateTenantConfig updates the sharing config for a tenant.
func (s *InMemoryPatternStore) UpdateTenantConfig(config *PatternSharingConfig) error {
	if err := config.Validate(); err != nil {
		return fmt.Errorf("invalid config: %w", err)
	}
	config.LastUpdated = time.Now()
	s.mu.Lock()
	defer s.mu.Unlock()
	s.configs[config.TenantID] = config
	return nil
}

// GetAggregateStats returns aggregate statistics across all tenants.
func (s *InMemoryPatternStore) GetAggregateStats() (*AggregatePatternStats, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	patternMap := s.aggregateByType()

	// Sort by frequency descending
	top := make([]PatternFrequency, 0, len(patternMap))
	for _, p := range patternMap {
		top = append(top, PatternFrequency{
			PatternType: p.PatternType, Frequency: p.Frequency, TenantCount: p.TenantCount,
		})
	}
	sort.Slice(top, func(i, j int) bool { return top[i].Frequency > top[j].Frequency })
	if len(top) > 10 {
		top = top[:10]
	}

	return &AggregatePatternStats{
		TotalPatterns:       len(patternMap),
		ContributingTenants: len(s.contributions),
		TopPatternTypes:     top,
		LastAggregated:      time.Now(),
	}, nil
}

// aggregateByType merges patterns across all tenants by pattern_type.
func (s *InMemoryPatternStore) aggregateByType() map[string]SharedPattern {
	patternMap := make(map[string]SharedPattern)
	tenantSeen := make(map[string]map[string]bool) // patternType -> tenantID set

	for tenantID, patterns := range s.contributions {
		for _, p := range patterns {
			existing, ok := patternMap[p.PatternType]
			if !ok {
				existing = SharedPattern{
					PatternType: p.PatternType,
					RiskIndicators: p.RiskIndicators,
					FirstSeen: p.FirstSeen, LastSeen: p.LastSeen,
				}
				tenantSeen[p.PatternType] = make(map[string]bool)
			}
			existing.Frequency += p.Frequency
			tenantSeen[p.PatternType][tenantID] = true
			existing.TenantCount = len(tenantSeen[p.PatternType])
			if p.LastSeen.After(existing.LastSeen) {
				existing.LastSeen = p.LastSeen
			}
			patternMap[p.PatternType] = existing
		}
	}
	return patternMap
}
