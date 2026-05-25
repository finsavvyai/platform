package main

import (
	"fmt"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/migrate"
)

func printMigrationEnvVars(envVars []migrate.EnvVarRef) {
	fmt.Println()
	cli.Warn("Environment variables need to be configured:")
	seen := map[string]bool{}
	for _, v := range envVars {
		if seen[v.Name] {
			continue
		}
		seen[v.Name] = true
		if v.IsSecret {
			fmt.Printf("    %s %s → %s\n", cli.Red("SECRET"), cli.Bold(v.Name), cli.Green("pushci secret set "+v.Name+" <value>"))
		} else {
			fmt.Printf("    %s %s → %s\n", cli.Blue("ENV"), cli.Bold(v.Name), cli.Dim("add to stage env: in pushci.yml"))
		}
	}
	fmt.Println()
}
