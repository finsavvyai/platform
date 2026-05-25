package main

import (
	"fmt"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/config"
)

// runDryRun walks a pipeline and prints the stages + commands that
// WOULD execute, without running a single one. Zero side effects —
// no git, no npm, no wrangler, no terraform. This is the guardrail
// for the teddk bug where `pushci run --dry-run` silently executed
// real `mvn`, `pytest`, `terraform init` against prod config
// because the flag was undeclared and got swallowed.
//
// stageFilter matches the --stage filter on the real runner: when
// non-empty, only the named stage is planned.
func runDryRun(root string, pipe *config.Pipeline, stageFilter string) error {
	cli.Header("PushCI Dry Run")
	cli.Info("Planning only — no commands will execute.")
	fmt.Println()

	planned := 0
	for _, stage := range pipe.Stages {
		if stageFilter != "" && stage.Name != stageFilter {
			continue
		}
		fmt.Printf("Would run stage: %s\n", cli.Bold(stage.Name))
		for _, check := range stage.Checks {
			cmd := check.Run
			if cmd == "" {
				cmd = check.Name
			}
			fmt.Printf("  $ %s\n", cli.Dim(cmd))
			planned++
		}
	}

	for _, d := range pipe.Deploys {
		fmt.Printf("Would deploy to: %s\n", cli.Bold(d.Name))
		if d.Run != "" {
			fmt.Printf("  $ %s\n", cli.Dim(d.Run))
		}
		planned++
	}

	if planned == 0 {
		cli.Warn("Pipeline has no stages or deploys to plan.")
	}
	fmt.Println()
	cli.Success(fmt.Sprintf("Dry run complete. %d step(s) planned, 0 executed.", planned))
	return nil
}
