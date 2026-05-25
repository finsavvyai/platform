package migrate

import (
	"fmt"
	"strings"
)

// ActionsWorkflow represents a parsed GitHub Actions workflow.
type ActionsWorkflow struct {
	Name     string
	Triggers []string
	Jobs     []ActionsJob
	RawYAML  string
}

// ActionsJob represents a single job in a workflow.
type ActionsJob struct {
	Name  string
	Steps []ActionsStep
}

// ActionsStep represents a step in a workflow job.
type ActionsStep struct {
	Name string
	Uses string
	Run  string
}

// ConvertResult holds the result of converting a GitHub Actions workflow.
type ConvertResult struct {
	PushCIYAML      string
	StepsKept       int
	StepsRemoved    int
	StagesConverted int
	Warnings        []string
	EnvVarsNeeded   []EnvVarRef
}

// ConvertActions converts a GitHub Actions YAML to PushCI format.
func ConvertActions(workflow ActionsWorkflow) *ConvertResult {
	result := &ConvertResult{}
	if workflow.RawYAML != "" {
		return convertActionsFromYAML(workflow.RawYAML)
	}

	// Fallback to legacy struct-based conversion
	var checks []string
	for _, job := range workflow.Jobs {
		for _, step := range job.Steps {
			converted := convertStep(step)
			if converted != "" {
				checks = append(checks, converted)
				result.StepsKept++
			} else {
				result.StepsRemoved++
				if step.Uses != "" {
					result.Warnings = append(result.Warnings,
						fmt.Sprintf("Skipped: %s (uses: %s)", step.Name, step.Uses))
				}
			}
		}
	}
	triggers := strings.Join(workflow.Triggers, ", ")
	result.PushCIYAML = buildPushCIYAML(workflow.Name, triggers, checks)
	return result
}

func convertStep(step ActionsStep) string {
	if step.Run != "" {
		return step.Run
	}
	if mapped := mapAction(step.Uses); mapped != "" {
		return mapped
	}
	return ""
}

func buildPushCIYAML(name, triggers string, checks []string) string {
	y := fmt.Sprintf("name: %s\non: [%s]\nchecks:\n", name, triggers)
	for _, c := range checks {
		y += fmt.Sprintf("  - %s\n", c)
	}
	return y
}

func extractMapStrings(m map[string]interface{}, key string) map[string]string {
	result := map[string]string{}
	if v, ok := m[key].(map[string]interface{}); ok {
		for k, val := range v {
			result[k] = fmt.Sprint(val)
		}
	}
	return result
}
