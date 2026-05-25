package main

import (
	"fmt"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/detect"
)

// runFlagSpecs is the authoritative list of flags `pushci run`
// accepts. validateFlags() uses it to reject typos BEFORE we dispatch
// to the runner — otherwise `pushci run --drr-run` would fall through
// to a real pipeline execution against production config (the teddk
// dogfood bug).
func runFlagSpecs() []FlagSpec {
	return []FlagSpec{
		{Long: "--dry-run", Aliases: []string{"-n"}},
		{Long: "--parallel", Aliases: []string{"-p"}},
		{Long: "--stage", Aliases: []string{"-s"}, Takes: true},
		{Long: "--trace"},
		{Long: "--security"},
		{Long: "--with-deploy"},
		{Long: "--verbose", Aliases: []string{"-v"}},
		{Long: "--continue-on-failure"},
		{Long: "--all"},
		{Long: "--stress", Takes: true},
		{Long: "--voice"},
	}
}

// runDryRunAutoDetect is the dry-run path when there is no
// pushci.yml. Instead of walking stages, we walk detected projects
// and print the checks the auto-detect runner WOULD execute for
// each. Still zero side effects.
func runDryRunAutoDetect(root string) error {
	cli.Header("PushCI Dry Run")
	cli.Info("No pushci.yml — planning from auto-detected projects.")
	fmt.Println()

	projects := detect.Scan(root)
	if len(projects) == 0 {
		cli.Warn("No projects detected. Run: pushci init")
		return nil
	}
	for _, p := range projects {
		dir := p.Dir
		if dir == "" {
			dir = "."
		}
		fmt.Printf("Would run project: %s (%s / %s)\n", cli.Bold(dir), p.Stack, p.Framework)
	}
	fmt.Println()
	cli.Success(fmt.Sprintf("Dry run complete. %d project(s) planned, 0 executed.", len(projects)))
	return nil
}
