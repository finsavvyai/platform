package runner

import (
	"context"
	"fmt"
	"os/exec"
	"time"

	"github.com/finsavvyai/pushci/internal/detect"
)

// StressConfig controls how many times each check is repeated.
type StressConfig struct {
	Iterations    int
	FailThreshold float64
	Verbose       bool
}

// StressResult holds aggregated stats for a single check under stress.
type StressResult struct {
	CheckName   string
	Runs        int
	Passes      int
	Fails       int
	Durations   []time.Duration
	AvgDuration time.Duration
	FlakeRate   float64
}

// RunStress executes a single check N times and collects stats.
func RunStress(ctx context.Context, dir string, c check, cfg StressConfig) StressResult {
	res := StressResult{
		CheckName: c.name,
		Runs:      cfg.Iterations,
		Durations: make([]time.Duration, 0, cfg.Iterations),
	}

	for i := 0; i < cfg.Iterations; i++ {
		r := runStressIteration(ctx, dir, c)
		res.Durations = append(res.Durations, r.Duration)
		if r.Passed {
			res.Passes++
		} else {
			res.Fails++
		}
	}

	res.FlakeRate = computeFlakeRate(res.Fails, res.Runs)
	res.AvgDuration = computeAvgDuration(res.Durations)
	return res
}

func runStressIteration(ctx context.Context, dir string, c check) Result {
	start := time.Now()
	cmd := exec.CommandContext(ctx, c.cmd, c.args...)
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	return Result{
		Check:    fmt.Sprintf("%s/%s", dir, c.name),
		Passed:   err == nil,
		Output:   truncate(string(out), 2000),
		Duration: time.Since(start),
	}
}

// ExecuteStress runs all checks for detected projects N times each.
func ExecuteStress(ctx context.Context, root string, projects []detect.Project, cfg StressConfig) []StressResult {
	var results []StressResult
	for _, p := range projects {
		dir := root
		if p.Dir != "." {
			dir = root + "/" + p.Dir
		}
		cmds := checksForProject(p, dir)
		for _, c := range cmds {
			res := RunStress(ctx, dir, c, cfg)
			res.CheckName = fmt.Sprintf("%s/%s", p.Dir, c.name)
			results = append(results, res)
		}
	}
	return results
}

func computeFlakeRate(fails, runs int) float64 {
	if runs == 0 {
		return 0
	}
	return float64(fails) / float64(runs)
}

func computeAvgDuration(durations []time.Duration) time.Duration {
	if len(durations) == 0 {
		return 0
	}
	var total time.Duration
	for _, d := range durations {
		total += d
	}
	return total / time.Duration(len(durations))
}
