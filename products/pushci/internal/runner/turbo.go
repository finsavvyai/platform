package runner

import (
	"context"
	"fmt"
	"os/exec"
	"time"
)

// TurboRun executes a check via turbo run with optional filter.
func TurboRun(ctx context.Context, root, task, filter string) Result {
	args := []string{"run", task}
	if filter != "" {
		args = append(args, "--filter="+filter)
	}
	return runTurboCmd(ctx, root, "turbo", task, args...)
}

// TurboRunAll executes multiple checks via turbo in sequence.
func TurboRunAll(ctx context.Context, root string, tasks []string, filter string) []Result {
	var results []Result
	for _, task := range tasks {
		r := TurboRun(ctx, root, task, filter)
		results = append(results, r)
	}
	return results
}

// TurboChecks returns checks configured for a turbo monorepo.
func TurboChecks(tasks []string) []check {
	var checks []check
	for _, t := range tasks {
		checks = append(checks, check{
			name: "turbo:" + t,
			cmd:  "npx",
			args: []string{"turbo", "run", t},
		})
	}
	return checks
}

func runTurboCmd(ctx context.Context, dir, cmd, label string, args ...string) Result {
	start := time.Now()
	c := exec.CommandContext(ctx, "npx", args...)
	c.Dir = dir
	out, err := c.CombinedOutput()
	return Result{
		Check:    fmt.Sprintf("%s/turbo:%s", dir, label),
		Passed:   err == nil,
		Output:   truncate(string(out), 2000),
		Duration: time.Since(start),
	}
}
