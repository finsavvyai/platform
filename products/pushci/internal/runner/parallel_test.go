package runner

import (
	"context"
	"testing"
	"time"

	"github.com/finsavvyai/pushci/internal/detect"
)

func TestExecuteParallelResultCount(t *testing.T) {
	// Both sequential and parallel should produce same result count.
	projects := []detect.Project{
		{Stack: detect.Go, Dir: "."},
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	seq := Execute(ctx, t.TempDir(), projects)
	par := ExecuteParallel(ctx, t.TempDir(), projects, 2)

	if len(seq.Results) != len(par.Results) {
		t.Errorf("sequential=%d results, parallel=%d results",
			len(seq.Results), len(par.Results))
	}
}

func TestExecuteParallelMaxWorkers(t *testing.T) {
	tests := []struct {
		name       string
		maxWorkers int
	}{
		{"single worker", 1},
		{"two workers", 2},
		{"zero defaults", 0},
		{"negative defaults", -1},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			projects := []detect.Project{
				{Stack: detect.Go, Dir: "."},
			}
			run := ExecuteParallel(ctx, t.TempDir(), projects, tt.maxWorkers)
			// Should not panic and should return results
			if run == nil {
				t.Fatal("run should not be nil")
			}
		})
	}
}

func TestExecuteParallelEmpty(t *testing.T) {
	ctx := context.Background()
	run := ExecuteParallel(ctx, t.TempDir(), nil, 2)
	if !run.Passed {
		t.Error("empty run should pass")
	}
	if len(run.Results) != 0 {
		t.Errorf("expected 0 results, got %d", len(run.Results))
	}
}

func TestMinHelper(t *testing.T) {
	tests := []struct {
		a, b, want int
	}{
		{1, 2, 1},
		{5, 3, 3},
		{4, 4, 4},
	}
	for _, tt := range tests {
		if got := min(tt.a, tt.b); got != tt.want {
			t.Errorf("min(%d,%d) = %d, want %d", tt.a, tt.b, got, tt.want)
		}
	}
}
