package main

import (
	"fmt"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/migrate"
)

func showMigrateEnvVarsSecret(envVars []migrate.EnvVarRef) {
	if len(envVars) == 0 {
		return
	}
	fmt.Println()
	cli.Info("Secrets/variables referenced in pipeline:")
	seen := map[string]bool{}
	for _, v := range envVars {
		if seen[v.Name] {
			continue
		}
		seen[v.Name] = true
		fmt.Printf("    %s %s → %s\n", cli.Red("SECRET"), cli.Bold(v.Name), cli.Green(v.Suggestion))
	}
	fmt.Println()
}

func showMigrateEnvVars(envVars []migrate.EnvVarRef) {
	if len(envVars) == 0 {
		return
	}
	fmt.Println()
	cli.Info("Environment variables referenced:")
	seen := map[string]bool{}
	for _, v := range envVars {
		if seen[v.Name] {
			continue
		}
		seen[v.Name] = true
		if v.IsSecret {
			fmt.Printf("    %s %s → %s\n", cli.Red("SECRET"), cli.Bold(v.Name), cli.Green(v.Suggestion))
		} else {
			fmt.Printf("    %s %s → %s\n", cli.Blue("ENV"), cli.Bold(v.Name), cli.Dim(v.Suggestion))
		}
	}
}
