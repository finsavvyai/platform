package main

import (
	"context"
	"fmt"
	"strconv"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/detect"
	"github.com/finsavvyai/pushci/internal/runner"
)

func parseStressFlag(args []string) int {
	v := flagValue(args, "--stress")
	if v == "" {
		return 0
	}
	n, err := strconv.Atoi(v)
	if err != nil || n <= 0 {
		return 0
	}
	return n
}

func runStressMode(ctx context.Context, root string, args []string, n int) error {
	projects := detect.Scan(root)
	if len(projects) == 0 {
		cli.Warn("No projects detected. Run: pushci init")
		return nil
	}
	if detect.IsMonorepo(root) && !hasFlag(args, "--all") {
		projects = filterAffectedProjects(root, projects)
	}
	cli.Info(fmt.Sprintf("Stress testing %d project(s) — %d iterations each", len(projects), n))
	cfg := runner.StressConfig{Iterations: n, FailThreshold: 0, Verbose: hasFlag(args, "--verbose", "-v")}
	results := runner.ExecuteStress(ctx, root, projects, cfg)
	runner.PrintStressReport(results)
	for _, r := range results {
		if r.FlakeRate > 0 {
			return fmt.Errorf("flaky tests detected")
		}
	}
	return nil
}
