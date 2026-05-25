package migrate

import (
	"fmt"
	"strings"

	"gopkg.in/yaml.v3"
)

// AzureConvertResult holds the migration output.
type AzureConvertResult struct {
	PushCIYAML      string
	StagesConverted int
	JobsConverted   int
	StepsKept       int
	Warnings        []string
	EnvVarsNeeded   []EnvVarRef
}

// ConvertAzurePipelines converts an azure-pipelines.yml to PushCI format.
func ConvertAzurePipelines(rawYAML string) *AzureConvertResult {
	result := &AzureConvertResult{}

	var raw map[string]interface{}
	if err := yaml.Unmarshal([]byte(rawYAML), &raw); err != nil {
		result.Warnings = append(result.Warnings, "Failed to parse azure-pipelines.yml: "+err.Error())
		return result
	}

	globalVars := extractAzureGlobalVars(raw, result)

	var b strings.Builder
	b.WriteString("\"on\":\n  - push\n  - pull_request\n\nstages:\n")

	convertAzureStages(raw, &b, result, globalVars)
	convertAzureJobs(raw, &b, result, globalVars)
	convertAzureSimpleSteps(raw, &b, result, globalVars)
	appendAzureVarWarnings(globalVars, result)

	result.PushCIYAML = b.String()
	return result
}

func extractAzureGlobalVars(raw map[string]interface{}, result *AzureConvertResult) map[string]string {
	globalVars := map[string]string{}
	if vars, ok := raw["variables"]; ok {
		switch v := vars.(type) {
		case map[string]interface{}:
			for k, val := range v {
				globalVars[k] = fmt.Sprint(val)
			}
		case []interface{}:
			for _, item := range v {
				if m, ok := item.(map[string]interface{}); ok {
					if name, ok := m["name"].(string); ok {
						if val, ok := m["value"]; ok {
							globalVars[name] = fmt.Sprint(val)
						}
						if group, ok := m["group"].(string); ok {
							result.Warnings = append(result.Warnings,
								fmt.Sprintf("Variable group '%s' referenced — set vars locally", group))
						}
					}
				}
			}
		}
	}
	return globalVars
}

func appendAzureVarWarnings(globalVars map[string]string, result *AzureConvertResult) {
	if len(globalVars) == 0 {
		return
	}
	result.Warnings = append(result.Warnings, "")
	result.Warnings = append(result.Warnings, "Azure DevOps pipeline variables:")
	for k, v := range globalVars {
		if isLikelySecret(k) {
			result.EnvVarsNeeded = append(result.EnvVarsNeeded, EnvVarRef{
				Name: k, Source: "azure-variable", IsSecret: true,
				Suggestion: fmt.Sprintf("pushci secret set %s <value>", k),
			})
		} else {
			result.Warnings = append(result.Warnings,
				fmt.Sprintf("  %s = %s → add to stage env:", k, v))
		}
	}
}
