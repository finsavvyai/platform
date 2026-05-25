package migrate

import (
	"fmt"
	"strings"
)

func parseJobMatrix(jobMap map[string]interface{}, name string, pj *parsedJob, result *ConvertResult) {
	if strategy, ok := jobMap["strategy"].(map[string]interface{}); ok {
		if matrix, ok := strategy["matrix"].(map[string]interface{}); ok {
			for k, v := range matrix {
				pj.matrix = append(pj.matrix, fmt.Sprintf("%s: %v", k, v))
			}
			result.Warnings = append(result.Warnings,
				fmt.Sprintf("Job '%s' has matrix strategy (%s) — runs sequentially in PushCI", name, strings.Join(pj.matrix, ", ")))
		}
	}
}

func parseJobSteps(jobMap map[string]interface{}, name string, pj *parsedJob, result *ConvertResult) {
	steps, ok := jobMap["steps"].([]interface{})
	if !ok {
		return
	}
	for _, step := range steps {
		stepMap, ok := step.(map[string]interface{})
		if !ok {
			continue
		}
		if run, ok := stepMap["run"].(string); ok {
			processRunStep(run, name, pj, result)
			continue
		}
		if uses, ok := stepMap["uses"].(string); ok {
			processUsesStep(uses, stepMap, name, pj, result)
		}
		scanStepEnv(stepMap, name, result)
	}
}

func processRunStep(run, name string, pj *parsedJob, result *ConvertResult) {
	secretRefs := extractSecretRefs(run, name)
	result.EnvVarsNeeded = append(result.EnvVarsNeeded, secretRefs...)
	cleaned := secretPattern.ReplaceAllStringFunc(run, func(s string) string {
		match := secretPattern.FindStringSubmatch(s)
		if len(match) > 1 {
			return "$" + match[1]
		}
		return s
	})
	pj.steps = append(pj.steps, cleaned)
	result.StepsKept++
}

func processUsesStep(uses string, stepMap map[string]interface{}, name string, pj *parsedJob, result *ConvertResult) {
	if mapped := mapAction(uses); mapped != "" {
		pj.steps = append(pj.steps, mapped)
		result.StepsKept++
	} else {
		result.StepsRemoved++
		stepName, _ := stepMap["name"].(string)
		if stepName == "" {
			stepName = uses
		}
		result.Warnings = append(result.Warnings,
			fmt.Sprintf("Skipped action: %s (%s) — handled by PushCI auto-detect", stepName, uses))
	}
}

func scanStepEnv(stepMap map[string]interface{}, name string, result *ConvertResult) {
	stepEnv, ok := stepMap["env"].(map[string]interface{})
	if !ok {
		return
	}
	for k, v := range stepEnv {
		vs := fmt.Sprint(v)
		if strings.Contains(vs, "secrets.") {
			result.EnvVarsNeeded = append(result.EnvVarsNeeded, EnvVarRef{
				Name: k, Source: "github-secret", UsedIn: name,
				IsSecret: true, Suggestion: fmt.Sprintf("pushci secret set %s <value>", k),
			})
		}
	}
}
