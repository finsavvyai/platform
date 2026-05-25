package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/config"
)

func cmdRun(ctx context.Context, args []string) (err error) {
	if wantsHelp(args) {
		printRunHelp()
		return nil
	}
	if err := validateFlags("run", args, runFlagSpecs()); err != nil {
		return err
	}
	root, _ := os.Getwd()
	opts := parseRunOpts(args)
	start := time.Now()
	defer onFinish(start, opts.voice, &err)

	cli.Header("PushCI Run")
	narrateEvent(ctx, opts.voice, voiceStartEvent())

	pipe, loadErr := config.Load(root + "/pushci.yml")
	if loadErr != nil && !os.IsNotExist(loadErr) {
		return fmt.Errorf("pushci.yml: %w", loadErr)
	}
	if pipe != nil {
		return runWithPipeline(ctx, root, pipe, opts)
	}

	return runWithoutPipeline(ctx, root, args, opts)
}

type runOpts struct {
	parallel, trace, security, dryRun, voice bool
	stageFilter                              string
}

func parseRunOpts(args []string) runOpts {
	withDeployOverride = hasFlag(args, "--with-deploy")
	verboseMode = hasFlag(args, "--verbose", "-v")
	return runOpts{
		parallel:    hasFlag(args, "--parallel", "-p"),
		trace:       hasFlag(args, "--trace"),
		security:    hasFlag(args, "--security"),
		dryRun:      hasFlag(args, "--dry-run", "-n"),
		voice:       hasFlag(args, "--voice"),
		stageFilter: flagValue(args, "--stage", "-s"),
	}
}

func runWithPipeline(ctx context.Context, root string, pipe *config.Pipeline, opts runOpts) error {
	if !pipe.HasStages() && len(pipe.Checks) > 0 {
		pipe.Stages = []config.Stage{{Name: "checks", Checks: pipe.Checks}}
	}
	if opts.dryRun {
		return runDryRun(root, pipe, opts.stageFilter)
	}
	if pipe.HasStages() {
		if err := dispatchStages(ctx, root, pipe, opts.stageFilter); err != nil {
			return err
		}
		if opts.security {
			return runPostSecurity(ctx, root)
		}
		return nil
	}
	return fmt.Errorf("pushci.yml has no stages or checks — nothing to run (hint: `pushci init --force` to regenerate)")
}

func dispatchStages(ctx context.Context, root string, pipe *config.Pipeline, stageFilter string) error {
	if pipelineHasOperators(pipe) {
		return runWithEngine(ctx, root, pipe)
	}
	return runWithStages(ctx, root, pipe, stageFilter)
}

func runWithoutPipeline(ctx context.Context, root string, args []string, opts runOpts) error {
	if n := parseStressFlag(args); n > 0 {
		return runStressMode(ctx, root, args, n)
	}
	if opts.dryRun {
		return runDryRunAutoDetect(root)
	}
	if err := runAutoDetect(ctx, root, args, opts.parallel, opts.trace, nil); err != nil {
		return err
	}
	if opts.security {
		return runPostSecurity(ctx, root)
	}
	return nil
}
