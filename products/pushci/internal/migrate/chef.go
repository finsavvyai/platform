package migrate

import (
	"os"
	"path/filepath"
)

// ChefConvertResult is the output of converting a Chef cookbook layout.
// Same shape family as BuildkiteConvertResult so callers can present
// warnings and secret references with one UI path.
type ChefConvertResult struct {
	PushCIYAML    string
	Cookbooks     []string
	HasKitchen    bool
	HasBerksfile  bool
	HasPolicyfile bool
	Warnings      []string
	EnvVarsNeeded []EnvVarRef
}

// ConvertChef walks a Chef cookbook repo layout and emits a pushci.yml
// covering the canonical cookbook pipeline: validate → lint → unit-test
// → deps → integration. Input is the repo root (directory containing
// cookbooks/, Berksfile, .kitchen.yml, etc.).
func ConvertChef(root string) *ChefConvertResult {
	result := &ChefConvertResult{}
	root = normalizeChefRoot(root)
	if root == "" {
		result.Warnings = append(result.Warnings, "Chef migrate: empty or invalid root")
		return result
	}

	layout := parseChefLayout(root, result)
	result.Cookbooks = layout.cookbookNames()
	result.HasKitchen = layout.kitchenYAML != ""
	result.HasBerksfile = layout.berksfile
	result.HasPolicyfile = layout.policyfile

	emitChefWarnings(layout, result)
	result.PushCIYAML = buildChefPushCIYAML(layout, result)
	return result
}

// normalizeChefRoot accepts either the repo root, a cookbooks/ dir,
// or a single cookbook's metadata.rb file and reduces it to the repo
// root so the rest of the pipeline sees a consistent layout.
func normalizeChefRoot(p string) string {
	if p == "" {
		return ""
	}
	info, err := os.Stat(p)
	if err != nil {
		return ""
	}
	abs, err := filepath.Abs(p)
	if err != nil {
		return ""
	}
	if !info.IsDir() {
		dir := filepath.Dir(abs)
		if filepath.Base(filepath.Dir(dir)) == "cookbooks" {
			return filepath.Dir(filepath.Dir(dir))
		}
		return dir
	}
	if filepath.Base(abs) == "cookbooks" {
		return filepath.Dir(abs)
	}
	return abs
}
