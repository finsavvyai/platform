package main

import (
	"fmt"
	"strings"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/migrate"
)

func migrateUsage() string {
	return "usage: pushci migrate [--composite] <file>\n\n  Supported:\n    .github/workflows/*.yml     (GitHub Actions)\n    .gitlab-ci.yml              (GitLab CI)\n    .circleci/config.yml        (CircleCI)\n    Jenkinsfile                 (Jenkins)\n    bitbucket-pipelines.yml     (Bitbucket)\n    azure-pipelines.yml         (Azure DevOps)\n    cookbooks/ or metadata.rb   (Chef cookbook)\n    --composite action.yml      (GitHub composite action)"
}

// resolveMigrateTarget pulls the file path and --composite flag out of args.
// Returns ("", false) when no positional arg was supplied.
func resolveMigrateTarget(args []string) (string, bool) {
	composite := hasFlag(args, "--composite")
	for _, a := range args {
		if strings.HasPrefix(a, "-") {
			continue
		}
		return a, composite
	}
	return "", composite
}

func migrateComposite(data []byte, args []string) error {
	result := migrate.ConvertComposite(data)

	label := result.Name
	if label == "" {
		label = "composite action"
	}
	cli.Success(fmt.Sprintf("Converted %s: %d steps kept, %d removed", label, result.StepsKept, result.StepsRemoved))

	if len(result.InputsSeen) > 0 {
		cli.Info(fmt.Sprintf("Inputs referenced: %s", strings.Join(result.InputsSeen, ", ")))
	}
	showMigrateEnvVarsSecret(result.EnvVarsNeeded)
	for _, w := range result.Warnings {
		cli.Warn(w)
	}

	fmt.Println()
	if result.PushCIYAML == "" {
		cli.Warn("No stages emitted — review warnings above.")
		return nil
	}
	fmt.Println(cli.Dim(result.PushCIYAML))
	return writeMigrateResult(args, result.PushCIYAML)
}
