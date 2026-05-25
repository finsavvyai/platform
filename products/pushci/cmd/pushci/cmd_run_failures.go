package main

import (
	"fmt"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/runner"
)

func printFailureSummary(run *runner.Run) {
	fmt.Println(cli.Bold("  Failures:"))
	for _, r := range run.Results {
		if r.Passed {
			continue
		}
		name := r.Check
		if len(name) > 60 {
			parts := splitPath(name)
			if len(parts) > 3 {
				name = ".../" + joinPath(parts[len(parts)-3:])
			}
		}
		fmt.Printf("\n  %s %s\n", cli.CrossMark(), cli.Red(name))
		lines := lastLines(r.Output, 3)
		for _, l := range lines {
			fmt.Printf("    %s\n", cli.Dim(l))
		}
		hints := matchHints(r.Output)
		for _, h := range hints {
			fmt.Printf("    %s %s\n", cli.Green("Fix:"), h)
		}
	}
	fmt.Println()
	cli.Info("For AI-powered diagnosis: pushci diagnose")
}
