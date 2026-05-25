package main

import (
	"fmt"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/config"
)

// aiPipeBetter reports whether an AI-generated pipeline is at
// least as trustworthy as the deterministic one. We accept the
// AI version only when it has stages with actual Run commands;
// flat-checks-with-bare-names is worse than what the detector
// produced and gets rejected.
func aiPipeBetter(ai, deterministic *config.Pipeline) bool {
	if len(ai.Stages) == 0 {
		return false
	}
	for _, stage := range ai.Stages {
		for _, check := range stage.Checks {
			if check.Run == "" {
				return false
			}
		}
	}
	return true
}

func printInitAuthGuide() {
	token := loadAuthToken()
	if token == "" {
		fmt.Println()
		cli.Warn("Not logged in — run " + cli.Blue("pushci login") + " to see this project in the dashboard")
		cli.Info("Dashboard: " + cli.Blue("https://app.pushci.dev"))
	} else {
		fmt.Println()
		cli.Success("Registering with PushCI dashboard...")
	}
}
