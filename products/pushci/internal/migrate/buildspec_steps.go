package migrate

import (
	"fmt"
	"strings"
)

// writeBuildspecStage renders one CodeBuild phase as a pushci stage.
// Returns false when the phase is empty (no commands and no finally).
func writeBuildspecStage(b *strings.Builder, name string, phase buildspecPhase, prev string, env map[string]string, result *BuildspecConvertResult) bool {
	if len(phase.Commands) == 0 && len(phase.Finally) == 0 {
		return false
	}
	stageName := sanitizeName(name)
	fmt.Fprintf(b, "  - name: %s\n    checks:\n", stageName)

	for i, cmd := range phase.Commands {
		result.EnvVarsNeeded = append(result.EnvVarsNeeded, extractVarRefs(cmd, stageName)...)
		fmt.Fprintf(b, "      - name: %s-%d\n        run: %s\n", stageName, i+1, yamlScalar(cmd))
		result.StepsConverted++
	}
	if len(phase.Finally) > 0 {
		result.Warnings = append(result.Warnings,
			fmt.Sprintf("phase '%s' has `finally:` block — pushci has no finally; appending commands as normal checks", name))
		for i, cmd := range phase.Finally {
			result.EnvVarsNeeded = append(result.EnvVarsNeeded, extractVarRefs(cmd, stageName)...)
			fmt.Fprintf(b, "      - name: %s-finally-%d\n        run: %s\n", stageName, i+1, yamlScalar(cmd))
			result.StepsConverted++
		}
	}

	writeBuildspecStageExtras(b, name, phase, prev, env, result)
	result.StagesConverted++
	return true
}

// writeBuildspecStageExtras emits depends_on, env, runtime-versions warnings,
// and on-failure handling. Split out of writeBuildspecStage to keep each
// function under the 100-line Go cap.
func writeBuildspecStageExtras(b *strings.Builder, name string, phase buildspecPhase, prev string, env map[string]string, result *BuildspecConvertResult) {
	if prev != "" {
		b.WriteString("    depends_on:\n")
		fmt.Fprintf(b, "      - %s\n", prev)
	}
	if len(env) > 0 {
		b.WriteString("    env:\n")
		for k, v := range env {
			fmt.Fprintf(b, "      %s: \"%s\"\n", k, v)
		}
	}
	if len(phase.RuntimeVersions) > 0 {
		var pairs []string
		for k, v := range phase.RuntimeVersions {
			pairs = append(pairs, fmt.Sprintf("%s %v", k, v))
		}
		result.Warnings = append(result.Warnings,
			fmt.Sprintf("phase '%s' runtime-versions [%s] — install runtimes locally via asdf/sdkman/nvm",
				name, strings.Join(pairs, " ")))
	}
	switch strings.ToUpper(phase.OnFailure) {
	case "CONTINUE":
		b.WriteString("    continue_on_error: true\n")
	case "ABORT", "":
		// default behavior — nothing to emit
	default:
		result.Warnings = append(result.Warnings,
			fmt.Sprintf("phase '%s' on-failure=%s — unknown value; treating as ABORT", name, phase.OnFailure))
	}
}
