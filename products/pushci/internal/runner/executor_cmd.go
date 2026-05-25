package runner

import (
	"context"
	"fmt"
	"log"
	"os/exec"
	"time"

	"github.com/finsavvyai/pushci/internal/detect"
	"github.com/finsavvyai/pushci/internal/observe"
)

func runChecks(ctx context.Context, p detect.Project, dir string) []Result {
	return runChecksTraced(ctx, p, dir, nil)
}

func runChecksTraced(ctx context.Context, p detect.Project, dir string, tracer *observe.Tracer) []Result {
	cmds := checksForProject(p, dir)
	var results []Result
	for i, c := range cmds {
		tid := i + 1
		if tracer != nil {
			tracer.Begin(c.name, string(p.Stack), tid)
		}
		r := runCmd(ctx, c.name, dir, c.cmd, c.args...)
		if tracer != nil {
			tracer.Complete(c.name, string(p.Stack), tid, r.Duration)
		}
		log.Printf("[%s] %s: %v (%s)", p.Stack, c.name, r.Passed, r.Duration)
		results = append(results, r)
	}
	return results
}

type check struct {
	name, cmd string
	args      []string
}

func runCmd(ctx context.Context, name, dir, cmd string, args ...string) Result {
	start := time.Now()
	c := exec.CommandContext(ctx, cmd, args...) // #nosec G204 -- cmd is from internal config, not user input
	c.Dir = dir
	out, err := c.CombinedOutput()
	return Result{
		Check: fmt.Sprintf("%s/%s", dir, name), Passed: err == nil,
		Output: truncate(string(out), 2000), Duration: time.Since(start),
	}
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[len(s)-max:]
}
