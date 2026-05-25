package main

import (
	"fmt"
	"strings"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/config"
)

// buildTFDeploy emits a single deploy target named after the
// extracted pipeline project. The Run command is a placeholder: the
// user migrates a Terraform-managed CodePipeline rather than replacing
// it wholesale, so we drop a comment pointing at the intended target
// platform and let them fill in the command.
func buildTFDeploy(platform, project string) []config.DeployTarget {
	name := platform
	if project != "" {
		name = project
	}
	cmd := fmt.Sprintf("# deploy via %s (migrated from Terraform)", platform)
	return []config.DeployTarget{{
		Name: name, Trigger: "push",
		OnlyOn: []string{"main", "master"}, Run: cmd,
	}}
}

// printTFPipelineBanner surfaces the extracted Terraform pipeline
// shape to the terminal so the user can see what the generated
// pushci.yml was based on — mirrors the GitLab/CircleCI migrate
// banners.
func printTFPipelineBanner(h *tfPipelineHints) {
	if h == nil || h.Project == "" {
		return
	}
	cli.Info(fmt.Sprintf("Detected Terraform pipeline: %s", cli.Bold(h.Project)))
	if h.Platform != "" {
		fmt.Printf("    %s Deploy target: %s (%d stages)\n",
			cli.Green(">>"), cli.Bold(h.Platform), h.Stages)
	}
	secrets := uniqueTFSecrets(h)
	if len(secrets) > 0 {
		fmt.Printf("    %s %d env vars; secrets needed: %s\n",
			cli.Green(">>"), len(h.EnvVars), strings.Join(secrets, ", "))
	}
}

func uniqueTFSecrets(h *tfPipelineHints) []string {
	seen := map[string]bool{}
	var out []string
	for _, v := range h.EnvVars {
		if v.IsSecret && !seen[v.Name] {
			seen[v.Name] = true
			out = append(out, v.Name)
		}
	}
	return out
}
