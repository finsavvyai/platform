package main

import (
	"context"
	"fmt"
	"time"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/config"
	pipeEngine "github.com/finsavvyai/pushci/internal/pipeline"
)

// runWithEngine uses the pipeline engine for configs that have
// advanced operators (retry, on_failure, approve, timeout, if).
// After stages complete, it hands off to maybeRunDeploys so
// deploy targets work identically to the stages runner path.
func runWithEngine(ctx context.Context, root string, pipe *config.Pipeline) error {
	branch := gitBranch(root)
	cli.Info(fmt.Sprintf("Pipeline engine — branch: %s", cli.Blue(branch)))

	result := pipeEngine.Execute(ctx, root, pipe, branch)
	printEngineResults(result)
	skillFailed := runInstalledSkills(ctx, root)

	allPassed := result.Passed && !skillFailed

	// Build completed map from engine results so deploy
	// depends_on checks work correctly.
	completed := map[string]bool{}
	for _, s := range result.Stages {
		if s.Passed {
			completed[s.Name] = true
		}
	}
	allPassed = maybeRunDeploys(ctx, root, pipe, branch, completed, allPassed)

	fmt.Println()
	cli.Info(fmt.Sprintf("Total: %s", result.Duration.Truncate(time.Millisecond)))

	recordPipelineRun(allPassed, result.Duration, time.Now().Add(-result.Duration))
	sendPipelineNotifications(pipe, allPassed, result.Duration, root)

	if !allPassed {
		return fmt.Errorf("pipeline failed")
	}
	cli.Success("Pipeline passed")
	return nil
}
