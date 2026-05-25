package migrate

import "fmt"

func extractCircleCISteps(jobMap map[string]interface{}, jobName string, result *CircleCIConvertResult) []string {
	stepsRaw, ok := jobMap["steps"].([]interface{})
	if !ok {
		return nil
	}
	var steps []string
	for _, step := range stepsRaw {
		switch s := step.(type) {
		case string:
			if s == "checkout" {
				result.StepsRemoved++
				continue
			}
			steps = append(steps, s)
			result.StepsKept++
		case map[string]interface{}:
			steps = append(steps, extractCircleCIMapStep(s, jobName, result)...)
		}
	}
	return steps
}

func extractCircleCIMapStep(s map[string]interface{}, jobName string, result *CircleCIConvertResult) []string {
	var steps []string
	if run, ok := s["run"]; ok {
		var cmd string
		switch r := run.(type) {
		case string:
			cmd = r
		case map[string]interface{}:
			if c, ok := r["command"].(string); ok {
				cmd = c
			}
		}
		if cmd != "" {
			result.EnvVarsNeeded = append(result.EnvVarsNeeded, extractVarRefs(cmd, jobName)...)
			steps = append(steps, cmd)
			result.StepsKept++
		}
	}
	for key := range s {
		switch key {
		case "restore_cache", "save_cache":
			result.Warnings = append(result.Warnings,
				fmt.Sprintf("Job '%s': %s — PushCI uses local filesystem cache", jobName, key))
			result.StepsRemoved++
		case "store_artifacts", "store_test_results":
			result.Warnings = append(result.Warnings,
				fmt.Sprintf("Job '%s': %s — use pushci artifacts push", jobName, key))
			result.StepsRemoved++
		case "persist_to_workspace", "attach_workspace":
			result.Warnings = append(result.Warnings,
				fmt.Sprintf("Job '%s': %s — files persist between stages locally", jobName, key))
			result.StepsRemoved++
		}
	}
	return steps
}
