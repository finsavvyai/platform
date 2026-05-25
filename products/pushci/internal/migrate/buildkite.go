package migrate

import (
	"fmt"
	"strings"

	"gopkg.in/yaml.v3"
)

// BuildkiteConvertResult holds the migration output.
type BuildkiteConvertResult struct {
	PushCIYAML      string
	StagesConverted int
	StepsConverted  int
	StepsSkipped    int
	Warnings        []string
	EnvVarsNeeded   []EnvVarRef
}

// ConvertBuildkite converts a .buildkite/pipeline.yml to PushCI format.
// Follows the same shape as ConvertGitLab / ConvertCircleCI so callers
// can swap migrators without reshaping consuming code.
func ConvertBuildkite(rawYAML string) *BuildkiteConvertResult {
	result := &BuildkiteConvertResult{}

	var raw map[string]interface{}
	if err := yaml.Unmarshal([]byte(rawYAML), &raw); err != nil {
		result.Warnings = append(result.Warnings,
			"Failed to parse .buildkite/pipeline.yml: "+err.Error())
		return result
	}

	globalEnv := parseBuildkiteEnv(raw["env"])
	steps := flattenBuildkiteSteps(raw["steps"], "", result)

	var b strings.Builder
	b.WriteString("\"on\":\n  - push\n  - pull_request\n\nstages:\n")

	prevLabel := ""
	for _, step := range steps {
		if !writeBuildkiteStage(&b, step, prevLabel, globalEnv, result) {
			continue
		}
		prevLabel = step.Label
	}

	if len(globalEnv) > 0 {
		appendBuildkiteEnvWarnings(globalEnv, result)
	}
	result.PushCIYAML = b.String()
	return result
}

// parseBuildkiteEnv coerces a YAML mapping of env vars into a flat map
// so both the top-level env and per-step env share one parser.
func parseBuildkiteEnv(v interface{}) map[string]string {
	out := map[string]string{}
	m, ok := v.(map[string]interface{})
	if !ok {
		return out
	}
	for k, val := range m {
		out[k] = toStringBK(val)
	}
	return out
}

func appendBuildkiteEnvWarnings(env map[string]string, result *BuildkiteConvertResult) {
	result.Warnings = append(result.Warnings, "Top-level env from .buildkite/pipeline.yml:")
	for k, v := range env {
		if isLikelySecret(k) {
			result.EnvVarsNeeded = append(result.EnvVarsNeeded, EnvVarRef{
				Name: k, Source: "buildkite-env", IsSecret: true,
				Suggestion: fmt.Sprintf("pushci secret set %s <value>", k),
			})
			result.Warnings = append(result.Warnings, fmt.Sprintf("  SECRET: %s → pushci secret set %s <value>", k, k))
			continue
		}
		result.Warnings = append(result.Warnings, fmt.Sprintf("  %s = %s → add to stage env:", k, v))
	}
}
