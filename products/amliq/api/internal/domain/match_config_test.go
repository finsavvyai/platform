package domain

import "testing"

func TestDefaultMatchConfig(t *testing.T) {
	tid, _ := NewTenantID("tnt_aabbccddee11")
	cfg := DefaultMatchConfig(tid)

	tests := []struct {
		field string
		want  bool
	}{
		{"exact", true},
		{"fuzzy", true},
		{"phonetic", true},
		{"token", true},
		{"embedding", true},
		{"graph", false},
	}
	for _, tt := range tests {
		t.Run(tt.field, func(t *testing.T) {
			got := cfg.IsLayerEnabled(tt.field)
			if got != tt.want {
				t.Errorf("IsLayerEnabled(%s)=%v, want=%v", tt.field, got, tt.want)
			}
		})
	}
}

func TestMatchConfigThresholds(t *testing.T) {
	tid, _ := NewTenantID("tnt_aabbccddee11")
	cfg := DefaultMatchConfig(tid)

	if cfg.FuzzyThreshold != 0.75 {
		t.Errorf("fuzzy threshold=%f, want 0.75", cfg.FuzzyThreshold)
	}
	if cfg.EmbeddingThreshold != 0.80 {
		t.Errorf("embedding threshold=%f, want 0.80", cfg.EmbeddingThreshold)
	}
	if cfg.MinConfidence != 0.50 {
		t.Errorf("min confidence=%f, want 0.50", cfg.MinConfidence)
	}
}

func TestMatchConfigUnknownLayer(t *testing.T) {
	tid, _ := NewTenantID("tnt_aabbccddee11")
	cfg := DefaultMatchConfig(tid)
	if cfg.IsLayerEnabled("nonexistent") {
		t.Error("unknown layer should return false")
	}
}
