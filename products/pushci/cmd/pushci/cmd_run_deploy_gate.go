package main

import (
	"context"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/config"
)

// maybeRunDeploys checks whether deploys should run and executes
// them if eligible. Extracted from runWithStages to keep that
// function under the 100-line cap.
func maybeRunDeploys(ctx context.Context, root string, pipe *config.Pipeline, branch string, completed map[string]bool, allPassed bool) bool {
	if len(pipe.Deploys) == 0 && withDeployOverride {
		cli.Warn("--with-deploy passed but pushci.yml has no deploy: section — nothing to deploy")
		cli.Info("Add deploy targets: " + cli.Blue("https://pushci.dev/docs#deploy"))
		return allPassed
	}
	if len(pipe.Deploys) == 0 || !allPassed {
		return allPassed
	}
	anyEligible := false
	for i := range pipe.Deploys {
		if shouldRunDeployDuringRun(&pipe.Deploys[i], withDeployOverride) {
			anyEligible = true
			break
		}
	}
	if anyEligible {
		return runDeploy(ctx, root, pipe, branch, completed)
	}
	for i := range pipe.Deploys {
		if r := deploySkipReason(&pipe.Deploys[i]); r != "" {
			cli.Info("Deploy " + pipe.Deploys[i].Name + " skipped — " + r)
		}
	}
	return allPassed
}
