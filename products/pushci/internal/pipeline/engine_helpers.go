package pipeline

import (
	"context"
	"time"

	"github.com/finsavvyai/pushci/internal/config"
)

func executeWithRetry(ctx context.Context, root string, stage config.Stage) StageResult {
	maxRetries := stage.Retry
	if maxRetries < 1 {
		maxRetries = 1
	}

	var stageResult StageResult
	for attempt := 0; attempt < maxRetries; attempt++ {
		stageResult = executeStage(ctx, root, stage)
		stageResult.Retries = attempt
		if stageResult.Passed && stage.RetryUntil != "failure" {
			break
		}
		if !stageResult.Passed && stage.RetryUntil == "failure" {
			break
		}
	}
	return stageResult
}

func executeStage(ctx context.Context, root string, stage config.Stage) StageResult {
	start := time.Now()

	timeout := parseTimeout(stage.Timeout)
	if timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, timeout)
		defer cancel()
	}

	var checks []CheckResult
	if stage.Parallel {
		checks = runParallel(ctx, root, stage.Checks, stage.Env)
	} else {
		checks = runSequential(ctx, root, stage.Checks, stage.Env)
	}

	passed := true
	for _, c := range checks {
		if !c.Passed {
			passed = false
			break
		}
	}

	return StageResult{
		Name: stage.Name, Passed: passed,
		Duration: time.Since(start), Checks: checks,
	}
}

func allDepsOk(deps []string, completed map[string]bool) bool {
	for _, d := range deps {
		if !completed[d] {
			return false
		}
	}
	return true
}

func anyFailed(stages []string, failed map[string]bool) bool {
	for _, s := range stages {
		if failed[s] {
			return true
		}
	}
	return false
}

func parseTimeout(s string) time.Duration {
	if s == "" {
		return 0
	}
	d, _ := time.ParseDuration(s)
	return d
}
