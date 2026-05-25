package main

import (
	"fmt"
	"os"
	"strings"

	"gopkg.in/yaml.v3"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/migrate"
)

func detectAndMigrateExistingCI(root string) (*config.Pipeline, string, []migrate.DeployHint) {
	ciFiles := []struct {
		path, name, kind string
	}{
		{root + "/.gitlab-ci.yml", "GitLab CI", "gitlab"},
		{root + "/.github/workflows/ci.yml", "GitHub Actions", "github"},
		{root + "/.github/workflows/main.yml", "GitHub Actions", "github"},
		{root + "/.github/workflows/build.yml", "GitHub Actions", "github"},
		{root + "/.circleci/config.yml", "CircleCI", "circleci"},
		{root + "/Jenkinsfile", "Jenkins", "jenkins"},
		{root + "/bitbucket-pipelines.yml", "Bitbucket Pipelines", "bitbucket"},
		{root + "/azure-pipelines.yml", "Azure DevOps", "azure"},
	}
	for _, ci := range ciFiles {
		if _, err := os.Stat(ci.path); err == nil {
			pipe, hints := tryMigrateCI(ci.path, ci.name, ci.kind)
			if pipe != nil {
				return pipe, ci.kind, hints
			}
		}
	}
	return nil, "", nil
}

func tryMigrateCI(path, name, kind string) (*config.Pipeline, []migrate.DeployHint) {
	cli.Info(fmt.Sprintf("Found existing %s config: %s", name, path))
	// Non-interactive: take the safe default ("yes" — migration
	// is non-destructive, it just generates a fresh pushci.yml
	// from the detected foreign CI file).
	if !isNonInteractive(os.Args[2:]) {
		fmt.Printf("    Migrate to PushCI? [Y/n]: ")
		var answer string
		fmt.Scanln(&answer)
		answer = strings.TrimSpace(strings.ToLower(answer))
		if answer != "" && answer != "y" && answer != "yes" {
			return nil, nil
		}
	}
	data, err := os.ReadFile(path)
	if err != nil {
		cli.Warn("Could not read " + path)
		return nil, nil
	}
	generatedYAML, envVars, hints, warnings := runMigration(string(data), kind, name)
	for _, w := range warnings {
		if w == "" {
			continue
		}
		cli.Warn(w)
	}
	if len(envVars) > 0 {
		printMigrationEnvVars(envVars)
	}
	if generatedYAML != "" {
		var pipe config.Pipeline
		if yaml.Unmarshal([]byte(generatedYAML), &pipe) == nil {
			return &pipe, hints
		}
	}
	return nil, hints
}
