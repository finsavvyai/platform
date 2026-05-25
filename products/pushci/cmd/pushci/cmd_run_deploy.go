package main

import (
	"context"
	"fmt"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/config"
)

// runDeploy iterates every DeployTarget in the pipeline. Each
// target is gated independently on trigger, only_on, and
// depends_on. A failing target aborts the rest — the common case
// is staging before production, and we never want a busted
// staging deploy to leak into production.
//
// Pre-1.4.4 this function branched on pipe.Deploy.Environments vs
// pipe.Deploy.Run because the schema had two shapes. v1.4.4
// unifies on Deploys []DeployTarget populated by UnmarshalYAML, so
// the legacy branches are gone.
func runDeploy(ctx context.Context, root string, pipe *config.Pipeline, branch string, completed map[string]bool) bool {
	if len(pipe.Deploys) == 0 {
		return true
	}
	total := len(pipe.Stages) + len(pipe.Deploys)
	step := len(pipe.Stages)
	for i := range pipe.Deploys {
		t := &pipe.Deploys[i]
		step++
		if !runOneDeployTarget(ctx, root, t, branch, completed, step, total) {
			return false
		}
	}
	return true
}

// runOneDeployTarget is the per-target execution. Returns false
// on any failure (skipped targets count as success — they just
// didn't run).
func runOneDeployTarget(ctx context.Context, root string, t *config.DeployTarget, branch string, completed map[string]bool, step, total int) bool {
	_, extraOnly := normalizeTrigger(t.Trigger)
	only := append([]string{}, t.OnlyOn...)
	only = append(only, extraOnly...)
	if !config.ShouldRunStage(config.Stage{OnlyOn: only}, branch) {
		cli.Info(fmt.Sprintf("Deploy %s skipped (only_on: %v, current: %s)", t.Name, only, branch))
		return true
	}
	for _, dep := range t.DependsOn {
		if !completed[dep] {
			cli.Warn(fmt.Sprintf("Deploy %s skipped (depends_on: %s did not pass)", t.Name, dep))
			return true
		}
	}

	fmt.Println()
	cli.Step(step, total, cli.Bold("deploy → "+t.Name))

	if t.Approve && !confirmApproval("deploy", t.Name) {
		cli.Info(fmt.Sprintf("Deploy %s skipped (not approved)", t.Name))
		return true
	}

	dir := root
	if t.Path != "" {
		dir = root + "/" + t.Path
	}

	timeout := config.ParseTimeout(t.Timeout)
	deployCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	deployEnv, ok := resolveVaultEnv(deployCtx, t.Env)
	if !ok {
		return false
	}
	result := runShellCmd(deployCtx, dir, t.Run, deployEnv)
	if !result.passed {
		cli.Error(fmt.Sprintf("Deploy %s failed", t.Name))
		for _, l := range lastLines(result.output, 8) {
			fmt.Printf("      %s\n", cli.Dim(l))
		}
		if deployCtx.Err() == context.DeadlineExceeded {
			cli.Warn(fmt.Sprintf("Deploy timed out after %s (set timeout: in pushci.yml to increase)", timeout))
		}
		return false
	}
	// Show last few lines on success so users see deploy URLs,
	// version numbers, etc. without needing --verbose.
	for _, l := range lastLines(result.output, 3) {
		fmt.Printf("      %s\n", cli.Dim(l))
	}
	cli.Success(fmt.Sprintf("Deployed %s", t.Name))
	return verifyDeployTarget(ctx, t)
}
