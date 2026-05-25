package migrate

import (
	"fmt"
	"strings"

	"gopkg.in/yaml.v3"
)

func convertCircleCIJob(jobName string, jobVal interface{}, jobDeps map[string][]string, b *strings.Builder, result *CircleCIConvertResult) {
	jobData, _ := yaml.Marshal(jobVal)
	var jobMap map[string]interface{}
	yaml.Unmarshal(jobData, &jobMap)

	warnCircleCIDocker(jobMap, jobName, result)
	jobEnv := extractCircleCIEnv(jobMap)
	steps := extractCircleCISteps(jobMap, jobName, result)

	if len(steps) == 0 {
		return
	}

	fmt.Fprintf(b, "  - name: %s\n    checks:\n", jobName)
	writeCircleCISteps(steps, jobName, b)

	if deps, ok := jobDeps[jobName]; ok && len(deps) > 0 {
		b.WriteString("    depends_on:\n")
		for _, d := range deps {
			fmt.Fprintf(b, "      - %s\n", d)
		}
	}
	if len(jobEnv) > 0 {
		b.WriteString("    env:\n")
		for k, v := range jobEnv {
			fmt.Fprintf(b, "      %s: \"%s\"\n", k, v)
		}
	}
	result.JobsConverted++
}

func writeCircleCISteps(steps []string, jobName string, b *strings.Builder) {
	for i, step := range steps {
		lines := strings.Split(strings.TrimSpace(step), "\n")
		fmt.Fprintf(b, "      - name: %s-%d\n        run: %s\n", jobName, i+1, lines[0])
		for _, l := range lines[1:] {
			l = strings.TrimSpace(l)
			if l != "" {
				fmt.Fprintf(b, "      - name: %s-%d-cont\n        run: %s\n", jobName, i+1, l)
			}
		}
	}
}

func warnCircleCIDocker(jobMap map[string]interface{}, jobName string, result *CircleCIConvertResult) {
	docker, ok := jobMap["docker"].([]interface{})
	if !ok {
		return
	}
	for _, d := range docker {
		if dm, ok := d.(map[string]interface{}); ok {
			if img, ok := dm["image"].(string); ok {
				result.Warnings = append(result.Warnings,
					fmt.Sprintf("Job '%s' uses Docker image: %s — ensure it's available locally", jobName, img))
			}
		}
	}
}

func extractCircleCIEnv(jobMap map[string]interface{}) map[string]string {
	env := map[string]string{}
	if e, ok := jobMap["environment"].(map[string]interface{}); ok {
		for k, v := range e {
			env[k] = fmt.Sprint(v)
		}
	}
	return env
}
