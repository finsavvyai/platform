package domain

import "fmt"

// ScreeningConfig holds per-tenant screening engine configuration.
type ScreeningConfig struct {
	EnabledLists     []string           `json:"enabled_lists"`
	LayerWeights     map[string]float64 `json:"layer_weights"`
	LayerThresholds  map[string]float64 `json:"layer_thresholds"`
	OverallThreshold float64            `json:"overall_threshold"`
	AutoEscalate     float64            `json:"auto_escalate"`
	AutoDismiss      float64            `json:"auto_dismiss"`
	LLMCascade       bool               `json:"llm_cascade"`
	LLMThresholdLow  float64            `json:"llm_threshold_low"`
	LLMThresholdHigh float64            `json:"llm_threshold_high"`
	MaxResults       int                `json:"max_results"`
}

// DefaultScreeningConfig returns sensible defaults for screening.
func DefaultScreeningConfig() ScreeningConfig {
	return ScreeningConfig{
		EnabledLists: []string{"OFAC", "EU", "UN", "UKOFSI"},
		LayerWeights: map[string]float64{
			"Exact": 25, "Fuzzy": 20, "Phonetic": 15,
			"Token": 15, "Embedding": 17.5, "Graph": 7.5,
		},
		LayerThresholds: map[string]float64{
			"Exact": 1.0, "Fuzzy": 0.75, "Phonetic": 0.6,
			"Token": 0.5, "Embedding": 0.8, "Graph": 0.5,
		},
		OverallThreshold: 0.5,
		AutoEscalate:     0.85,
		AutoDismiss:      0.3,
		LLMCascade:       false,
		LLMThresholdLow:  0.8,
		LLMThresholdHigh: 0.4,
		MaxResults:        50,
	}
}

// ValidateConfig checks that the screening config is well-formed.
func ValidateConfig(cfg ScreeningConfig) error {
	sum := 0.0
	for _, w := range cfg.LayerWeights {
		if w < 0 {
			return fmt.Errorf("layer weights must be non-negative")
		}
		sum += w
	}
	if sum < 99.9 || sum > 100.1 {
		return fmt.Errorf("layer weights must sum to 100, got %.1f", sum)
	}
	for layer, t := range cfg.LayerThresholds {
		if t < 0 || t > 1 {
			return fmt.Errorf("threshold for %s must be 0-1", layer)
		}
	}
	if cfg.OverallThreshold < 0 || cfg.OverallThreshold > 1 {
		return fmt.Errorf("overall_threshold must be 0-1")
	}
	if cfg.AutoDismiss >= cfg.AutoEscalate {
		return fmt.Errorf("auto_dismiss must be less than auto_escalate")
	}
	if cfg.MaxResults <= 0 {
		return fmt.Errorf("max_results must be positive")
	}
	return nil
}

// ConfigForRiskLevel returns a preset config for the given risk level.
func ConfigForRiskLevel(level string) ScreeningConfig {
	cfg := DefaultScreeningConfig()
	switch level {
	case "low":
		cfg.OverallThreshold = 0.7
		cfg.AutoDismiss = 0.5
		cfg.MaxResults = 20
	case "medium":
		// default is already medium
	case "high":
		cfg.OverallThreshold = 0.3
		cfg.AutoEscalate = 0.7
		cfg.LLMCascade = true
		cfg.MaxResults = 100
	case "critical":
		cfg.OverallThreshold = 0.2
		cfg.AutoEscalate = 0.5
		cfg.AutoDismiss = 0.1
		cfg.LLMCascade = true
		cfg.MaxResults = 200
	}
	return cfg
}
