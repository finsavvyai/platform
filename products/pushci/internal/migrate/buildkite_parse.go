package migrate

import (
	"fmt"
)

// buildkiteStep is the flattened shape we care about after walking
// groups and normalizing `command` vs `commands`.
type buildkiteStep struct {
	Label     string
	Key       string
	Commands  []string
	Env       map[string]string
	DependsOn []string
	Timeout   int
	Kind      string // "command", "wait", "block", "input", "trigger"
	RawPlugin []string
}

// flattenBuildkiteSteps walks the top-level (or group) steps array and
// returns a flat slice of buildkiteStep. Groups become a prefix
// applied to each nested step's label.
func flattenBuildkiteSteps(v interface{}, prefix string, result *BuildkiteConvertResult) []buildkiteStep {
	arr, ok := v.([]interface{})
	if !ok {
		return nil
	}
	var out []buildkiteStep
	for i, raw := range arr {
		out = append(out, parseBuildkiteStep(raw, prefix, i, result)...)
	}
	return out
}

func parseBuildkiteStep(raw interface{}, prefix string, idx int, result *BuildkiteConvertResult) []buildkiteStep {
	// Literal "wait" / "block" shorthand appears as a bare string.
	if s, ok := raw.(string); ok {
		result.Warnings = append(result.Warnings,
			fmt.Sprintf("Skipped '%s' step — no PushCI equivalent; add a manual gate if needed", s))
		result.StepsSkipped++
		return nil
	}
	m, ok := raw.(map[string]interface{})
	if !ok {
		return nil
	}
	if grp, isGroup := m["group"]; isGroup {
		gp := toStringBK(grp)
		if gp == "" {
			gp = fmt.Sprintf("group-%d", idx+1)
		}
		next := gp
		if prefix != "" {
			next = prefix + "-" + gp
		}
		return flattenBuildkiteSteps(m["steps"], sanitizeName(next), result)
	}
	return []buildkiteStep{normalizeStep(m, prefix, idx, result)}
}

func normalizeStep(m map[string]interface{}, prefix string, idx int, result *BuildkiteConvertResult) buildkiteStep {
	step := buildkiteStep{
		Label:     buildkiteLabel(m, prefix, idx),
		Key:       toStringBK(m["key"]),
		Env:       parseBuildkiteEnv(m["env"]),
		DependsOn: toStringList(m["depends_on"]),
		Timeout:   intOrZero(m["timeout_in_minutes"]),
		Kind:      classifyStep(m),
	}
	step.Commands = collectCommands(m)
	if plugins, ok := m["plugins"]; ok {
		for _, p := range pluginNames(plugins) {
			step.RawPlugin = append(step.RawPlugin, p)
			result.Warnings = append(result.Warnings,
				fmt.Sprintf("Step '%s': plugin '%s' unsupported — add equivalent step manually", step.Label, p))
		}
	}
	if par := intOrZero(m["parallelism"]); par > 1 {
		result.Warnings = append(result.Warnings,
			fmt.Sprintf("Step '%s': parallelism=%d — PushCI has no native parallelism; runs sequentially", step.Label, par))
	}
	return step
}

func buildkiteLabel(m map[string]interface{}, prefix string, idx int) string {
	if k := toStringBK(m["key"]); k != "" {
		return withPrefix(prefix, sanitizeName(k))
	}
	if l := toStringBK(m["label"]); l != "" {
		return withPrefix(prefix, sanitizeName(l))
	}
	return withPrefix(prefix, fmt.Sprintf("step-%d", idx+1))
}

func withPrefix(prefix, name string) string {
	if prefix == "" {
		return name
	}
	return prefix + "-" + name
}
