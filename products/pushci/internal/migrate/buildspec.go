package migrate

import (
	"fmt"
	"strings"
)

// BuildspecConvertResult holds the migration output for an AWS CodeBuild buildspec.yml.
type BuildspecConvertResult struct {
	PushCIYAML      string
	StagesConverted int
	StepsConverted  int
	StepsSkipped    int
	Warnings        []string
	EnvVarsNeeded   []EnvVarRef
}

// phaseOrder is the canonical CodeBuild phase execution order.
// We emit stages in this order regardless of map-iteration order
// so every run produces deterministic output.
var phaseOrder = []string{"install", "pre_build", "build", "post_build"}

// ConvertBuildspec converts an AWS CodeBuild `buildspec.yml` to PushCI format.
// Follows the same shape as ConvertBuildkite / ConvertCircleCI.
func ConvertBuildspec(rawYAML string) *BuildspecConvertResult {
	result := &BuildspecConvertResult{}
	spec, err := parseBuildspec(rawYAML)
	if err != nil {
		result.Warnings = append(result.Warnings, "Failed to parse buildspec.yml: "+err.Error())
		return result
	}

	globalEnv, envWarnings, envRefs := resolveBuildspecEnv(spec.Env)
	result.Warnings = append(result.Warnings, envWarnings...)
	result.EnvVarsNeeded = append(result.EnvVarsNeeded, envRefs...)

	var b strings.Builder
	b.WriteString("\"on\":\n  - push\n  - pull_request\n\nstages:\n")

	prev := ""
	for _, name := range phaseOrder {
		phase, ok := spec.Phases[name]
		if !ok {
			continue
		}
		if writeBuildspecStage(&b, name, phase, prev, globalEnv, result) {
			prev = sanitizeName(name)
		}
	}

	appendBuildspecArtifactWarnings(spec, result)
	result.PushCIYAML = b.String()
	return result
}

// appendBuildspecArtifactWarnings surfaces buildspec features that have no
// direct pushci equivalent so the operator can take manual follow-up.
func appendBuildspecArtifactWarnings(spec *buildspecFile, result *BuildspecConvertResult) {
	for _, f := range spec.Artifacts.Files {
		result.Warnings = append(result.Warnings,
			fmt.Sprintf("artifact file '%s' → pushci artifact save %s (add to post_build stage)", f, f))
	}
	if spec.Artifacts.BaseDirectory != "" {
		result.Warnings = append(result.Warnings,
			fmt.Sprintf("artifacts.base-directory=%s — set `working_dir:` on the post_build stage", spec.Artifacts.BaseDirectory))
	}
	if spec.Artifacts.DiscardPaths {
		result.Warnings = append(result.Warnings,
			"artifacts.discard-paths=yes — pushci preserves tree structure; flatten manually if needed")
	}
	for _, p := range spec.Cache.Paths {
		result.Warnings = append(result.Warnings,
			fmt.Sprintf("cache path '%s' — pushci cache is separate; configure via `pushci cache` command", p))
	}
	for name := range spec.Reports {
		result.Warnings = append(result.Warnings,
			fmt.Sprintf("report group '%s' — pushci has no test-report upload; publish artifacts manually", name))
	}
	if spec.RunAs != "" {
		result.Warnings = append(result.Warnings,
			fmt.Sprintf("run-as: %s — pushci runs as the invoking user; adjust your local setup", spec.RunAs))
	}
}
