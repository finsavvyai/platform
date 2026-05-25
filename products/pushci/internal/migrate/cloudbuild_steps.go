package migrate

import (
	"fmt"
	"strings"
)

// convertCloudBuildStep emits one pushci stage. `name + args` → `run:`;
// `entrypoint` (if set) is prepended. `waitFor: ['-']` means no deps.
func convertCloudBuildStep(step cloudBuildStep, stageName string,
	allNames []string, r *CloudBuildConvertResult, b *strings.Builder) {
	cmd := buildCloudBuildCommand(step)
	if cmd == "" {
		r.StepsRemoved++
		r.Warnings = append(r.Warnings, fmt.Sprintf("Stage '%s': empty step — skipped", stageName))
		return
	}
	r.StepsKept++
	r.EnvVarsNeeded = append(r.EnvVarsNeeded, extractVarRefs(cmd, stageName)...)
	cloudBuildWarnStep(step, stageName, r)

	fmt.Fprintf(b, "  - name: %s\n", stageName)
	fmt.Fprintf(b, "    # image: %s\n", step.Name)
	b.WriteString("    checks:\n")
	fmt.Fprintf(b, "      - name: %s\n        run: %s\n", stageName, cmd)

	if step.Dir != "" {
		fmt.Fprintf(b, "    working_dir: %s\n", step.Dir)
	}
	writeCloudBuildDeps(step.WaitFor, allNames, b)
	writeCloudBuildStepEnv(step.Env, b)
}

func buildCloudBuildCommand(step cloudBuildStep) string {
	parts := []string{}
	if step.Entrypoint != "" {
		parts = append(parts, step.Entrypoint)
	}
	for _, a := range step.Args {
		parts = append(parts, shellQuote(a))
	}
	return strings.TrimSpace(strings.Join(parts, " "))
}

func writeCloudBuildDeps(waitFor []string, allNames []string, b *strings.Builder) {
	if len(waitFor) == 0 {
		return
	}
	// waitFor: ['-'] means explicit "no dependencies, run in parallel".
	if len(waitFor) == 1 && waitFor[0] == "-" {
		return
	}
	b.WriteString("    depends_on:\n")
	for _, w := range waitFor {
		if w == "-" {
			continue
		}
		fmt.Fprintf(b, "      - %s\n", sanitizeName(w))
	}
}

func writeCloudBuildStepEnv(env []string, b *strings.Builder) {
	if len(env) == 0 {
		return
	}
	b.WriteString("    env:\n")
	for _, e := range env {
		parts := strings.SplitN(e, "=", 2)
		if len(parts) != 2 {
			continue
		}
		fmt.Fprintf(b, "      %s: \"%s\"\n", parts[0], parts[1])
	}
}

func cloudBuildWarnStep(step cloudBuildStep, name string, r *CloudBuildConvertResult) {
	w := &r.Warnings
	if len(step.SecretEnv) > 0 {
		*w = append(*w, fmt.Sprintf("Stage '%s' uses secretEnv %v — register each with `pushci secret set <NAME>`", name, step.SecretEnv))
	}
	if len(step.Volumes) > 0 {
		*w = append(*w, fmt.Sprintf("Stage '%s' mounts volumes — PushCI shares workspace filesystem, volumes ignored", name))
	}
	joined := step.Name + " " + strings.Join(step.Args, " ")
	if strings.Contains(joined, "$PROJECT_ID") {
		*w = append(*w, fmt.Sprintf("Stage '%s' references $PROJECT_ID (GCB runtime) — export PROJECT_ID before `pushci run`", name))
	}
}

func shellQuote(s string) string {
	if s == "" {
		return "''"
	}
	if !strings.ContainsAny(s, " \t\"'$&|;<>()`\\") {
		return s
	}
	return "'" + strings.ReplaceAll(s, "'", `'\''`) + "'"
}
