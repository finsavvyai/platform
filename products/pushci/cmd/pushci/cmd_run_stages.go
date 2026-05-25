package main

import (
	"context"
	"fmt"
	"time"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/config"
)

func runWithStages(ctx context.Context, root string, pipe *config.Pipeline, filter string) error {
	branch := gitBranch(root)
	cli.Info(fmt.Sprintf("Branch: %s", cli.Blue(branch)))
	initRunLogDir(root)

	completed := map[string]bool{}
	allPassed := true
	totalStart := time.Now()

	stagesCompleted := 0
	stageTotal := len(pipe.Stages)
	for i, stage := range pipe.Stages {
		if filter != "" && stage.Name != filter {
			continue
		}
		if !config.ShouldRunStage(stage, branch) {
			cli.Info(fmt.Sprintf("[%d/%d] %s — skipped (only_on: %v)", i+1, stageTotal, stage.Name, stage.OnlyOn))
			stagesCompleted++
			continue
		}

		depsOk := true
		for _, dep := range stage.DependsOn {
			if !completed[dep] {
				cli.Warn(fmt.Sprintf("[%d/%d] %s — skipped (depends on %s)", i+1, stageTotal, stage.Name, dep))
				depsOk = false
				break
			}
		}
		if !depsOk {
			allPassed = false
			stagesCompleted++
			continue
		}

		if stage.Approve && !confirmApproval("stage", stage.Name) {
			cli.Warn(fmt.Sprintf("%s — skipped (approval denied)", stage.Name))
			allPassed = false
			stagesCompleted++
			continue
		}

		fmt.Println()
		fmt.Println(cli.ProgressBar(stagesCompleted, stageTotal, stage.Name))
		cli.Step(i+1, stageTotal, cli.Bold(stage.Name))
		stageStart := time.Now()
		stagePassed := runStageChecks(ctx, root, stage)
		dur := time.Since(stageStart).Truncate(time.Millisecond)

		stagesCompleted++
		if stagePassed {
			completed[stage.Name] = true
			cli.Success(fmt.Sprintf("%s passed %s", stage.Name, cli.Dim(dur.String())))
		} else {
			allPassed = false
			cli.Error(fmt.Sprintf("%s failed %s", stage.Name, cli.Dim(dur.String())))
		}
	}
	if stageTotal > 0 {
		fmt.Println(cli.ProgressBar(stagesCompleted, stageTotal, "pipeline"))
	}

	allPassed = maybeRunDeploys(ctx, root, pipe, branch, completed, allPassed)
	if allPassed {
		if runInstalledSkills(ctx, root) {
			allPassed = false
		}
	}

	elapsed := time.Since(totalStart)
	fmt.Println()
	cli.Info(fmt.Sprintf("Total: %s", elapsed.Truncate(time.Millisecond)))

	recordPipelineRun(allPassed, elapsed, totalStart)
	sendPipelineNotifications(pipe, allPassed, elapsed, root)

	if !allPassed {
		return fmt.Errorf("pipeline failed")
	}
	cli.Success("Pipeline passed")
	return nil
}
