package main

import (
	"context"
	"fmt"
)

// cmdTrigger dispatches `pushci trigger <subcommand|workflow>`:
//
//	pushci trigger ci.yml --ref main --input env=staging
//	pushci trigger list
//	pushci trigger watch <run-id>
//
// Unlike `pushci actions run` (which runs workflows locally via act),
// `pushci trigger` fires a remote `workflow_dispatch` event against
// the GitHub REST API — useful for matrix kickoffs from the terminal
// without opening the GitHub UI.
func cmdTrigger(ctx context.Context, args []string) error {
	if wantsHelp(args) || len(args) == 0 {
		printTriggerUsage()
		if len(args) == 0 {
			return fmt.Errorf("workflow file or subcommand required")
		}
		return nil
	}
	switch args[0] {
	case "list", "ls":
		return cmdTriggerList(ctx)
	case "watch":
		if len(args) < 2 {
			return fmt.Errorf("watch requires a run ID")
		}
		return cmdTriggerWatch(ctx, args[1])
	default:
		return cmdTriggerDispatch(ctx, args)
	}
}

// printTriggerUsage renders the `pushci trigger --help` screen.
func printTriggerUsage() {
	printSubUsage("trigger",
		"pushci trigger <workflow.yml|list|watch> [flags]",
		"Fire a GitHub workflow_dispatch event via the REST API.",
		[][2]string{
			{"--ref", "git ref to dispatch against (default: main)"},
			{"--input K=V", "workflow input (repeatable; K=a,b,c fans out)"},
			{"--input-file", "path to a JSON file with inputs"},
			{"--watch", "stream run status after dispatch"},
			{"--workflow", "workflow filename or ID (alt to positional)"},
		},
		[]string{
			"pushci trigger ci.yml --ref main --input env=staging",
			"pushci trigger deploy.yml --ref release/v2 --input-file inputs.json",
			"pushci trigger ci.yml --input env=dev,staging,prod  # fan-out",
			"pushci trigger list",
			"pushci trigger watch 12345678",
		})
}
