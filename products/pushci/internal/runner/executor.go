package runner

import (
	"context"
	"time"

	"github.com/finsavvyai/pushci/internal/detect"
	"github.com/finsavvyai/pushci/internal/observe"
)

// Result holds the outcome of a single check.
type Result struct {
	Check    string
	Passed   bool
	Output   string
	Duration time.Duration
}

// Run holds the outcome of a full pipeline run.
type Run struct {
	Results []Result
	Passed  bool
	Started time.Time
	Elapsed time.Duration
	Tracer  *observe.Tracer
}

// Execute runs all checks for detected projects and returns results.
func Execute(ctx context.Context, root string, projects []detect.Project) *Run {
	return ExecuteWithTracer(ctx, root, projects, nil)
}

// ExecuteWithTracer runs checks with optional Perfetto tracing.
func ExecuteWithTracer(ctx context.Context, root string, projects []detect.Project, tracer *observe.Tracer) *Run {
	run := &Run{Started: time.Now(), Tracer: tracer}
	for _, p := range projects {
		dir := root
		if p.Dir != "." {
			dir = root + "/" + p.Dir
		}
		results := runChecksTraced(ctx, p, dir, tracer)
		run.Results = append(run.Results, results...)
	}
	run.Elapsed = time.Since(run.Started)
	run.Passed = true
	for _, r := range run.Results {
		if !r.Passed {
			run.Passed = false
			break
		}
	}
	return run
}
