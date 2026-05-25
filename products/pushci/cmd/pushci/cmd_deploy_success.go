package main

import (
	"context"
	"fmt"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/deploy"
)

// runDeployOnce executes the non-staged deploy and emits the
// appropriate success message — Curb-voice when alias is one of
// the quickstart targets, neutral otherwise.
func runDeployOnce(ctx context.Context, target deploy.Target, root string, env map[string]string, alias string) error {
	sp := cli.NewSpinner()
	sp.Start(fmt.Sprintf("Deploying to %s...", target))
	result := deploy.Deploy(ctx, target, root, env)
	sp.Stop(result.Success)

	if !result.Success {
		cli.Error(result.Output)
		return fmt.Errorf("deploy to %s failed", target)
	}
	emitDeploySuccess(alias, target, result.URL)
	return nil
}

func emitDeploySuccess(alias string, target deploy.Target, url string) {
	if quickstartTargets[alias] {
		cli.Success(curbDeploySuccess(alias, url))
		return
	}
	if url != "" {
		cli.Success(fmt.Sprintf("Live at %s", cli.Blue(url)))
		return
	}
	cli.Success(fmt.Sprintf("Deployed to %s", target))
}
