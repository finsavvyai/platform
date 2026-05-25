package migrate

import (
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// TerraformPipelineResult is the shared output of Terraform HCL pipeline
// extraction: one ExtractedPipeline per supported resource.
type TerraformPipelineResult struct {
	Pipelines     []ExtractedPipeline
	Warnings      []string
	EnvVarsNeeded []EnvVarRef
}

// ExtractedPipeline is a generic pipeline shape distilled from any
// supported Terraform resource type.
type ExtractedPipeline struct {
	Platform     string            // "aws-codebuild", "aws-codepipeline", "gcp-cloudbuild", "harness", "azure-devops"
	Name         string            // resource label or `name` attribute
	Source       string            // repo URL or local path
	BuildspecRef string            // for codebuild: buildspec path
	EnvVars      map[string]string // inlined env vars (not secrets)
	Stages       []ExtractedStage  // multi-stage deploys (codepipeline)
	RawHCL       string            // original block text for reference
}

// ExtractedStage is one stage of a multi-stage pipeline.
type ExtractedStage struct {
	Name     string
	Provider string            // CodeBuild, CodeDeploy, ECS, S3, Manual...
	Actions  []string          // action names
	Config   map[string]string // action configuration key/value pairs
}

// ConvertTerraformPipeline walks every *.tf file in dir and extracts
// pipeline-shaped resources. Returns an empty result (never nil) on I/O
// errors so callers can surface Warnings without nil-checks.
func ConvertTerraformPipeline(dir string) *TerraformPipelineResult {
	result := &TerraformPipelineResult{}
	files, err := collectTerraformFiles(dir)
	if err != nil {
		result.Warnings = append(result.Warnings, "Failed to read tf dir: "+err.Error())
		return result
	}
	if len(files) == 0 {
		result.Warnings = append(result.Warnings, "No *.tf files found in "+dir)
		return result
	}
	for _, f := range files {
		data, err := os.ReadFile(f)
		if err != nil {
			result.Warnings = append(result.Warnings, "read "+f+": "+err.Error())
			continue
		}
		for _, block := range parseTerraformBlocks(string(data)) {
			dispatchTerraformResource(block, result, dir)
		}
	}
	return result
}

func collectTerraformFiles(dir string) ([]string, error) {
	var files []string
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".tf") {
			continue
		}
		files = append(files, filepath.Join(dir, e.Name()))
	}
	sort.Strings(files)
	return files, nil
}

// dispatchTerraformResource routes a parsed block to the right
// provider-specific extractor based on `resource "<type>" "<label>"`.
// dir resolves `var.X` interpolations against co-located *.tfvars.
func dispatchTerraformResource(block tfBlock, result *TerraformPipelineResult, dir string) {
	if block.Kind != "resource" || len(block.Labels) < 2 {
		return
	}
	switch block.Labels[0] {
	case "aws_codebuild_project":
		extractAWSCodeBuild(block, result, dir)
	case "aws_codepipeline":
		extractAWSCodePipeline(block, result, dir)
	case "google_cloudbuild_trigger":
		extractGCPCloudBuild(block, result)
	case "harness_platform_pipeline":
		extractHarnessPipeline(block, result)
	case "azuredevops_build_definition":
		extractAzureDevOps(block, result)
	}
}
