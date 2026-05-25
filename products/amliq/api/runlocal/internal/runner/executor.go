package runner

import (
	"context"
	"fmt"
	"log"
	"os/exec"
	"time"

	"github.com/finsavvyai/pushci/internal/detect"
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
}

// Execute runs all checks for detected projects and returns results.
func Execute(ctx context.Context, root string, projects []detect.Project) *Run {
	run := &Run{Started: time.Now()}
	for _, p := range projects {
		dir := root
		if p.Dir != "." {
			dir = root + "/" + p.Dir
		}
		results := runChecks(ctx, p, dir)
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

func runChecks(ctx context.Context, p detect.Project, dir string) []Result {
	cmds := checksForProject(p)
	var results []Result
	for _, c := range cmds {
		r := runCmd(ctx, c.name, dir, c.cmd, c.args...)
		log.Printf("[%s] %s: %v (%s)", p.Stack, c.name, r.Passed, r.Duration)
		results = append(results, r)
	}
	return results
}

type check struct {
	name string
	cmd  string
	args []string
}

func runCmd(ctx context.Context, name, dir, cmd string, args ...string) Result {
	start := time.Now()
	c := exec.CommandContext(ctx, cmd, args...)
	c.Dir = dir
	out, err := c.CombinedOutput()
	return Result{
		Check:    fmt.Sprintf("%s/%s", dir, name),
		Passed:   err == nil,
		Output:   truncate(string(out), 2000),
		Duration: time.Since(start),
	}
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[len(s)-max:]
}

