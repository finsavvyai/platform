package main

import (
	"context"
	"errors"
	"fmt"
	"os"

	"github.com/finsavvyai/pushci/internal/actions"
	"github.com/finsavvyai/pushci/internal/cli"
)

// cmdActionsValidate runs every workflow in dry-run mode so users get a
// fast schema check before pushing. Useful as a pre-push hook. When the
// repo has no .github/workflows/ we short-circuit with the same friendly
// message `doctor` prints — historically this crashed with a raw `stat`
// error because act was handed a non-existent directory. Teddk bug #2.
func cmdActionsValidate(ctx context.Context) error {
	cli.Header("PushCI Actions: validate")
	cwd, _ := os.Getwd()
	if !actions.HasWorkflows(cwd) {
		cli.Info("No .github/workflows/*.yml files found in this repo — nothing to validate.")
		cli.Info("Drop a workflow in .github/workflows/ and re-run, or use `pushci init` for a stage-based pipeline.")
		return nil
	}
	r := &actions.Runner{Stdout: os.Stdout, Stderr: os.Stderr}
	res, err := r.Run(ctx, actions.RunOptions{
		WorkingDir: cwd,
		DryRun:     true,
	})
	if errors.Is(err, actions.ErrActMissing) {
		cli.Error(actions.InstallHint())
		return errors.New("act runtime missing")
	}
	if err != nil {
		return err
	}
	if !res.Success {
		return fmt.Errorf("validation failed (exit %d)", res.ExitCode)
	}
	cli.Success("All workflows are valid")
	return nil
}

// cmdActionsDoctor prints the runtime status the user needs to debug
// "actions doesn't work on my machine" reports.
func cmdActionsDoctor(ctx context.Context) error {
	cli.Header("PushCI Actions Doctor")
	if _, err := actions.ActBinary(); err != nil {
		cli.Error("act binary: NOT FOUND")
		fmt.Println()
		fmt.Println(actions.InstallHint())
		return nil
	}
	ma, mi, pa, err := actions.Version(ctx)
	if err != nil {
		cli.Error("act --version failed: " + err.Error())
		return nil
	}
	cli.Success(fmt.Sprintf("act binary: v%d.%d.%d", ma, mi, pa))

	cwd, _ := os.Getwd()
	wfs, err := actions.DetectWorkflows(cwd)
	if errors.Is(err, actions.ErrNoWorkflows) {
		cli.Warn("No workflow files found in this repo")
		return nil
	}
	if err != nil {
		return err
	}
	cli.Success(fmt.Sprintf("Found %d workflow(s)", len(wfs)))
	return nil
}
