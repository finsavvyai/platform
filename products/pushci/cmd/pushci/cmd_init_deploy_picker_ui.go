package main

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/detect"
)

// interactivePicker is the TTY path of pickDeployTargets. Callers
// must consult isNonInteractive first — this function reads stdin
// and would hang under `pushci init --force` otherwise.
func interactivePicker(targets []detect.DeployTarget, selected []bool) []config.DeployTarget {
	renderPicker(targets, selected)
	fmt.Printf("\n  %s Accept defaults? [Y/n]: ", cli.Dim("◇"))
	var answer string
	fmt.Scanln(&answer)
	answer = strings.TrimSpace(strings.ToLower(answer))
	if answer == "n" || answer == "no" {
		fmt.Printf("  %s Toggle (e.g. %s): ", cli.Dim("◇"), cli.Blue("3 5"))
		var toggles string
		fmt.Scanln(&toggles)
		for _, tok := range strings.Fields(toggles) {
			if n, err := strconv.Atoi(tok); err == nil && n >= 1 && n <= len(targets) {
				selected[n-1] = !selected[n-1]
			}
		}
		renderPicker(targets, selected)
	}
	return collectPicked(targets, selected)
}

func renderPicker(targets []detect.DeployTarget, sel []bool) {
	maxN := 0
	for _, t := range targets {
		if len(t.Platform) > maxN {
			maxN = len(t.Platform)
		}
	}
	fmt.Printf("\n  %s %s\n  %s\n", cli.Blue("◆"), cli.Bold("Deploy targets"), cli.Dim("│"))
	for i, t := range targets {
		b, n := cli.Green("●"), cli.Bold(t.Platform)
		if !sel[i] {
			b, n = cli.Dim("○"), cli.Dim(t.Platform)
		}
		pad := strings.Repeat(" ", maxN-len(t.Platform)+2)
		fmt.Printf("  %s  %s  %s %s%s%s\n", cli.Dim("│"), b, cli.Dim(fmt.Sprintf("%d", i+1)), n, pad, cli.Dim(t.ConfigFile))
	}
	fmt.Printf("  %s\n  %s  %s deploy  %s skip\n  %s\n", cli.Dim("│"), cli.Dim("│"), cli.Green("●"), cli.Dim("○"), cli.Dim("╰"))
}
