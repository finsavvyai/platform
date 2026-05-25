package domain

import "testing"

func TestNewConfidence(t *testing.T) {
	tests := []struct {
		name      string
		score     float64
		shouldErr bool
	}{
		{"zero", 0.0, false},
		{"half", 0.5, false},
		{"one", 1.0, false},
		{"negative", -0.1, true},
		{"above_one", 1.5, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := NewConfidence(tt.score)
			if (err != nil) != tt.shouldErr {
				t.Errorf("NewConfidence() error = %v, shouldErr = %v", err, tt.shouldErr)
			}
		})
	}
}

func TestConfidenceLevel(t *testing.T) {
	tests := []struct {
		name     string
		score    float64
		expected string
	}{
		{"high", 0.9, "High"},
		{"medium", 0.6, "Medium"},
		{"low", 0.2, "Low"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			conf, _ := NewConfidence(tt.score)
			if conf.Level() != tt.expected {
				t.Errorf("Level() = %s, want %s", conf.Level(), tt.expected)
			}
		})
	}
}

func TestConfidenceIsAbove(t *testing.T) {
	conf, _ := NewConfidence(0.75)
	if !conf.IsAbove(0.5) {
		t.Errorf("IsAbove(0.5) should be true for 0.75")
	}
	if conf.IsAbove(0.8) {
		t.Errorf("IsAbove(0.8) should be false for 0.75")
	}
}
