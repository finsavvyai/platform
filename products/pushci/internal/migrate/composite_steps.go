package migrate

import (
	"fmt"
	"strings"
)

type compositeCheck struct {
	Run        string
	WorkingDir string
}

func convertCompositeSteps(steps []map[string]interface{}, result *CompositeConvertResult) []compositeCheck {
	var checks []compositeCheck
	seenInputs := map[string]bool{}
	for _, step := range steps {
		if c, ok := convertCompositeShellStep(step, result, seenInputs); ok {
			checks = append(checks, c)
			continue
		}
		if uses, ok := step["uses"].(string); ok {
			handleCompositeUses(uses, step, result)
			if mapped := mapAction(uses); mapped != "" {
				checks = append(checks, compositeCheck{Run: mapped})
				result.StepsKept++
			} else {
				result.StepsRemoved++
			}
		}
	}
	return checks
}

func convertCompositeShellStep(step map[string]interface{}, result *CompositeConvertResult, seen map[string]bool) (compositeCheck, bool) {
	run, ok := step["run"].(string)
	if !ok || run == "" {
		return compositeCheck{}, false
	}
	scanInputRefs(run, result, seen)
	if outputRefPattern.MatchString(run) {
		result.Warnings = append(result.Warnings,
			"Output setting via $GITHUB_OUTPUT — pushci stage outputs use 'outputs:' block, review manually")
	}
	cleaned := rewriteInputRefs(run)
	secretRefs := extractSecretRefs(run, result.Name)
	result.EnvVarsNeeded = append(result.EnvVarsNeeded, secretRefs...)
	cleaned = secretPattern.ReplaceAllStringFunc(cleaned, func(s string) string {
		m := secretPattern.FindStringSubmatch(s)
		if len(m) > 1 {
			return "$" + m[1]
		}
		return s
	})
	result.StepsKept++
	wd, _ := step["working-directory"].(string)
	return compositeCheck{Run: strings.TrimSpace(cleaned), WorkingDir: wd}, true
}

func handleCompositeUses(uses string, _ map[string]interface{}, result *CompositeConvertResult) {
	if mapAction(uses) != "" || isSkippedAction(uses) {
		return
	}
	result.Warnings = append(result.Warnings,
		fmt.Sprintf("Referenced action '%s' — keep as-is if migrating through act, else replace with pushci equivalent", uses))
}
