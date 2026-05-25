package main

import (
	"fmt"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/migrate"
)

// migrateTerraform handles `pushci migrate --terraform-dir <path>` by
// walking every *.tf in the given directory and extracting pipeline-
// shaped resources (aws_codebuild_project, aws_codepipeline,
// google_cloudbuild_trigger, azuredevops_build_definition,
// harness_platform_pipeline). It emits a summary + warnings and does
// NOT write pushci.yml by default — the extracted shape usually needs
// human review before translation (e.g. buildspec.yml follow-up).
func migrateTerraform(dir string, args []string) error {
	cli.Header("PushCI Migrate — Terraform")
	result := migrate.ConvertTerraformPipeline(dir)
	if len(result.Pipelines) == 0 {
		cli.Warn("No pipeline resources found in " + dir)
	} else {
		cli.Success(fmt.Sprintf("Extracted %d pipeline resource(s) from %s", len(result.Pipelines), dir))
	}
	for _, p := range result.Pipelines {
		printTerraformPipeline(p)
	}
	showTerraformEnvVars(result.EnvVarsNeeded)
	for _, w := range result.Warnings {
		cli.Warn(w)
	}
	// --write flag is supported but produces a stub scaffold because
	// the real build steps live in buildspec.yml — we point the user
	// at the next migrate command rather than emit bogus YAML.
	if hasFlag(args, "--write", "-w") {
		cli.Info("Next: run `pushci migrate buildspec.yml` (or the referenced YAML) to convert build steps.")
	}
	return nil
}

func printTerraformPipeline(p migrate.ExtractedPipeline) {
	fmt.Println()
	fmt.Printf("  %s %s  %s\n", cli.Blue(p.Platform), cli.Bold(p.Name), cli.Dim(p.Source))
	if p.BuildspecRef != "" {
		fmt.Printf("    buildspec: %s\n", cli.Green(p.BuildspecRef))
	}
	if len(p.EnvVars) > 0 {
		fmt.Printf("    env: %d variable(s)\n", len(p.EnvVars))
	}
	for _, s := range p.Stages {
		fmt.Printf("    stage %s → %s (%s)\n", cli.Bold(s.Name), cli.Green(s.Provider), formatActions(s.Actions))
	}
}

func formatActions(a []string) string {
	if len(a) == 0 {
		return "no actions"
	}
	out := a[0]
	for i := 1; i < len(a); i++ {
		out += ", " + a[i]
	}
	return out
}

func showTerraformEnvVars(envVars []migrate.EnvVarRef) {
	if len(envVars) == 0 {
		return
	}
	fmt.Println()
	cli.Info("Env vars extracted from Terraform:")
	seen := map[string]bool{}
	for _, v := range envVars {
		if seen[v.Name] {
			continue
		}
		seen[v.Name] = true
		icon := cli.Blue("ENV")
		if v.IsSecret {
			icon = cli.Red("SECRET")
		}
		fmt.Printf("    %s %s → %s\n", icon, cli.Bold(v.Name), cli.Dim(v.Suggestion))
	}
}
