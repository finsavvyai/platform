package migrate

import "fmt"

// extractGCPCloudBuild parses a `google_cloudbuild_trigger` resource.
// Docs: https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/cloudbuild_trigger
//
// Unlike CodeBuild the actual steps live in a separate cloudbuild.yaml
// referenced by `filename`, so we emit a warning pointing users to
// `pushci migrate cloudbuild.yaml`.
func extractGCPCloudBuild(block tfBlock, result *TerraformPipelineResult) {
	attrs := parseTerraformAttrs(block.Body)
	pipe := ExtractedPipeline{
		Platform:     "gcp-cloudbuild",
		Name:         unquoteTF(attrs["name"]),
		BuildspecRef: unquoteTF(attrs["filename"]),
		EnvVars:      map[string]string{},
		RawHCL:       block.Raw,
	}
	if pipe.Name == "" {
		pipe.Name = block.Labels[1]
	}
	// Source can live in one of several nested blocks: `github`,
	// `trigger_template`, `source_to_build`. Pick whichever is present.
	for _, n := range parseTerraformBlocks(block.Body) {
		switch n.Kind {
		case "github":
			ga := parseTerraformAttrs(n.Body)
			pipe.Source = fmt.Sprintf("%s/%s", unquoteTF(ga["owner"]), unquoteTF(ga["name"]))
		case "trigger_template":
			ta := parseTerraformAttrs(n.Body)
			if repo := unquoteTF(ta["repo_name"]); repo != "" {
				pipe.Source = repo
			}
		}
	}
	if pipe.BuildspecRef != "" {
		result.Warnings = append(result.Warnings,
			fmt.Sprintf("google_cloudbuild_trigger.%s: cloudbuild YAML referenced — run `pushci migrate %s` next",
				block.Labels[1], pipe.BuildspecRef))
	}
	result.Pipelines = append(result.Pipelines, pipe)
}

// extractAzureDevOps parses an `azuredevops_build_definition` resource.
// Docs: https://registry.terraform.io/providers/microsoft/azuredevops/latest/docs/resources/build_definition
func extractAzureDevOps(block tfBlock, result *TerraformPipelineResult) {
	attrs := parseTerraformAttrs(block.Body)
	pipe := ExtractedPipeline{
		Platform: "azure-devops",
		Name:     unquoteTF(attrs["name"]),
		EnvVars:  map[string]string{},
		RawHCL:   block.Raw,
	}
	if pipe.Name == "" {
		pipe.Name = block.Labels[1]
	}
	for _, n := range parseTerraformBlocks(block.Body) {
		if n.Kind != "repository" {
			continue
		}
		ra := parseTerraformAttrs(n.Body)
		pipe.Source = unquoteTF(ra["repo_id"])
		pipe.BuildspecRef = unquoteTF(ra["yml_path"])
	}
	if pipe.BuildspecRef != "" {
		result.Warnings = append(result.Warnings,
			fmt.Sprintf("azuredevops_build_definition.%s: azure-pipelines YAML at %s — run `pushci migrate %s` next",
				block.Labels[1], pipe.BuildspecRef, pipe.BuildspecRef))
	}
	result.Pipelines = append(result.Pipelines, pipe)
}
