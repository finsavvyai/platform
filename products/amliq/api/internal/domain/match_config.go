package domain

// MatchConfig lets tenants customize the screening engine.
type MatchConfig struct {
	TenantID           TenantID
	ExactEnabled       bool    `json:"exact_enabled"`
	FuzzyEnabled       bool    `json:"fuzzy_enabled"`
	PhoneticEnabled    bool    `json:"phonetic_enabled"`
	TokenEnabled       bool    `json:"token_enabled"`
	EmbeddingEnabled   bool    `json:"embedding_enabled"`
	GraphEnabled       bool    `json:"graph_enabled"`
	FuzzyThreshold     float64 `json:"fuzzy_threshold"`
	EmbeddingThreshold float64 `json:"embedding_threshold"`
	MinConfidence      float64 `json:"min_confidence"`
}

// DefaultMatchConfig returns the standard matching configuration.
func DefaultMatchConfig(tenantID TenantID) MatchConfig {
	return MatchConfig{
		TenantID:           tenantID,
		ExactEnabled:       true,
		FuzzyEnabled:       true,
		PhoneticEnabled:    true,
		TokenEnabled:       true,
		EmbeddingEnabled:   true,
		GraphEnabled:       false,
		FuzzyThreshold:     0.75,
		EmbeddingThreshold: 0.80,
		MinConfidence:      0.50,
	}
}

// IsLayerEnabled checks if a specific matching layer is active.
func (mc MatchConfig) IsLayerEnabled(layer string) bool {
	switch layer {
	case "exact":
		return mc.ExactEnabled
	case "fuzzy":
		return mc.FuzzyEnabled
	case "phonetic":
		return mc.PhoneticEnabled
	case "token":
		return mc.TokenEnabled
	case "embedding":
		return mc.EmbeddingEnabled
	case "graph":
		return mc.GraphEnabled
	default:
		return false
	}
}
