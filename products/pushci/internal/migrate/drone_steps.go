package migrate

import (
	"fmt"
	"sort"
	"strings"
)

// convertDroneStep renders one drone step as a PushCI stage.
func convertDroneStep(s droneStep, prefix string, p dronePipeline, b *strings.Builder, r *DroneConvertResult) {
	if s.Detach {
		r.Warnings = append(r.Warnings, fmt.Sprintf(
			"Step '%s': detach: true — not supported, run long-lived services outside the pipeline",
			s.Name))
		r.StepsRemoved++
		return
	}
	if len(s.Settings) > 0 && len(s.Commands) == 0 {
		r.Warnings = append(r.Warnings, fmt.Sprintf(
			"Step '%s': plugin settings (image=%s) — PushCI has no plugin registry, "+
				"translate to a shell command or a custom stage",
			s.Name, s.Image))
		r.StepsRemoved++
		return
	}

	stageName := prefix + sanitizeName(s.Name)
	if stageName == "" {
		stageName = prefix + "step"
	}
	cmd := joinDroneCommands(s.Commands)
	if cmd == "" {
		r.StepsRemoved++
		return
	}

	r.EnvVarsNeeded = append(r.EnvVarsNeeded, extractVarRefs(cmd, stageName)...)

	fmt.Fprintf(b, "  - name: %s\n", stageName)
	if s.Image != "" && s.Image != "alpine" && s.Image != "busybox" {
		fmt.Fprintf(b, "    # drone image: %s (runs locally in PushCI)\n", s.Image)
		r.Warnings = append(r.Warnings, fmt.Sprintf(
			"Step '%s': drone image '%s' — PushCI runs locally, install deps on host or switch to actions runtime",
			stageName, s.Image))
	}
	b.WriteString("    checks:\n")
	fmt.Fprintf(b, "      - name: %s\n        run: %s\n", stageName, cmd)
	r.StepsKept++

	writeDroneStepMeta(s, prefix, b, r, stageName)
}

func writeDroneStepMeta(s droneStep, prefix string, b *strings.Builder, r *DroneConvertResult, stageName string) {
	deps := append([]string(nil), s.DependsOn...)
	if len(deps) > 0 {
		b.WriteString("    depends_on:\n")
		for _, d := range deps {
			fmt.Fprintf(b, "      - %s%s\n", prefix, sanitizeName(d))
		}
	}
	if len(s.Environment) > 0 {
		b.WriteString("    env:\n")
		keys := make([]string, 0, len(s.Environment))
		for k := range s.Environment {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			fmt.Fprintf(b, "      %s: %q\n", k, s.Environment[k])
		}
	}
	if len(s.When) > 0 {
		r.Warnings = append(r.Warnings, fmt.Sprintf(
			"Step '%s': 'when:' condition dropped (%v) — review and reapply via pushci only_on/skip_if",
			stageName, s.When))
	}
	if s.Failure == "ignore" {
		b.WriteString("    continue_on_error: true\n")
	}
}

func joinDroneCommands(cmds []string) string {
	out := make([]string, 0, len(cmds))
	for _, c := range cmds {
		c = strings.TrimSpace(c)
		if c != "" {
			out = append(out, c)
		}
	}
	return strings.Join(out, " && ")
}
