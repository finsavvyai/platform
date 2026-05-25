package pgx

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestBatchResultString(t *testing.T) {
	tests := []struct {
		name     string
		result   domain.BatchResult
		contains string
	}{
		{
			name:     "basic result",
			result:   domain.NewBatchResult("b1", "John", 3, "John Doe", 0.95, "ofac"),
			contains: "John",
		},
		{
			name:     "zero matches",
			result:   domain.NewBatchResult("b2", "Alice", 0, "", 0.0, ""),
			contains: "0 matches",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := tt.result.String()
			if s == "" {
				t.Error("expected non-empty string")
			}
		})
	}
}

func TestVectorToString(t *testing.T) {
	tests := []struct {
		name   string
		vector []float64
		want   string
	}{
		{
			name:   "empty",
			vector: []float64{},
			want:   "[]",
		},
		{
			name:   "single",
			vector: []float64{1.0},
			want:   "[1.00000000]",
		},
		{
			name:   "multiple",
			vector: []float64{0.1, 0.2, 0.3},
			want:   "[0.10000000,0.20000000,0.30000000]",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := vectorToString(tt.vector)
			if got != tt.want {
				t.Errorf("got %q, want %q", got, tt.want)
			}
		})
	}
}
