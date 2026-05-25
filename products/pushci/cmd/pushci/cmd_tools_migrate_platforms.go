package main

import (
	"fmt"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/migrate"
)

func migrateGitLab(rawYAML string, args []string) error {
	result := migrate.ConvertGitLab(rawYAML)
	cli.Success(fmt.Sprintf("Converted: %d stages, %d jobs", result.StagesConverted, result.JobsConverted))
	showGitLabEnvVars(result)
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

func showGitLabEnvVars(result *migrate.GitLabConvertResult) {
	if len(result.EnvVarsNeeded) == 0 {
		return
	}
	fmt.Println()
	cli.Info("Environment variables referenced in pipeline:")
	fmt.Println()
	for _, v := range result.EnvVarsNeeded {
		icon := cli.Blue("ENV")
		if v.IsSecret {
			icon = cli.Red("SECRET")
		}
		fmt.Printf("    %s  %s\n", icon, cli.Bold(v.Name))
		fmt.Printf("         Used in: %s\n", v.UsedIn)
		fmt.Printf("         %s %s\n", cli.Green("Set:"), v.Suggestion)
	}
	fmt.Println()
	cli.Warn("GitLab CI/CD variables must be set locally:")
	cli.Info("  Secrets:  pushci secret set <KEY> <VALUE>")
	cli.Info("  Env vars: export KEY=value  (or add to stage env: in pushci.yml)")
}

func migrateCircleCI(rawYAML string, args []string) error {
	result := migrate.ConvertCircleCI(rawYAML)
	cli.Success(fmt.Sprintf("Converted: %d jobs, %d steps", result.JobsConverted, result.StepsKept))
	showMigrateEnvVars(result.EnvVarsNeeded)
	for _, w := range result.Warnings {
		cli.Warn(w)
	}
	fmt.Println()
	fmt.Println(cli.Dim(result.PushCIYAML))
	return writeMigrateResult(args, result.PushCIYAML)
}

func migrateJenkins(raw string, args []string) error {
	result := migrate.ConvertJenkinsfile(raw)
	cli.Success(fmt.Sprintf("Converted: %d stages, %d steps", result.StagesConverted, result.StepsKept))
	showJenkinsEnvVars(result.EnvVarsNeeded)
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
