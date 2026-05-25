package migrate

import (
	"path/filepath"
	"strings"
)

// AntConvertResult mirrors the shape of the other migrators so
// callers can consume it without reshaping.
type AntConvertResult struct {
	PushCIYAML      string
	StagesConverted int
	StepsConverted  int
	Targets         []string
	Warnings        []string
	EnvVarsNeeded   []EnvVarRef
	// Deploys lists every deploy-adjacent target we detected
	// (deploy, deploy-prod, publish-nexus, …). The cmd layer
	// translates these into `config.DeployTarget` and attaches them
	// to the generated pipeline's `deploy:` block. Artifact-build
	// targets (jar/war/dist) are NOT included — they already land
	// in the build stage.
	Deploys []AntDeployTarget
}

// ConvertAnt converts an Ant build.xml into a PushCI pipeline. The
// generated YAML includes up to four stages: clean, compile, test,
// and a build-artifact stage (dist/jar/war/package). Unknown
// targets that don't match one of the standard names surface as
// warnings — users review and cherry-pick from the build.xml.
//
// buildFilePath is the repo-relative location of the build.xml and
// is used to set the stage `dir:` when the file lives under a
// subdirectory (common in monorepos).
func ConvertAnt(rawXML string, buildFilePath string) *AntConvertResult {
	r := &AntConvertResult{}
	targets := extractAntTargets(rawXML)
	if len(targets) == 0 {
		r.Warnings = append(r.Warnings,
			"build.xml had no <target> declarations — no stages generated")
		return r
	}
	r.Targets = targets
	def := extractAntDefault(rawXML)
	known := antKnownTargets(targets)

	dir := filepath.ToSlash(filepath.Dir(buildFilePath))
	if dir == "." || dir == "" {
		dir = ""
	}

	var b strings.Builder
	b.WriteString("\"on\":\n  - push\n  - pull_request\n\nstages:\n")
	writeAntStages(&b, known, def, dir, r)
	r.Deploys = classifyAntDeploys(targets)
	appendAntUnknownWarnings(targets, r)

	r.PushCIYAML = b.String()
	return r
}

// antKnownTargets returns a map of which standard Ant targets the
// file declares. Used by writeAntStages to skip stages the user
// hasn't defined instead of emitting dead `ant <missing>` commands.
func antKnownTargets(names []string) map[string]bool {
	set := map[string]bool{}
	for _, n := range names {
		set[n] = true
	}
	return set
}

// keysOf returns the keys of a bool map in arbitrary order.
// Small helper so migrators don't all import "sort" for one line.
func keysOf(m map[string]bool) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}
