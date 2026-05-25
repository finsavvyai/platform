package migrate

import (
	"fmt"
	"strings"
)

// CloudBuildConvertResult holds the migration output from a
// Google Cloud Build cloudbuild.yaml to PushCI format.
type CloudBuildConvertResult struct {
	PushCIYAML    string
	StepsKept     int
	StepsRemoved  int
	Warnings      []string
	EnvVarsNeeded []EnvVarRef
}

// ConvertCloudBuild converts a cloudbuild.yaml byte blob into PushCI
// yaml. It follows the migrate.ConvertCircleCI shape: returns a result
// struct (not the spec's Pipeline/Warning, which don't exist in this
// package) so the CLI can surface warnings and secret setup hints.
func ConvertCloudBuild(yamlBytes []byte) *CloudBuildConvertResult {
	result := &CloudBuildConvertResult{}
	cfg, err := parseCloudBuild(yamlBytes)
	if err != nil {
		result.Warnings = append(result.Warnings,
			"Failed to parse cloudbuild.yaml: "+err.Error())
		return result
	}

	stageNames := assignCloudBuildStageNames(cfg.Steps)
	cloudBuildWarnTopLevel(cfg, result)

	var b strings.Builder
	b.WriteString("\"on\":\n  - push\n  - pull_request\n\nstages:\n")

	for i, step := range cfg.Steps {
		name := stageNames[i]
		convertCloudBuildStep(step, name, stageNames, result, &b)
	}

	writeCloudBuildEnv(cfg, &b)
	result.PushCIYAML = b.String()
	return result
}

func cloudBuildWarnTopLevel(cfg *cloudBuildConfig, r *CloudBuildConvertResult) {
	if len(cfg.Secrets) > 0 {
		r.Warnings = append(r.Warnings,
			"cloudbuild.yaml declares 'secrets:' (KMS/Secret Manager) — re-register with `pushci secret set <NAME>`")
	}
	if len(cfg.Images) > 0 {
		r.Warnings = append(r.Warnings,
			"'images:' (push to GCR/Artifact Registry) is not auto-translated — add an explicit `docker push` step")
	}
	if cfg.Artifacts.Objects.Location != "" || len(cfg.Artifacts.Objects.Paths) > 0 {
		r.Warnings = append(r.Warnings,
			"'artifacts.objects' (GCS upload) — use `pushci artifacts push` in a stage")
	}
	if cfg.Timeout != "" {
		r.Warnings = append(r.Warnings,
			fmt.Sprintf("Top-level timeout '%s' is informational only — set per-stage timeouts in pushci.yml", cfg.Timeout))
	}
}

func assignCloudBuildStageNames(steps []cloudBuildStep) []string {
	names := make([]string, len(steps))
	used := map[string]int{}
	for i, s := range steps {
		raw := s.ID
		if raw == "" {
			raw = fmt.Sprintf("step-%d", i+1)
		}
		name := sanitizeName(raw)
		if used[name] > 0 {
			name = fmt.Sprintf("%s-%d", name, used[name])
		}
		used[raw]++
		names[i] = name
	}
	return names
}

func writeCloudBuildEnv(cfg *cloudBuildConfig, b *strings.Builder) {
	if len(cfg.Substitutions) == 0 {
		return
	}
	b.WriteString("\nenv:\n")
	for k, v := range cfg.Substitutions {
		fmt.Fprintf(b, "  %s: \"%s\"\n", k, v)
	}
}
