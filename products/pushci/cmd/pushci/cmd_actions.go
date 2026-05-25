package main

import (
	"context"
	"errors"
	"fmt"
	"os"

	"github.com/finsavvyai/pushci/internal/actions"
	"github.com/finsavvyai/pushci/internal/cli"
)

// cmdActions dispatches `pushci actions <subcommand>`. Subcommands:
//
//	list                — enumerate workflows + jobs in the current repo
//	run [workflow]      — run a workflow file (or all if omitted)
//	validate            — dryrun-validate every workflow file
//	doctor              — print act/docker/workflow runtime status
//
// Run / validate / doctor live in sibling files to keep this one under
// the 100-line per-file cap. The dispatcher stays here so `go doc` and
// newcomers find it first.
func cmdActions(ctx context.Context, args []string) error {
	if wantsHelp(args) {
		printSubUsage("actions",
			"pushci actions <list|run|validate|doctor> [flags]",
			"Run .github/workflows/*.yml files via the embedded act runtime.",
			nil,
			[]string{
				"pushci actions list",
				"pushci actions run",
				"pushci actions run --job test --dry-run",
				"pushci actions validate",
				"pushci actions doctor",
			})
		return nil
	}
	if len(args) == 0 {
		return cmdActionsList()
	}
	switch args[0] {
	case "list", "ls":
		return cmdActionsList()
	case "run":
		return cmdActionsRun(ctx, args[1:])
	case "validate":
		return cmdActionsValidate(ctx)
	case "doctor":
		return cmdActionsDoctor(ctx)
	default:
		return fmt.Errorf("unknown actions subcommand %q (try: list, run, validate, doctor)", args[0])
	}
}

// cmdActionsList prints every workflow and its jobs. Falls back to a
// friendly message when the repo has no .github/workflows/.
func cmdActionsList() error {
	cli.Header("PushCI Actions")
	cwd, _ := os.Getwd()
	wfs, err := actions.DetectWorkflows(cwd)
	if errors.Is(err, actions.ErrNoWorkflows) {
		cli.Info("No .github/workflows/*.yml files found in this repo.")
		cli.Info("Drop a workflow in .github/workflows/ and re-run, or use `pushci init` for a stage-based pipeline.")
		return nil
	}
	if err != nil {
		return err
	}
	for _, wf := range wfs {
		fmt.Printf("  %s  %s\n", cli.Blue(wf.Name), cli.Dim(wf.RelPath))
	}
	return nil
}

// parseKV, readKVFile, mergeMaps live in cmd_actions_helpers.go.
// cmdActionsRun lives in cmd_actions_run.go.
// cmdActionsValidate / cmdActionsDoctor live in cmd_actions_inspect.go.
