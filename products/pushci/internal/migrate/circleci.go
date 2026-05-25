package migrate

import (
	"fmt"
	"strings"

	"gopkg.in/yaml.v3"
)

// CircleCIConvertResult holds the migration output.
type CircleCIConvertResult struct {
	PushCIYAML    string
	JobsConverted int
	StepsKept     int
	StepsRemoved  int
	Warnings      []string
	EnvVarsNeeded []EnvVarRef
}

// ConvertCircleCI converts a .circleci/config.yml to PushCI format.
func ConvertCircleCI(rawYAML string) *CircleCIConvertResult {
	result := &CircleCIConvertResult{}

	var raw map[string]interface{}
	if err := yaml.Unmarshal([]byte(rawYAML), &raw); err != nil {
		result.Warnings = append(result.Warnings, "Failed to parse CircleCI config: "+err.Error())
		return result
	}

	jobsRaw, _ := raw["jobs"].(map[string]interface{})
	jobOrder, jobDeps := extractCircleCIWorkflows(raw)

	if len(jobOrder) == 0 {
		for name := range jobsRaw {
			jobOrder = append(jobOrder, name)
		}
	}

	var b strings.Builder
	b.WriteString("\"on\":\n  - push\n  - pull_request\n\nstages:\n")

	for _, jobName := range jobOrder {
		jobVal, ok := jobsRaw[jobName]
		if !ok {
			continue
		}
		convertCircleCIJob(jobName, jobVal, jobDeps, &b, result)
	}

	result.PushCIYAML = b.String()
	return result
}

func extractCircleCIWorkflows(raw map[string]interface{}) ([]string, map[string][]string) {
	jobOrder := []string{}
	jobDeps := map[string][]string{}

	workflows, ok := raw["workflows"].(map[string]interface{})
	if !ok {
		return jobOrder, jobDeps
	}
	for _, wf := range workflows {
		wfMap, ok := wf.(map[string]interface{})
		if !ok {
			continue
		}
		wfJobs, ok := wfMap["jobs"].([]interface{})
		if !ok {
			continue
		}
		for _, j := range wfJobs {
			switch jt := j.(type) {
			case string:
				jobOrder = append(jobOrder, jt)
			case map[string]interface{}:
				for name, config := range jt {
					jobOrder = append(jobOrder, name)
					if cm, ok := config.(map[string]interface{}); ok {
						if requires, ok := cm["requires"].([]interface{}); ok {
							for _, r := range requires {
								jobDeps[name] = append(jobDeps[name], fmt.Sprint(r))
							}
						}
					}
				}
			}
		}
	}
	return jobOrder, jobDeps
}
