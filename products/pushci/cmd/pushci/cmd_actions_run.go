package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"os"

	"github.com/finsavvyai/pushci/internal/actions"
	"github.com/finsavvyai/pushci/internal/cli"
)

// cmdActionsRun parses flags and dispatches the workflow runner. We
// keep the flag surface small so common cases stay one-liners.
func cmdActionsRun(ctx context.Context, args []string) error {
	fs := flag.NewFlagSet("actions run", flag.ContinueOnError)
	job := fs.String("job", "", "run only this job ID")
	event := fs.String("event", "push", "GitHub event name (push, pull_request, schedule, workflow_dispatch, ...)")
	dryRun := fs.Bool("dry-run", false, "validate the workflow without spawning containers")
	verbose := fs.Bool("verbose", false, "enable verbose act logging")
	bind := fs.Bool("bind", false, "bind-mount the working directory instead of copying")
	secrets := fs.String("secrets", "", "comma-separated KEY=VAL pairs (use --secret-file for many)")
	secretFile := fs.String("secret-file", "", "path to a file with KEY=VAL lines")
	envVars := fs.String("env", "", "comma-separated KEY=VAL pairs to set in the runner")
	matrix := fs.String("matrix", "", "comma-separated KEY:VAL pairs to filter matrix")
	inputs := fs.String("input", "", "workflow_dispatch inputs: comma-separated KEY=VAL pairs")
	inputFile := fs.String("input-file", "", "path to a file with KEY=VAL input lines")
	if err := fs.Parse(args); err != nil {
		return err
	}

	cwd, _ := os.Getwd()
	opts := actions.RunOptions{
		WorkingDir: cwd,
		Event:      *event,
		Job:        *job,
		DryRun:     *dryRun,
		Verbose:    *verbose,
		Bind:       *bind,
		Secrets:    parseKV(*secrets, "="),
		Env:        parseKV(*envVars, "="),
		Matrix:     parseKV(*matrix, ":"),
		Inputs:     parseKV(*inputs, "="),
	}

	if *secretFile != "" {
		fileSecrets, err := readKVFile(*secretFile)
		if err != nil {
			return fmt.Errorf("read secret file: %w", err)
		}
		mergeMaps(opts.Secrets, fileSecrets)
	}
	if *inputFile != "" {
		fileInputs, err := readKVFile(*inputFile)
		if err != nil {
			return fmt.Errorf("read input file: %w", err)
		}
		opts.Inputs = mergeInto(opts.Inputs, fileInputs)
	}

	// A bare positional arg restricts to that workflow file.
	if rest := fs.Args(); len(rest) > 0 {
		opts.WorkflowsDir = rest[0]
	}

	r := &actions.Runner{Stdout: os.Stdout, Stderr: os.Stderr}
	cli.Header("PushCI Actions: " + *event)
	res, err := r.Run(ctx, opts)
	if errors.Is(err, actions.ErrActMissing) {
		cli.Error(actions.InstallHint())
		return errors.New("act runtime missing")
	}
	if err != nil {
		return err
	}
	if !res.Success {
		return fmt.Errorf("workflow failed (exit %d)", res.ExitCode)
	}
	cli.Success(fmt.Sprintf("Workflow finished in %s", res.Duration.Round(1)))
	return nil
}
