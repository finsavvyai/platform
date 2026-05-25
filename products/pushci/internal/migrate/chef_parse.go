package migrate

import (
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// chefCookbook is one cookbook under cookbooks/. Only the shape
// needed by the stage builder is tracked.
type chefCookbook struct {
	Name    string
	HasSpec bool
}

// chefLayout captures the repo-level facts the stage builder needs.
type chefLayout struct {
	root            string
	cookbooks       []chefCookbook
	kitchenYAML     string
	berksfile       bool
	policyfile      bool
	foodcritic      bool
	knifeRef        bool
	validateScripts []string
}

func (l chefLayout) cookbookNames() []string {
	out := make([]string, 0, len(l.cookbooks))
	for _, c := range l.cookbooks {
		out = append(out, c.Name)
	}
	return out
}

// parseChefLayout enumerates cookbooks, detects kitchen/berks/policy
// files, and finds validate-*.sh/py helpers at the repo root. All
// I/O happens here so the emitter is deterministic from the layout.
func parseChefLayout(root string, _ *ChefConvertResult) chefLayout {
	l := chefLayout{root: root}
	l.cookbooks = scanChefCookbooks(root)
	l.kitchenYAML = findChefKitchen(root)
	l.berksfile = fileExists(filepath.Join(root, "Berksfile"))
	l.policyfile = fileExists(filepath.Join(root, "Policyfile.rb"))
	l.foodcritic = fileExists(filepath.Join(root, ".foodcritic"))
	l.validateScripts = scanValidateScripts(root)
	l.knifeRef = scanForKnife(root, l.validateScripts)
	return l
}

func scanChefCookbooks(root string) []chefCookbook {
	dir := filepath.Join(root, "cookbooks")
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}
	var out []chefCookbook
	for _, e := range entries {
		if !e.IsDir() || strings.HasPrefix(e.Name(), ".") {
			continue
		}
		if !fileExists(filepath.Join(dir, e.Name(), "metadata.rb")) {
			continue
		}
		out = append(out, chefCookbook{
			Name:    e.Name(),
			HasSpec: dirHasRubyFiles(filepath.Join(dir, e.Name(), "spec")),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func findChefKitchen(root string) string {
	for _, name := range []string{".kitchen.yml", "kitchen.yml", ".kitchen.yaml"} {
		p := filepath.Join(root, name)
		if fileExists(p) {
			return p
		}
	}
	return ""
}
