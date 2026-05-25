package migrate

import (
	"fmt"
	"strings"
)

func extractBitbucketStep(step interface{}, stageName string, b *strings.Builder, result *BitbucketConvertResult) {
	stepMap, ok := step.(map[string]interface{})
	if !ok {
		return
	}
	if s, ok := stepMap["step"].(map[string]interface{}); ok {
		if scripts, ok := s["script"].([]interface{}); ok {
			for i, script := range scripts {
				cmd := fmt.Sprint(script)
				result.EnvVarsNeeded = append(result.EnvVarsNeeded, extractVarRefs(cmd, stageName)...)
				fmt.Fprintf(b, "      - name: %s-%d\n        run: %s\n", stageName, i+1, cmd)
				result.StepsKept++
			}
		}
	}
}

func processBitbucketSteps(steps []interface{}, baseName, prevStage string, b *strings.Builder, result *BitbucketConvertResult) string {
	stepNum := 0
	for _, step := range steps {
		stepMap, ok := step.(map[string]interface{})
		if !ok {
			continue
		}
		if s, ok := stepMap["step"].(map[string]interface{}); ok {
			stepNum++
			prevStage = processSingleBitbucketStep(s, baseName, stepNum, prevStage, b, result)
		} else if parallel, ok := stepMap["parallel"].([]interface{}); ok {
			stepNum = processParallelBitbucketSteps(parallel, baseName, stepNum, prevStage, b, result)
		}
	}
	return prevStage
}

func processSingleBitbucketStep(s map[string]interface{}, baseName string, stepNum int, prevStage string, b *strings.Builder, result *BitbucketConvertResult) string {
	stageName := fmt.Sprintf("%s-%d", baseName, stepNum)
	if name, _ := s["name"].(string); name != "" {
		stageName = sanitizeName(name)
	}
	fmt.Fprintf(b, "  - name: %s\n    checks:\n", stageName)
	if scripts, ok := s["script"].([]interface{}); ok {
		for i, script := range scripts {
			cmd := fmt.Sprint(script)
			result.EnvVarsNeeded = append(result.EnvVarsNeeded, extractVarRefs(cmd, stageName)...)
			fmt.Fprintf(b, "      - name: %s-%d\n        run: %s\n", stageName, i+1, cmd)
			result.StepsKept++
		}
	}
	if prevStage != "" {
		fmt.Fprintf(b, "    depends_on:\n      - %s\n", prevStage)
	}
	if _, ok := s["caches"].([]interface{}); ok {
		result.Warnings = append(result.Warnings, fmt.Sprintf("Step '%s': caches — local filesystem cache", stageName))
	}
	if _, ok := s["artifacts"].([]interface{}); ok {
		result.Warnings = append(result.Warnings, fmt.Sprintf("Step '%s': artifacts — use pushci artifacts push", stageName))
	}
	if d, ok := s["deployment"].(string); ok {
		fmt.Fprintf(b, "    env:\n      DEPLOYMENT_ENV: \"%s\"\n", d)
	}
	if services, ok := s["services"].([]interface{}); ok {
		for _, svc := range services {
			result.Warnings = append(result.Warnings, fmt.Sprintf("Step '%s': service '%v' — ensure running locally", stageName, svc))
		}
	}
	result.PipelinesFound++
	return stageName
}
