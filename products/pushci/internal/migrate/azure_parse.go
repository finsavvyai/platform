package migrate

import (
	"fmt"
	"strings"
)

func convertAzureStages(raw map[string]interface{}, b *strings.Builder, result *AzureConvertResult, globalVars map[string]string) {
	stages, ok := raw["stages"].([]interface{})
	if !ok {
		return
	}
	prevStage := ""
	for _, stage := range stages {
		stageMap, ok := stage.(map[string]interface{})
		if !ok {
			continue
		}
		stageName := sanitizeName(fmt.Sprint(stageMap["stage"]))
		if stageName == "" {
			continue
		}
		var onlyOn []string
		if cond, ok := stageMap["condition"].(string); ok {
			if strings.Contains(cond, "main") {
				onlyOn = append(onlyOn, "main")
			}
			if strings.Contains(cond, "master") {
				onlyOn = append(onlyOn, "master")
			}
		}
		if jobs, ok := stageMap["jobs"].([]interface{}); ok {
			fmt.Fprintf(b, "  - name: %s\n    checks:\n", stageName)
			for _, job := range jobs {
				if jm, ok := job.(map[string]interface{}); ok {
					processAzureJob(jm, stageName, b, result, globalVars)
				}
			}
			if prevStage != "" {
				fmt.Fprintf(b, "    depends_on:\n      - %s\n", prevStage)
			}
			if len(onlyOn) > 0 {
				b.WriteString("    only_on:\n")
				for _, br := range onlyOn {
					fmt.Fprintf(b, "      - %s\n", br)
				}
			}
			result.StagesConverted++
			prevStage = stageName
		}
	}
}

func convertAzureJobs(raw map[string]interface{}, b *strings.Builder, result *AzureConvertResult, globalVars map[string]string) {
	jobs, ok := raw["jobs"].([]interface{})
	if !ok || result.StagesConverted > 0 {
		return
	}
	for _, job := range jobs {
		jm, ok := job.(map[string]interface{})
		if !ok {
			continue
		}
		jobName := sanitizeName(fmt.Sprint(jm["job"]))
		if jobName == "" {
			continue
		}
		fmt.Fprintf(b, "  - name: %s\n    checks:\n", jobName)
		processAzureJob(jm, jobName, b, result, globalVars)
		writeAzureJobDeps(jm, b)
		result.JobsConverted++
	}
}

func writeAzureJobDeps(jm map[string]interface{}, b *strings.Builder) {
	deps, ok := jm["dependsOn"]
	if !ok {
		return
	}
	b.WriteString("    depends_on:\n")
	switch d := deps.(type) {
	case string:
		fmt.Fprintf(b, "      - %s\n", sanitizeName(d))
	case []interface{}:
		for _, dep := range d {
			fmt.Fprintf(b, "      - %s\n", sanitizeName(fmt.Sprint(dep)))
		}
	}
}

func convertAzureSimpleSteps(raw map[string]interface{}, b *strings.Builder, result *AzureConvertResult, globalVars map[string]string) {
	steps, ok := raw["steps"].([]interface{})
	if !ok || result.StagesConverted > 0 || result.JobsConverted > 0 {
		return
	}
	b.WriteString("  - name: build\n    checks:\n")
	for _, step := range steps {
		processAzureStep(step, "build", b, result, globalVars)
	}
}
