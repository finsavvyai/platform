package migrate

import (
	"fmt"
	"regexp"
	"strings"

	"gopkg.in/yaml.v3"
)

var secretPattern = regexp.MustCompile(`\$\{\{\s*secrets\.([A-Z_][A-Z0-9_]*)\s*\}\}`)

func convertActionsFromYAML(rawYAML string) *ConvertResult {
	result := &ConvertResult{}

	var raw map[string]interface{}
	if err := yaml.Unmarshal([]byte(rawYAML), &raw); err != nil {
		result.Warnings = append(result.Warnings, "Failed to parse workflow: "+err.Error())
		return result
	}

	globalEnv := extractMapStrings(raw, "env")

	jobsRaw, ok := raw["jobs"].(map[string]interface{})
	if !ok {
		result.Warnings = append(result.Warnings, "No jobs found in workflow")
		return result
	}

	jobs := parseActionsJobs(jobsRaw, result)
	result.PushCIYAML = buildActionsYAML(jobs, globalEnv, result)
	return result
}

type parsedJob struct {
	name   string
	needs  []string
	steps  []string
	env    map[string]string
	onlyOn []string
	matrix []string
}

func parseActionsJobs(jobsRaw map[string]interface{}, result *ConvertResult) []parsedJob {
	var jobs []parsedJob
	for name, val := range jobsRaw {
		jobData, _ := yaml.Marshal(val)
		var jobMap map[string]interface{}
		yaml.Unmarshal(jobData, &jobMap)

		pj := parsedJob{name: name}
		parseJobNeeds(jobMap, &pj)
		pj.env = extractMapStrings(jobMap, "env")
		parseJobConditions(jobMap, &pj)
		parseJobMatrix(jobMap, name, &pj, result)
		parseJobSteps(jobMap, name, &pj, result)

		if len(pj.steps) > 0 {
			jobs = append(jobs, pj)
		}
	}
	return jobs
}

func parseJobNeeds(jobMap map[string]interface{}, pj *parsedJob) {
	if needs, ok := jobMap["needs"]; ok {
		switch n := needs.(type) {
		case []interface{}:
			for _, v := range n {
				pj.needs = append(pj.needs, fmt.Sprint(v))
			}
		case string:
			pj.needs = []string{n}
		}
	}
}

func parseJobConditions(jobMap map[string]interface{}, pj *parsedJob) {
	if ifCond, ok := jobMap["if"].(string); ok {
		if strings.Contains(ifCond, "main") {
			pj.onlyOn = append(pj.onlyOn, "main")
		}
		if strings.Contains(ifCond, "master") {
			pj.onlyOn = append(pj.onlyOn, "master")
		}
		if strings.Contains(ifCond, "develop") {
			pj.onlyOn = append(pj.onlyOn, "develop")
		}
	}
}
