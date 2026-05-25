package migrate

import (
	"fmt"
	"strings"
)

// writeBuildkiteStage emits one pushci.yml stage for a buildkiteStep.
// Returns false when no runnable commands existed (wait/block/input/empty).
func writeBuildkiteStage(b *strings.Builder, step buildkiteStep, prevLabel string, _ map[string]string, result *BuildkiteConvertResult) bool {
	if step.Kind != "command" {
		result.Warnings = append(result.Warnings,
			fmt.Sprintf("Step '%s' (%s): no PushCI equivalent — replace with a manual gate", step.Label, step.Kind))
		result.StepsSkipped++
		return false
	}
	if len(step.Commands) == 0 {
		return false
	}

	fmt.Fprintf(b, "  - name: %s\n    checks:\n", step.Label)
	for i, cmd := range step.Commands {
		result.EnvVarsNeeded = append(result.EnvVarsNeeded, extractVarRefs(cmd, step.Label)...)
		fmt.Fprintf(b, "      - name: %s-%d\n        run: %s\n", step.Label, i+1, yamlScalar(cmd))
		result.StepsConverted++
	}

	deps := step.DependsOn
	if len(deps) == 0 && prevLabel != "" {
		deps = []string{prevLabel}
	}
	if len(deps) > 0 {
		b.WriteString("    depends_on:\n")
		for _, d := range deps {
			fmt.Fprintf(b, "      - %s\n", sanitizeName(d))
		}
	}
	if len(step.Env) > 0 {
		b.WriteString("    env:\n")
		for k, v := range step.Env {
			fmt.Fprintf(b, "      %s: \"%s\"\n", k, v)
		}
	}
	if step.Timeout > 0 {
		fmt.Fprintf(b, "    timeout_minutes: %d\n", step.Timeout)
	}
	result.StagesConverted++
	return true
}

// collectCommands normalizes `command: x` and `commands: [a, b]` into one slice.
func collectCommands(m map[string]interface{}) []string {
	var cmds []string
	if c, ok := m["command"]; ok {
		cmds = append(cmds, stringsFromCmd(c)...)
	}
	if c, ok := m["commands"]; ok {
		cmds = append(cmds, stringsFromCmd(c)...)
	}
	return cmds
}

func stringsFromCmd(v interface{}) []string {
	switch t := v.(type) {
	case string:
		if s := strings.TrimSpace(t); s != "" {
			return []string{s}
		}
	case []interface{}:
		var out []string
		for _, x := range t {
			if s := strings.TrimSpace(toStringBK(x)); s != "" {
				out = append(out, s)
			}
		}
		return out
	}
	return nil
}

func classifyStep(m map[string]interface{}) string {
	for _, k := range []string{"wait", "block", "input", "trigger"} {
		if _, ok := m[k]; ok {
			return k
		}
	}
	return "command"
}
