package migrate

import (
	"fmt"
	"strings"

	"gopkg.in/yaml.v3"
)

func extractStages(raw map[string]interface{}) []string {
	var stages []string
	if s, ok := raw["stages"]; ok {
		if arr, ok := s.([]interface{}); ok {
			for _, v := range arr {
				stages = append(stages, fmt.Sprint(v))
			}
		}
	}
	return stages
}

func extractGlobalVars(raw map[string]interface{}) map[string]string {
	globalVars := map[string]string{}
	if v, ok := raw["variables"]; ok {
		if vars, ok := v.(map[string]interface{}); ok {
			for k, val := range vars {
				globalVars[k] = fmt.Sprint(val)
			}
		}
	}
	return globalVars
}

func extractJobs(raw map[string]interface{}, result *GitLabConvertResult) (map[string][]string, map[string]map[string]string, map[string][]string) {
	keywords := map[string]bool{
		"stages": true, "variables": true, "image": true,
		"before_script": true, "after_script": true,
		"cache": true, "include": true, "default": true,
		"workflow": true, "services": true,
	}

	stageJobs := map[string][]string{}
	stageEnvs := map[string]map[string]string{}
	stageOnly := map[string][]string{}

	for name, val := range raw {
		if keywords[name] || name[0] == '.' {
			continue
		}
		jobData, err := yaml.Marshal(val)
		if err != nil {
			continue
		}
		var job GitLabJob
		if err := yaml.Unmarshal(jobData, &job); err != nil {
			continue
		}
		stage := job.Stage
		if stage == "" {
			stage = "test"
		}
		// Per-job before_script runs BEFORE each job's script in
		// GitLab. Prepend it so the setup (pip install, exports, etc.)
		// executes ahead of the real commands in the same stage.
		merged := append([]string{}, job.BeforeScript...)
		merged = append(merged, job.Script...)
		if len(job.AfterScript) > 0 {
			result.Warnings = append(result.Warnings,
				"Job '"+name+"' has after_script — appended to stage "+stage+
					" (GitLab runs after_script even on failure; PushCI does not)")
			merged = append(merged, job.AfterScript...)
		}
		if len(merged) == 0 {
			warnEmptyJob(result, name)
		}
		for _, script := range merged {
			stageJobs[stage] = append(stageJobs[stage], script)
			result.EnvVarsNeeded = append(result.EnvVarsNeeded, extractVarRefs(script, name)...)
		}
		for k, v := range job.Variables {
			if stageEnvs[stage] == nil {
				stageEnvs[stage] = map[string]string{}
			}
			stageEnvs[stage][k] = v
		}
		if only := coerceStringList(job.Only); len(only) > 0 {
			stageOnly[stage] = only
		}
		for _, rule := range job.Rules {
			if strings.Contains(rule.If, "main") || strings.Contains(rule.If, "master") {
				stageOnly[stage] = []string{"main", "master"}
			}
		}
		result.JobsConverted++
	}
	return stageJobs, stageEnvs, stageOnly
}
