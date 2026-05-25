package screening

import "testing"

func TestCosineSimilarity(t *testing.T) {
	tests := []struct {
		name   string
		v1     []float64
		v2     []float64
		minExp float64
		maxExp float64
	}{
		{
			name:   "identical",
			v1:     []float64{1, 0, 0},
			v2:     []float64{1, 0, 0},
			minExp: 0.99,
			maxExp: 1.01,
		},
		{
			name:   "orthogonal",
			v1:     []float64{1, 0, 0},
			v2:     []float64{0, 1, 0},
			minExp: -0.01,
			maxExp: 0.01,
		},
		{
			name:   "opposite",
			v1:     []float64{1, 0, 0},
			v2:     []float64{-1, 0, 0},
			minExp: -1.01,
			maxExp: -0.99,
		},
		{
			name:   "empty",
			v1:     []float64{},
			v2:     []float64{},
			minExp: -0.01,
			maxExp: 0.01,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := cosineSimilarity(tt.v1, tt.v2)
			if got < tt.minExp || got > tt.maxExp {
				t.Errorf("cosineSimilarity() = %f, want %f-%f", got, tt.minExp, tt.maxExp)
			}
		})
	}
}
