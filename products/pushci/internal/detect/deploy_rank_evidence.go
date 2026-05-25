package detect

import (
	"os"
	"path/filepath"
	"strings"
)

// collectEvidence walks `root` (shallow) and inspects file contents
// to produce a weight map platform→score. Richer than a filename
// marker — reads YAML/HCL bodies so `buildspec.yml` with `aws ecr`
// scores higher than a blank one. See the weight table in the task
// spec; adding a new signal is one switch arm in addFileEvidence
// or one map entry in addTfResourceWeights (deploy_rank_tf.go).
func collectEvidence(root string) map[string]int {
	w := map[string]int{}
	addFileEvidence(root, w)
	addTerraformEvidence(root, w)
	return w
}

// addFileEvidence scans the repo root for single-file deploy
// signals: buildspec, serverless, app.yaml, wrangler.toml, etc.
// Weight contributions stack on the filename baseline from
// filenameWeight() so e.g. `buildspec.yml` with `aws ecr` in the
// body gets +5 (filename) +5 (body) +4 (ecr) = 14.
func addFileEvidence(root string, w map[string]int) {
	read := func(name string) string {
		b, err := os.ReadFile(filepath.Join(root, name))
		if err != nil {
			return ""
		}
		return string(b)
	}
	if s := read("buildspec.yml"); s != "" {
		w["aws-codebuild"] += 5
		if strings.Contains(s, "aws ecr") {
			w["aws-codebuild"] += 4
		}
	}
	if s := read("app.yaml"); s != "" {
		if strings.Contains(s, "runtime:") &&
			(strings.Contains(s, "env:") || strings.Contains(s, "service:")) {
			w["gcp-app-engine"] += 3
		}
	}
	if s := read("serverless.yml"); s != "" {
		if strings.Contains(s, "provider:") && strings.Contains(s, "name: aws") {
			w["aws-lambda"] += 5
		}
	}
	if s := read("wrangler.toml"); s != "" {
		if strings.Contains(s, "pages_build_output_dir") {
			w["cloudflare-pages"] += 5
		}
	}
	if s := read("vercel.json"); s != "" && strings.Contains(s, "build") {
		w["vercel"] += 4
	}
}
