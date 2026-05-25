package main

import (
	"context"
	"fmt"
	"time"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/config"
	pipeEngine "github.com/finsavvyai/pushci/internal/pipeline"
)

func runStageChecks(ctx context.Context, root string, stage config.Stage) bool {
	stageStart := time.Now()
	stagePassed := true

	timeout := config.ParseTimeout(stage.Timeout)
	stageCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	stageDir := root
	if stage.Dir != "" {
		stageDir = root + "/" + stage.Dir
	}

	stageEnv, ok := resolveVaultEnv(stageCtx, stage.Env)
	if !ok {
		return false
	}

	for _, check := range stage.Checks {
		cmd := check.Run
		if cmd == "" {
			cmd = check.Name
		}
		result := runShellCmd(stageCtx, stageDir, cmd, stageEnv)
		dur := time.Since(stageStart).Truncate(time.Millisecond)

		if result.passed {
			fmt.Printf("    %s %s %s\n", cli.CheckMark(), check.Name, cli.Dim(dur.String()))
		} else {
			fmt.Printf("    %s %s %s\n", cli.CrossMark(), cli.Red(check.Name), cli.Dim(dur.String()))
			stagePassed = false
			fmt.Printf("      %s %s\n", cli.Dim("$"), cli.Dim(cmd))
			lines := lastLines(result.output, 2)
			for _, l := range lines {
				fmt.Printf("      %s\n", cli.Dim(l))
			}
			if stageCtx.Err() == context.DeadlineExceeded {
				fmt.Printf("      %s %s\n", cli.Yellow("Timed out:"), fmt.Sprintf("stage exceeded %s (set timeout: in pushci.yml to increase)", timeout))
			}
			hints := matchHints(result.output)
			for _, h := range hints {
				fmt.Printf("      %s %s\n", cli.Green("Fix:"), h)
			}
			if logPath := writeCheckLog(stage.Name, check.Name, cmd, result.output); logPath != "" {
				fmt.Printf("      %s %s\n", cli.Dim("Full log:"), logPath)
			}
		}
	}
	return stagePassed
}

func printEngineResults(result pipeEngine.RunResult) {
	for _, stage := range result.Stages {
		fmt.Println()
		retryNote := ""
		if stage.Retries > 0 {
			retryNote = fmt.Sprintf(" (retried %dx)", stage.Retries)
		}
		if stage.Passed {
			cli.Success(fmt.Sprintf("%s passed (%s)%s", stage.Name, stage.Duration.Truncate(time.Millisecond), retryNote))
		} else {
			cli.Error(fmt.Sprintf("%s failed (%s)%s", stage.Name, stage.Duration.Truncate(time.Millisecond), retryNote))
		}
		for _, c := range stage.Checks {
			if c.Passed {
				fmt.Printf("    %s %s %s\n", cli.CheckMark(), c.Name, cli.Dim(c.Duration.Truncate(time.Millisecond).String()))
			} else {
				fmt.Printf("    %s %s %s\n", cli.CrossMark(), cli.Red(c.Name), cli.Dim(c.Duration.Truncate(time.Millisecond).String()))
				lines := lastLines(c.Output, 2)
				for _, l := range lines {
					fmt.Printf("      %s\n", cli.Dim(l))
				}
			}
		}
	}
}
