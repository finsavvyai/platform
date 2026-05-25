// Pipeline execution engine — handles operators: >>, ~~, ?>>, !>>, *N

package pipeline

import (
	"context"
	"fmt"
	"time"

	"github.com/finsavvyai/pushci/internal/config"
)

// StageResult tracks the outcome of a stage execution.
type StageResult struct {
	Name     string
	Passed   bool
	Duration time.Duration
	Checks   []CheckResult
	Retries  int
}

// CheckResult tracks individual check outcome.
type CheckResult struct {
	Name     string
	Passed   bool
	Output   string
	Duration time.Duration
}

// RunResult is the full pipeline execution result.
type RunResult struct {
	Passed   bool
	Stages   []StageResult
	Duration time.Duration
}

// Execute runs a pipeline with full operator support.
func Execute(ctx context.Context, root string, pipe *config.Pipeline, branch string) RunResult {
	start := time.Now()
	completed := map[string]bool{}
	failed := map[string]bool{}
	var results []StageResult
	allPassed := true

	for _, stage := range pipe.Stages {
		if !config.ShouldRunStage(stage, branch) {
			continue
		}
		if stage.OnSuccess && !allDepsOk(stage.DependsOn, completed) {
			continue
		}
		if len(stage.OnFailure) > 0 && !anyFailed(stage.OnFailure, failed) {
			continue
		}
		if !allDepsOk(stage.DependsOn, completed) && len(stage.OnFailure) == 0 {
			allPassed = false
			continue
		}
		if stage.Approve {
			fmt.Printf("\n  Approval: %s [y/N]: ", stage.Name)
			var answer string
			fmt.Scanln(&answer)
			if answer != "y" && answer != "Y" {
				continue
			}
		}

		stageResult := executeWithRetry(ctx, root, stage)
		results = append(results, stageResult)
		if stageResult.Passed {
			completed[stage.Name] = true
		} else {
			failed[stage.Name] = true
			allPassed = false
		}
	}

	return RunResult{Passed: allPassed, Stages: results, Duration: time.Since(start)}
}
