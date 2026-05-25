package migrate

import "fmt"

// extractTopLevelScriptList pulls a top-level script-shaped key
// (before_script / after_script) from the raw YAML tree. GitLab
// allows either a plain list or a nested list; we flatten to a
// single []string.
func extractTopLevelScriptList(raw map[string]interface{}, key string) []string {
	v, ok := raw[key]
	if !ok {
		return nil
	}
	arr, ok := v.([]interface{})
	if !ok {
		return nil
	}
	var out []string
	for _, item := range arr {
		switch t := item.(type) {
		case string:
			if t != "" {
				out = append(out, t)
			}
		case []interface{}:
			for _, inner := range t {
				if s, ok := inner.(string); ok && s != "" {
					out = append(out, s)
				}
			}
		}
	}
	return out
}

// injectSetupCleanup converts top-level before_script / after_script
// into dedicated `setup` and `cleanup` pushci stages.
//
//   - before_script → emitted as the FIRST stage named `setup`. Every
//     regular stage gets a depends_on(`setup`) edge so the setup runs
//     ahead of all real work. This is the correct semantic match for
//     GitLab's "runs before each job" — in PushCI we run it once and
//     gate downstream stages on it.
//   - after_script → emitted as the LAST stage named `cleanup`. A
//     warning is added because GitLab runs after_script even on
//     failure; PushCI skips downstream stages after a failure, so the
//     semantics differ.
//
// This is the core fix for the lambda-layers bug where top-level
// setup commands were leaking into a stage named `deploy` (or worse,
// silently lost when a job's before_script was skipped).
func injectSetupCleanup(stages []string, stageJobs map[string][]string, setup, cleanup []string, result *GitLabConvertResult) ([]string, map[string][]string) {
	if len(setup) > 0 {
		stages = prependStage(stages, "setup")
		stageJobs["setup"] = append(stageJobs["setup"], setup...)
	}
	if len(cleanup) > 0 {
		stages = append(stages, "cleanup")
		stageJobs["cleanup"] = append(stageJobs["cleanup"], cleanup...)
		result.Warnings = append(result.Warnings,
			fmt.Sprintf("Top-level after_script → emitted as '%s' stage (GitLab runs after_script on failure; PushCI does not)", "cleanup"))
	}
	return stages, stageJobs
}

// prependStage inserts name at position 0, dropping any existing
// occurrence so we don't duplicate a user-declared `setup` stage.
func prependStage(stages []string, name string) []string {
	out := []string{name}
	for _, s := range stages {
		if s != name {
			out = append(out, s)
		}
	}
	return out
}
