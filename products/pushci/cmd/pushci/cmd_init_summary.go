package main

import (
	"fmt"
	"strings"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/config"
)

func printPipelineSummary(pipe *config.Pipeline) {
	if !pipe.HasStages() {
		return
	}
	fmt.Println()
	cli.Info("Pipeline stages:")
	for i, s := range pipe.Stages {
		deps := ""
		if len(s.DependsOn) > 0 {
			deps = cli.Dim(" (after " + strings.Join(s.DependsOn, ", ") + ")")
		}
		par := ""
		if s.Parallel {
			par = cli.Dim(" [parallel]")
		}
		only := ""
		if len(s.OnlyOn) > 0 {
			only = cli.Dim(" [" + strings.Join(s.OnlyOn, ",") + " only]")
		}
		fmt.Printf("    %s %s%s%s%s\n",
			cli.Blue(fmt.Sprintf("[%d]", i+1)),
			cli.Bold(s.Name), deps, par, only)
	}
	printDeploySummary(pipe)
}

func printDeploySummary(pipe *config.Pipeline) {
	if len(pipe.Deploys) == 0 {
		return
	}
	for j, t := range pipe.Deploys {
		_, extraOnly := normalizeTrigger(t.Trigger)
		combined := append([]string{}, t.OnlyOn...)
		combined = append(combined, extraOnly...)
		only := ""
		if len(combined) > 0 {
			only = cli.Dim(" [" + strings.Join(combined, ",") + " only]")
		}
		approve := ""
		if t.Approve {
			approve = cli.Yellow(" (requires approval)")
		}
		verify := ""
		if t.Verify != nil && t.Verify.URL != "" {
			verify = cli.Dim(" ✓ " + t.Verify.URL)
		}
		fmt.Printf("    %s %s%s%s%s\n",
			cli.Blue(fmt.Sprintf("[%d]", len(pipe.Stages)+1+j)),
			cli.Bold("deploy → "+t.Name), only, approve, verify)
	}
}
