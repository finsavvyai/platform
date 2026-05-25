package migrate

import (
	"fmt"
	"strings"

	"gopkg.in/yaml.v3"
)

// CompositeConvertResult holds the result of converting a composite action.
type CompositeConvertResult struct {
	Name          string
	PushCIYAML    string
	StepsKept     int
	StepsRemoved  int
	Warnings      []string
	InputsSeen    []string
	EnvVarsNeeded []EnvVarRef
}

// ConvertComposite converts a GitHub composite action's action.yml into
// a pushci-stage YAML snippet. Supports `runs.using: composite` only —
// docker/node backed actions emit a warning and an empty YAML.
func ConvertComposite(yamlBytes []byte) *CompositeConvertResult {
	result := &CompositeConvertResult{}

	var raw map[string]interface{}
	if err := yaml.Unmarshal(yamlBytes, &raw); err != nil {
		result.Warnings = append(result.Warnings, "Failed to parse action.yml: "+err.Error())
		return result
	}

	action := parseCompositeAction(raw)
	result.Name = action.Name

	if !strings.EqualFold(action.Using, "composite") {
		result.Warnings = append(result.Warnings,
			fmt.Sprintf("runs.using: %s — not convertible; composite must be shell/JS", action.Using))
		return result
	}

	for name := range action.Inputs {
		result.InputsSeen = append(result.InputsSeen, name)
	}

	checks := convertCompositeSteps(action.Steps, result)
	result.PushCIYAML = buildCompositeYAML(action.Name, checks)
	return result
}

func buildCompositeYAML(name string, checks []compositeCheck) string {
	if len(checks) == 0 {
		return ""
	}
	stageName := sanitizeName(name)
	if stageName == "" {
		stageName = "composite"
	}
	var b strings.Builder
	b.WriteString("stages:\n")
	fmt.Fprintf(&b, "  - name: %s\n    checks:\n", stageName)
	for i, c := range checks {
		fmt.Fprintf(&b, "      - name: %s-%d\n        run: %s\n", stageName, i+1, c.Run)
		if c.WorkingDir != "" {
			fmt.Fprintf(&b, "        working_directory: %s\n", c.WorkingDir)
		}
	}
	return b.String()
}
