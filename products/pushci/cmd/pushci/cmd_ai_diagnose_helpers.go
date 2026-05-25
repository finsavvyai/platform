package main

import (
	"fmt"
	"strings"

	"github.com/finsavvyai/pushci/internal/ai"
	"github.com/finsavvyai/pushci/internal/cli"
)

// collectDiagnoseArgs returns positional (non-flag) args starting at argv[2].
func collectDiagnoseArgs(argv []string) []string {
	var out []string
	for _, a := range argv[2:] {
		if !strings.HasPrefix(a, "-") {
			out = append(out, a)
		}
	}
	return out
}

// printDiagnoses renders each Diagnosis to the terminal.
func printDiagnoses(diagnoses []ai.Diagnosis) {
	for _, d := range diagnoses {
		fmt.Println()
		cli.Info(cli.Bold(d.Check) + " — " + d.Confidence + " confidence")
		fmt.Printf("    %s\n", d.Explanation)
		fmt.Printf("    %s %s\n", cli.Green("Fix:"), d.Suggestion)
	}
}
