package main

import (
	"fmt"
	"os"

	"github.com/finsavvyai/pushci/internal/cli"
)

func cmdTroubleshoot(args []string) error {
	if wantsHelp(args) {
		printSubUsage("troubleshoot",
			"pushci troubleshoot",
			"Diagnose environment issues with actionable fixes. Alias: pushci ts",
			nil,
			[]string{"pushci troubleshoot", "pushci ts"})
		return nil
	}
	cli.Header("PushCI Troubleshoot")
	root, _ := os.Getwd()
	issues := 0

	issues += checkEnvironment()
	issues += checkConfig(root)
	issues += checkProject(root)
	issues += checkHook(root)
	issues += checkConnectivity()

	fmt.Println()
	if issues == 0 {
		cli.Success("No issues found — environment is healthy")
	} else {
		cli.Warn(fmt.Sprintf("%d issue(s) found — see fixes above", issues))
	}
	return nil
}
