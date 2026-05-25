package domain

import (
	"fmt"
	"strings"
)

type CountryRiskLevel string

const (
	CountryRiskLevelVeryHigh CountryRiskLevel = "very_high"
	CountryRiskLevelHigh     CountryRiskLevel = "high"
	CountryRiskLevelMedium   CountryRiskLevel = "medium"
	CountryRiskLevelLow      CountryRiskLevel = "low"
	CountryRiskLevelVeryLow  CountryRiskLevel = "very_low"
)

type CountryRiskEntry struct {
	Code      string
	Name      string
	Score     float64
	Level     CountryRiskLevel
	Sources   []string
	UpdatedAt string
}

func NewCountryRiskEntry(code, name string, score float64) (CountryRiskEntry, error) {
	code = strings.ToUpper(strings.TrimSpace(code))
	if len(code) != 2 {
		return CountryRiskEntry{}, fmt.Errorf("country code must be 2 chars, got %d", len(code))
	}
	if score < 0.0 || score > 1.0 {
		return CountryRiskEntry{}, fmt.Errorf("score must be 0.0-1.0, got %f", score)
	}
	if name = strings.TrimSpace(name); name == "" {
		return CountryRiskEntry{}, fmt.Errorf("country name required")
	}
	return CountryRiskEntry{
		Code:    code,
		Name:    name,
		Score:   score,
		Level:   riskLevelFromScore(score),
		Sources: []string{},
	}, nil
}

func riskLevelFromScore(score float64) CountryRiskLevel {
	switch {
	case score >= 0.8:
		return CountryRiskLevelVeryHigh
	case score >= 0.6:
		return CountryRiskLevelHigh
	case score >= 0.4:
		return CountryRiskLevelMedium
	case score >= 0.2:
		return CountryRiskLevelLow
	default:
		return CountryRiskLevelVeryLow
	}
}

type CountryRiskIndex struct {
	entries         map[string]CountryRiskEntry
	tenantOverrides map[string]map[string]float64
}

func NewCountryRiskIndex() *CountryRiskIndex {
	return &CountryRiskIndex{
		entries:         make(map[string]CountryRiskEntry),
		tenantOverrides: make(map[string]map[string]float64),
	}
}

func (idx *CountryRiskIndex) AddEntry(entry CountryRiskEntry) {
	idx.entries[entry.Code] = entry
}

func (idx *CountryRiskIndex) Score(countryCode string) float64 {
	code := strings.ToUpper(strings.TrimSpace(countryCode))
	if entry, ok := idx.entries[code]; ok {
		return entry.Score
	}
	return 0.1
}

func (idx *CountryRiskIndex) SetOverride(tenantID, countryCode string, score float64) error {
	code := strings.ToUpper(strings.TrimSpace(countryCode))
	if score < 0.0 || score > 1.0 {
		return fmt.Errorf("override score must be 0.0-1.0, got %f", score)
	}
	if idx.tenantOverrides[tenantID] == nil {
		idx.tenantOverrides[tenantID] = make(map[string]float64)
	}
	idx.tenantOverrides[tenantID][code] = score
	return nil
}

func (idx *CountryRiskIndex) TenantScore(tenantID, countryCode string) float64 {
	code := strings.ToUpper(strings.TrimSpace(countryCode))
	if override, ok := idx.tenantOverrides[tenantID][code]; ok {
		return override
	}
	return idx.Score(code)
}

func (idx *CountryRiskIndex) Entry(countryCode string) (CountryRiskEntry, bool) {
	code := strings.ToUpper(strings.TrimSpace(countryCode))
	entry, ok := idx.entries[code]
	return entry, ok
}
