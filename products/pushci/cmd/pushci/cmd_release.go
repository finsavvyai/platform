package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"time"

	"github.com/finsavvyai/pushci/internal/cli"
)

func cmdRelease(ctx context.Context, args []string) error {
	if wantsHelp(args) {
		printSubUsage("release",
			"pushci release [flags]",
			"Build and publish a release using GoReleaser locally ($0).",
			[][2]string{
				{"--dry-run, -n", "build but don't publish to GitHub/npm/brew"},
				{"--skip-publish", "skip npm + GitHub release publish"},
				{"--skip-brew", "skip Homebrew tap update"},
			},
			[]string{
				"pushci release --dry-run",
				"pushci release",
			})
		return nil
	}
	cli.Header("PushCI Release")

	root, _ := os.Getwd()
	dryRun := hasFlag(args, "--dry-run", "-n")
	skipPublish := hasFlag(args, "--skip-publish")
	skipBrew := hasFlag(args, "--skip-brew")

	if err := checkReleasePrereqs(root); err != nil {
		return err
	}

	ensureReleaseTokens()

	releaseArgs := buildReleaseArgs(dryRun, skipPublish, skipBrew)

	tag := currentTag()
	cli.Info(fmt.Sprintf("Releasing %s...", cli.Bold(tag)))

	sp := cli.NewSpinner()
	sp.Start("Running goreleaser...")
	start := time.Now()

	cmd := exec.CommandContext(ctx, "goreleaser", releaseArgs...)
	cmd.Dir = root
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	err := cmd.Run()
	elapsed := time.Since(start)

	sp.Stop(err == nil)

	if err != nil {
		return fmt.Errorf("goreleaser failed: %w", err)
	}

	printReleaseSummary(tag, elapsed, dryRun)
	return nil
}

// buildReleaseArgs, ensureReleaseTokens, currentTag live in cmd_release_run.go.
