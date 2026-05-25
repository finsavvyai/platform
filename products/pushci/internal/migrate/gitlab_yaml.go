package migrate

import (
	"fmt"
	"strings"
)

func buildGitLabYAML(stages []string, stageJobs map[string][]string, stageEnvs map[string]map[string]string, stageOnly map[string][]string, result *GitLabConvertResult) string {
	var b strings.Builder
	b.WriteString("\"on\":\n  - push\n  - pull_request\n\nstages:\n")

	prevStage := ""
	for _, stage := range stages {
		scripts := stageJobs[stage]
		if len(scripts) == 0 {
			continue
		}
		fmt.Fprintf(&b, "  - name: %s\n    checks:\n", stage)
		for i, script := range scripts {
			writeScriptCheck(&b, stage, i+1, script)
		}
		if prevStage != "" {
			fmt.Fprintf(&b, "    depends_on:\n      - %s\n", prevStage)
		}
		if env, ok := stageEnvs[stage]; ok && len(env) > 0 {
			b.WriteString("    env:\n")
			for k, v := range env {
				fmt.Fprintf(&b, "      %s: \"%s\"\n", k, v)
			}
		}
		if only, ok := stageOnly[stage]; ok && len(only) > 0 {
			b.WriteString("    only_on:\n")
			for _, br := range only {
				fmt.Fprintf(&b, "      - %s\n", br)
			}
		}
		result.StagesConverted++
		prevStage = stage
	}
	return b.String()
}

// writeScriptCheck emits one check entry. Multi-line scripts (very
// common after !reference inlining of literal block scalars) MUST
// use a YAML block scalar — otherwise embedded newlines break the
// outer document and yaml.Unmarshal into config.Pipeline fails,
// causing cmd_init to silently fall back to a generic build/test
// pipeline.
func writeScriptCheck(b *strings.Builder, stage string, idx int, script string) {
	if !strings.ContainsAny(script, "\n") {
		fmt.Fprintf(b, "      - name: %s-%d\n        run: %s\n", stage, idx, yamlScalarEscape(script))
		return
	}
	fmt.Fprintf(b, "      - name: %s-%d\n        run: |\n", stage, idx)
	for _, line := range strings.Split(strings.TrimRight(script, "\n"), "\n") {
		fmt.Fprintf(b, "          %s\n", line)
	}
}

func appendGlobalVarWarnings(globalVars map[string]string, result *GitLabConvertResult) {
	if len(globalVars) == 0 {
		return
	}
	result.Warnings = append(result.Warnings, "")
	result.Warnings = append(result.Warnings, "Global variables found in .gitlab-ci.yml:")
	for k, v := range globalVars {
		if isLikelySecret(k) {
			result.EnvVarsNeeded = append(result.EnvVarsNeeded, EnvVarRef{
				Name: k, Source: "gitlab-ci-var", IsSecret: true,
				Suggestion: fmt.Sprintf("pushci secret set %s <value>", k),
			})
			result.Warnings = append(result.Warnings,
				fmt.Sprintf("  SECRET: %s → Run: pushci secret set %s <value>", k, k))
		} else {
			result.Warnings = append(result.Warnings,
				fmt.Sprintf("  %s = %s → Add to stage env: or set in shell", k, v))
		}
	}
}
