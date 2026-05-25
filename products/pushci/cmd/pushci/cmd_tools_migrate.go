package main

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/migrate"
)

func cmdMigrate(args []string) error {
	if wantsHelp(args) {
		printSubUsage("migrate",
			"pushci migrate <file> | pushci migrate --composite <action.yml> | pushci migrate --action <ref>",
			"Convert an existing CI config (GitHub Actions, GitLab, CircleCI, Jenkins, Bitbucket, Azure, AWS CodeBuild), a GitHub composite action, or a single GitHub Actions marketplace action into a pushci.yml.",
			nil,
			[]string{
				"pushci migrate .github/workflows/ci.yml",
				"pushci migrate --terraform-dir aws_pipeline/",
				"pushci migrate --composite .github/actions/deploy/action.yml",
				"pushci migrate --action actions/setup-node@v4 --input node-version=20",
			})
		return nil
	}
	if err := validateFlags("migrate", args, migrateFlagSpecs()); err != nil {
		return err
	}
	if hasFlag(args, "--action") {
		return cmdMigrateMarketplace(context.Background(), args)
	}
	if d := flagValue(args, "--terraform-dir"); d != "" {
		return migrateTerraform(d, args)
	}
	path, composite := resolveMigrateTarget(args)
	if path == "" {
		return fmt.Errorf("%s", migrateUsage())
	}

	cli.Header("PushCI Migrate")

	if isChefTarget(path) {
		return migrateChef(path, args)
	}

	data, err := os.ReadFile(path) // #nosec G703 G704 G122 -- CLI tool: paths/URLs are user-supplied
	if err != nil {
		return fmt.Errorf("read file: %w", err)
	}

	if composite {
		return migrateComposite(data, args)
	}
	lower := strings.ToLower(path)
	switch {
	case strings.Contains(lower, "gitlab"):
		return migrateGitLab(string(data), args)
	case strings.Contains(lower, "circleci"):
		return migrateCircleCI(string(data), args)
	case strings.Contains(lower, "jenkins") || strings.HasSuffix(lower, "jenkinsfile"):
		return migrateJenkins(string(data), args)
	case strings.Contains(lower, "bitbucket"):
		return migrateBitbucket(string(data), args)
	case strings.Contains(lower, "azure"):
		return migrateAzure(string(data), args)
	case strings.HasSuffix(lower, "buildspec.yml") || strings.HasSuffix(lower, "buildspec.yaml"):
		return migrateBuildspec(string(data), args)
	}
	// GitHub Actions (default)
	workflow := migrate.ActionsWorkflow{RawYAML: string(data)}
	result := migrate.ConvertActions(workflow)

	cli.Success(fmt.Sprintf("Converted: %d steps kept, %d removed", result.StepsKept, result.StepsRemoved))
	showMigrateEnvVarsSecret(result.EnvVarsNeeded)
	for _, w := range result.Warnings {
		cli.Warn(w)
	}
	fmt.Println()
	fmt.Println(cli.Dim(result.PushCIYAML))
	return writeMigrateResult(args, result.PushCIYAML)
}

func writeMigrateResult(_ []string, yamlContent string) error {
	dir, _ := os.Getwd()
	dest := dir + "/pushci.yml"
	if _, err := os.Stat(dest); err == nil {
		bak := dest + ".bak"
		if data, rerr := os.ReadFile(dest); rerr == nil {
			_ = os.WriteFile(bak, data, 0644) // #nosec G703 G704 G122 -- CLI tool: user-supplied paths
			cli.Info("Backed up existing pushci.yml to pushci.yml.bak")
		}
	}
	if err := os.WriteFile(dest, []byte(yamlContent), 0644); err != nil { // #nosec G703 G704 G122 -- CLI tool: paths/URLs are user-supplied
		return err
	}
	cli.Success("✓ Wrote pushci.yml — run 'pushci run' to test it")
	return nil
}
