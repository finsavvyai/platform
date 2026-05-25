package migrate

import (
	"fmt"
	"strings"

	"gopkg.in/yaml.v3"
)

// BitbucketConvertResult holds the migration output.
type BitbucketConvertResult struct {
	PushCIYAML     string
	StepsKept      int
	StepsRemoved   int
	PipelinesFound int
	Warnings       []string
	EnvVarsNeeded  []EnvVarRef
}

// ConvertBitbucket converts a bitbucket-pipelines.yml to PushCI format.
func ConvertBitbucket(rawYAML string) *BitbucketConvertResult {
	result := &BitbucketConvertResult{}
	var raw map[string]interface{}
	if err := yaml.Unmarshal([]byte(rawYAML), &raw); err != nil {
		result.Warnings = append(result.Warnings, "Failed to parse bitbucket-pipelines.yml: "+err.Error())
		return result
	}

	var b strings.Builder
	b.WriteString("\"on\":\n  - push\n  - pull_request\n\nstages:\n")
	prevStage := ""
	if pipelines, ok := raw["pipelines"].(map[string]interface{}); ok {
		if def, ok := pipelines["default"].([]interface{}); ok {
			prevStage = processBitbucketSteps(def, "default", prevStage, &b, result)
		}
		convertBitbucketBranches(pipelines, prevStage, &b, result)
		convertBitbucketPRs(pipelines, &b, result)
	}
	result.PushCIYAML = b.String()
	return result
}

func convertBitbucketBranches(pipelines map[string]interface{}, prevStage string, b *strings.Builder, result *BitbucketConvertResult) {
	branches, ok := pipelines["branches"].(map[string]interface{})
	if !ok {
		return
	}
	for branch, steps := range branches {
		stepsArr, ok := steps.([]interface{})
		if !ok {
			continue
		}
		stageName := "deploy-" + sanitizeName(branch)
		fmt.Fprintf(b, "  - name: %s\n    checks:\n", stageName)
		for _, step := range stepsArr {
			extractBitbucketStep(step, stageName, b, result)
		}
		if prevStage != "" {
			fmt.Fprintf(b, "    depends_on:\n      - %s\n", prevStage)
		}
		fmt.Fprintf(b, "    only_on:\n      - %s\n", branch)
		result.PipelinesFound++
	}
}

func convertBitbucketPRs(pipelines map[string]interface{}, b *strings.Builder, result *BitbucketConvertResult) {
	prs, ok := pipelines["pull-requests"].(map[string]interface{})
	if !ok {
		return
	}
	for pattern, steps := range prs {
		stepsArr, ok := steps.([]interface{})
		if !ok {
			continue
		}
		stageName := "pr-" + sanitizeName(pattern)
		fmt.Fprintf(b, "  - name: %s\n    checks:\n", stageName)
		for _, step := range stepsArr {
			extractBitbucketStep(step, stageName, b, result)
		}
		result.PipelinesFound++
	}
}
