package screening

import (
	"testing"
)

func TestNewCaseCreator(t *testing.T) {
	tests := []struct {
		name      string
		threshold float64
		want      float64
	}{
		{"custom threshold", 0.80, 0.80},
		{"zero defaults to 0.70", 0, 0.70},
		{"negative defaults to 0.70", -0.5, 0.70},
		{"low threshold", 0.50, 0.50},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cc := NewCaseCreator(nil, tt.threshold)
			if cc.threshold != tt.want {
				t.Errorf("threshold = %f, want %f", cc.threshold, tt.want)
			}
		})
	}
}
