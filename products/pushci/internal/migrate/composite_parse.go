package migrate

import (
	"fmt"
	"regexp"
	"strings"
)

var (
	inputRefPattern  = regexp.MustCompile(`\$\{\{\s*inputs\.([A-Za-z_][A-Za-z0-9_-]*)\s*\}\}`)
	outputRefPattern = regexp.MustCompile(`\$GITHUB_OUTPUT`)
)

// compositeAction is the parsed shape of a GitHub composite action.yml.
type compositeAction struct {
	Name   string
	Desc   string
	Using  string
	Inputs map[string]string
	Steps  []map[string]interface{}
}

func parseCompositeAction(raw map[string]interface{}) compositeAction {
	action := compositeAction{Inputs: map[string]string{}}
	action.Name, _ = raw["name"].(string)
	action.Desc, _ = raw["description"].(string)
	if inputs, ok := raw["inputs"].(map[string]interface{}); ok {
		for k, v := range inputs {
			desc := ""
			if m, ok := v.(map[string]interface{}); ok {
				desc, _ = m["description"].(string)
			}
			action.Inputs[k] = desc
		}
	}
	runs, ok := raw["runs"].(map[string]interface{})
	if !ok {
		return action
	}
	action.Using, _ = runs["using"].(string)
	stepsRaw, _ := runs["steps"].([]interface{})
	for _, s := range stepsRaw {
		if sm, ok := s.(map[string]interface{}); ok {
			action.Steps = append(action.Steps, sm)
		}
	}
	return action
}

func compositeEnvVarName(input string) string {
	var b []byte
	for i := 0; i < len(input); i++ {
		c := input[i]
		switch {
		case c >= 'a' && c <= 'z':
			b = append(b, c-32)
		case c >= 'A' && c <= 'Z', c >= '0' && c <= '9':
			b = append(b, c)
		default:
			b = append(b, '_')
		}
	}
	return "PUSHCI_INPUT_" + string(b)
}

func isSkippedAction(uses string) bool {
	skip := []string{
		"actions/checkout", "actions/setup-node", "actions/setup-python",
		"actions/setup-go", "actions/setup-java", "actions/cache",
		"actions/upload-artifact", "actions/download-artifact",
	}
	for _, s := range skip {
		if strings.HasPrefix(uses, s) {
			return true
		}
	}
	return false
}

func scanInputRefs(script string, result *CompositeConvertResult, seen map[string]bool) {
	for _, m := range inputRefPattern.FindAllStringSubmatch(script, -1) {
		name := m[1]
		if seen[name] {
			continue
		}
		seen[name] = true
		result.Warnings = append(result.Warnings,
			fmt.Sprintf("Input ${{ inputs.%s }} referenced — set %s env before pushci run or hardcode", name, compositeEnvVarName(name)))
	}
}

func rewriteInputRefs(script string) string {
	return inputRefPattern.ReplaceAllStringFunc(script, func(s string) string {
		m := inputRefPattern.FindStringSubmatch(s)
		if len(m) < 2 {
			return s
		}
		return "$" + compositeEnvVarName(m[1])
	})
}
