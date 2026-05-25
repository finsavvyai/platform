package migrate

import (
	"regexp"
	"strings"
)

// parseShCommands extracts every `sh '...'`, `sh "..."`, and
// `sh """..."""` command from a stage body. Triple-quoted multi-line
// scripts are split line-by-line so each maps to a separate PushCI
// check (skipping blank lines and shell comments).
func parseShCommands(stepsBlock, stageName string, result *JenkinsConvertResult) []string {
	var steps []string
	shPattern := regexp.MustCompile(`sh\s+['"]([^'"]+)['"]`)
	for _, m := range shPattern.FindAllStringSubmatch(stepsBlock, -1) {
		result.EnvVarsNeeded = append(result.EnvVarsNeeded, extractVarRefs(m[1], stageName)...)
		steps = append(steps, m[1])
		result.StepsKept++
	}
	shMulti := regexp.MustCompile(`sh\s+"""([\s\S]*?)"""`)
	for _, m := range shMulti.FindAllStringSubmatch(stepsBlock, -1) {
		for _, line := range strings.Split(strings.TrimSpace(m[1]), "\n") {
			line = strings.TrimSpace(line)
			if line != "" && !strings.HasPrefix(line, "#") {
				steps = append(steps, line)
				result.StepsKept++
			}
		}
	}
	return steps
}

// parseWhenBlock extracts branch filters from a stage's `when { ... }`
// block. Preferred form is `branch 'main'`; falls back to substring
// matching for legacy `expression { env.BRANCH_NAME == 'main' }` forms
// so those users still get something useful in only_on:.
func parseWhenBlock(stageBody string) []string {
	whenBlock := extractBlock(stageBody, "when")
	if whenBlock == "" {
		return nil
	}
	pat := regexp.MustCompile(`branch\s+['"]([^'"]+)['"]`)
	matches := pat.FindAllStringSubmatch(whenBlock, -1)
	if len(matches) > 0 {
		out := make([]string, 0, len(matches))
		for _, m := range matches {
			out = append(out, m[1])
		}
		return out
	}
	var onlyOn []string
	for _, b := range []string{"main", "master", "develop"} {
		if strings.Contains(whenBlock, b) {
			onlyOn = append(onlyOn, b)
		}
	}
	return onlyOn
}
