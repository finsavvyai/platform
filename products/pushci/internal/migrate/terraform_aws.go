package migrate

import (
	"fmt"
	"strings"
)

// extractAWSCodeBuild parses an `aws_codebuild_project` resource block.
// Docs: https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/codebuild_project
func extractAWSCodeBuild(block tfBlock, result *TerraformPipelineResult, dir string) {
	attrs := parseTerraformAttrs(block.Body)
	nested := parseTerraformBlocks(block.Body)

	pipe := ExtractedPipeline{
		Platform: "aws-codebuild",
		Name:     resolveTFName(unquoteTF(attrs["name"]), dir, block.Labels[1]),
		EnvVars:  map[string]string{},
		RawHCL:   block.Raw,
	}
	for _, n := range nested {
		switch n.Kind {
		case "source":
			handleCodeBuildSource(n, &pipe)
		case "environment":
			handleCodeBuildEnvironment(n, &pipe, result)
		}
	}
	if pipe.BuildspecRef == "" {
		// source.buildspec not set → AWS defaults to `buildspec.yml` at repo root
		result.Warnings = append(result.Warnings,
			fmt.Sprintf("aws_codebuild_project.%s: no buildspec set — run `pushci migrate buildspec.yml` next", block.Labels[1]))
	}
	result.Pipelines = append(result.Pipelines, pipe)
}

func handleCodeBuildSource(n tfBlock, pipe *ExtractedPipeline) {
	sa := parseTerraformAttrs(n.Body)
	pipe.Source = unquoteTF(sa["location"])
	pipe.BuildspecRef = unquoteTF(sa["buildspec"])
}

func handleCodeBuildEnvironment(n tfBlock, pipe *ExtractedPipeline, result *TerraformPipelineResult) {
	for _, ev := range parseTerraformBlocks(n.Body) {
		if ev.Kind != "environment_variable" {
			continue
		}
		ea := parseTerraformAttrs(ev.Body)
		name := unquoteTF(ea["name"])
		val := unquoteTF(ea["value"])
		if name == "" {
			continue
		}
		pipe.EnvVars[name] = val
		result.EnvVarsNeeded = append(result.EnvVarsNeeded, buildCodeBuildEnvRef(name, val, pipe.Name))
	}
}

func buildCodeBuildEnvRef(name, val, jobName string) EnvVarRef {
	ref := EnvVarRef{Name: name, Source: "terraform-codebuild", UsedIn: jobName}
	if strings.HasPrefix(val, "var.") || strings.HasPrefix(val, "data.") || isLikelySecret(name) {
		ref.IsSecret = true
		ref.Suggestion = fmt.Sprintf("pushci secret set %s <value>", name)
	} else {
		ref.Suggestion = fmt.Sprintf("export %s=%q", name, val)
	}
	return ref
}
