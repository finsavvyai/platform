package migrate

import (
	"fmt"
	"strings"
)

func processAzureStep(step interface{}, stageName string, b *strings.Builder, result *AzureConvertResult, globalVars map[string]string) {
	stepMap, ok := step.(map[string]interface{})
	if !ok {
		return
	}
	if script, ok := stepMap["script"].(string); ok {
		processAzureScript(script, stageName, b, result)
		return
	}
	if bash, ok := stepMap["bash"].(string); ok {
		processAzureBash(bash, stageName, b, result)
		return
	}
	if task, ok := stepMap["task"].(string); ok {
		processAzureTask(task, stepMap, stageName, b, result)
	}
}

func processAzureScript(script, stageName string, b *strings.Builder, result *AzureConvertResult) {
	for _, line := range strings.Split(strings.TrimSpace(script), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		result.EnvVarsNeeded = append(result.EnvVarsNeeded, extractVarRefs(line, stageName)...)
		line = azureVarReplace(line)
		fmt.Fprintf(b, "      - name: %s-%d\n        run: %s\n", stageName, result.StepsKept+1, line)
		result.StepsKept++
	}
}

func processAzureBash(bash, stageName string, b *strings.Builder, result *AzureConvertResult) {
	for _, line := range strings.Split(strings.TrimSpace(bash), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		line = azureVarReplace(line)
		fmt.Fprintf(b, "      - name: %s-%d\n        run: %s\n", stageName, result.StepsKept+1, line)
		result.StepsKept++
	}
}

func processAzureTask(task string, stepMap map[string]interface{}, stageName string, b *strings.Builder, result *AzureConvertResult) {
	mapped := mapAzureTask(task)
	if mapped != "" {
		fmt.Fprintf(b, "      - name: %s-%d\n        run: %s\n", stageName, result.StepsKept+1, mapped)
		result.StepsKept++
	} else {
		displayName, _ := stepMap["displayName"].(string)
		if displayName == "" {
			displayName = task
		}
		result.Warnings = append(result.Warnings, fmt.Sprintf("Skipped Azure task: %s — no local equivalent", displayName))
		result.StepsKept++
	}
}

func processAzureJob(jm map[string]interface{}, stageName string, b *strings.Builder, result *AzureConvertResult, globalVars map[string]string) {
	if pool, ok := jm["pool"].(map[string]interface{}); ok {
		if vmImage, ok := pool["vmImage"].(string); ok {
			result.Warnings = append(result.Warnings, fmt.Sprintf("Job uses Azure pool: %s — runs locally in PushCI", vmImage))
		}
	}
	if steps, ok := jm["steps"].([]interface{}); ok {
		for _, step := range steps {
			processAzureStep(step, stageName, b, result, globalVars)
		}
	}
}

func azureVarReplace(s string) string {
	result := s
	for {
		idx := strings.Index(result, "$(")
		if idx == -1 {
			break
		}
		end := strings.Index(result[idx:], ")")
		if end == -1 {
			break
		}
		varName := result[idx+2 : idx+end]
		result = result[:idx] + "$" + varName + result[idx+end+1:]
	}
	return result
}
