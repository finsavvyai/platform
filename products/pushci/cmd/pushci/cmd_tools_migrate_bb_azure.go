package main

import (
	"fmt"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/migrate"
)

func showJenkinsEnvVars(envVars []migrate.EnvVarRef) {
	if len(envVars) == 0 {
		return
	}
	fmt.Println()
	cli.Info("Credentials/variables referenced:")
	seen := map[string]bool{}
	for _, v := range envVars {
		if seen[v.Name] {
			continue
		}
		seen[v.Name] = true
		fmt.Printf("    %s %s → %s\n", cli.Red("SECRET"), cli.Bold(v.Name), cli.Green(v.Suggestion))
	}
}

func migrateBitbucket(rawYAML string, args []string) error {
	result := migrate.ConvertBitbucket(rawYAML)
	cli.Success(fmt.Sprintf("Converted: %d pipelines, %d steps", result.PipelinesFound, result.StepsKept))
	showMigrateEnvVars(result.EnvVarsNeeded)
	for _, w := range result.Warnings {
		cli.Warn(w)
	}
	fmt.Println()
	fmt.Println(cli.Dim(result.PushCIYAML))
	return writeMigrateResult(args, result.PushCIYAML)
}

func migrateBuildspec(rawYAML string, args []string) error {
	result := migrate.ConvertBuildspec(rawYAML)
	cli.Success(fmt.Sprintf("Converted: %d phases, %d steps", result.StagesConverted, result.StepsConverted))
	showMigrateEnvVars(result.EnvVarsNeeded)
	for _, w := range result.Warnings {
		if w == "" {
			fmt.Println()
		} else {
			cli.Warn(w)
		}
	}
	fmt.Println()
	fmt.Println(cli.Dim(result.PushCIYAML))
	return writeMigrateResult(args, result.PushCIYAML)
}

func migrateAzure(rawYAML string, args []string) error {
	result := migrate.ConvertAzurePipelines(rawYAML)
	cli.Success(fmt.Sprintf("Converted: %d stages, %d jobs, %d steps", result.StagesConverted, result.JobsConverted, result.StepsKept))
	showMigrateEnvVars(result.EnvVarsNeeded)
	for _, w := range result.Warnings {
		if w == "" {
			fmt.Println()
		} else {
			cli.Warn(w)
		}
	}
	fmt.Println()
	fmt.Println(cli.Dim(result.PushCIYAML))
	return writeMigrateResult(args, result.PushCIYAML)
}

// showMigrateEnvVarsSecret and showMigrateEnvVars live in cmd_tools_migrate_env.go.
