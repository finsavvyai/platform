package runner

import (
	"testing"
	"time"
)

func TestComputeFlakeRate(t *testing.T) {
	tests := []struct {
		name  string
		fails int
		runs  int
		want  float64
	}{
		{"no runs", 0, 0, 0},
		{"all pass", 0, 10, 0},
		{"all fail", 10, 10, 1.0},
		{"half flaky", 5, 10, 0.5},
		{"one flake", 1, 10, 0.1},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := computeFlakeRate(tt.fails, tt.runs)
			if got != tt.want {
				t.Errorf("computeFlakeRate(%d, %d) = %f, want %f",
					tt.fails, tt.runs, got, tt.want)
			}
		})
	}
}

func TestComputeAvgDuration(t *testing.T) {
	tests := []struct {
		name      string
		durations []time.Duration
		want      time.Duration
	}{
		{"empty", nil, 0},
		{"single", []time.Duration{2 * time.Second}, 2 * time.Second},
		{"multiple", []time.Duration{1 * time.Second, 3 * time.Second}, 2 * time.Second},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := computeAvgDuration(tt.durations)
			if got != tt.want {
				t.Errorf("computeAvgDuration = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestStressResultFields(t *testing.T) {
	res := StressResult{
		CheckName: "test",
		Runs:      10,
		Passes:    8,
		Fails:     2,
		FlakeRate: 0.2,
	}
	if res.CheckName != "test" {
		t.Errorf("CheckName = %q, want %q", res.CheckName, "test")
	}
	if res.FlakeRate != 0.2 {
		t.Errorf("FlakeRate = %f, want 0.2", res.FlakeRate)
	}
}

func TestCountFlaky(t *testing.T) {
	results := []StressResult{
		{CheckName: "build", FlakeRate: 0},
		{CheckName: "test", FlakeRate: 0.1},
		{CheckName: "lint", FlakeRate: 0.5},
	}
	flaky, total := countFlaky(results)
	if flaky != 2 {
		t.Errorf("flaky = %d, want 2", flaky)
	}
	if total != 3 {
		t.Errorf("total = %d, want 3", total)
	}
}

func TestBuildStressRows(t *testing.T) {
	results := []StressResult{
		{CheckName: "build", Runs: 5, Passes: 5, Fails: 0, FlakeRate: 0, AvgDuration: time.Second},
	}
	rows := buildStressRows(results)
	if len(rows) != 1 {
		t.Fatalf("rows = %d, want 1", len(rows))
	}
	if rows[0][0] != "build" {
		t.Errorf("check name = %q, want %q", rows[0][0], "build")
	}
	if rows[0][1] != "5" {
		t.Errorf("runs = %q, want %q", rows[0][1], "5")
	}
}
