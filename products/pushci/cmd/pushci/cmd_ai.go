package main

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/finsavvyai/pushci/internal/ai"
	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/detect"
	"github.com/finsavvyai/pushci/internal/runner"
)

func cmdDiagnose(ctx context.Context) error {
	if !requireProFeature("diagnose") {
		return fmt.Errorf("AI feature gated")
	}
	client, err := getAIClient()
	if err != nil {
		return err
	}
	cli.Header("PushCI Diagnose")

	// If user passed an error string, diagnose it directly without running checks.
	diagArgs := collectDiagnoseArgs(os.Args)
	if len(diagArgs) > 0 {
		errorText := strings.Join(diagArgs, " ")
		syntheticRun := &runner.Run{
			Results: []runner.Result{{Check: "user-supplied error", Output: errorText}},
		}
		sp := cli.NewSpinner()
		sp.Start("AI analyzing error...")
		diagnoses := ai.DiagnoseRun(ctx, client, syntheticRun)
		sp.Stop(len(diagnoses) > 0)
		printDiagnoses(diagnoses)
		return nil
	}

	root, _ := os.Getwd()
	sp := cli.NewSpinner()
	sp.Start("Running checks...")
	projects := detect.Scan(root)
	run := runner.Execute(ctx, root, projects)
	sp.Stop(true)

	if run.Passed {
		cli.Success("All checks passed — nothing to diagnose")
		return nil
	}

	sp.Start("AI analyzing failures...")
	diagnoses := ai.DiagnoseRun(ctx, client, run)
	sp.Stop(len(diagnoses) > 0)
	printDiagnoses(diagnoses)
	return nil
}

func cmdAsk(ctx context.Context, args []string) error {
	if wantsHelp(args) {
		printSubUsage("ask",
			"pushci ask \"<question>\"",
			"Ask Claude natural-language questions about your CI/CD pipeline.",
			nil,
			[]string{
				`pushci ask "why did my last build fail?"`,
				`pushci ask "how do I add a cache step?"`,
			})
		return nil
	}
	if len(args) == 0 {
		return fmt.Errorf("usage: pushci ask \"<question>\"")
	}
	if !requireProFeature("ask") {
		return fmt.Errorf("AI feature gated")
	}
	client, err := getAIClient()
	if err != nil {
		return err
	}
	resp, err := client.Ask(ctx, strings.Join(args, " "))
	if err != nil {
		return err
	}
	fmt.Println(resp)
	return nil
}
