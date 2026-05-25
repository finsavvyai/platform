package detect

import (
	"os"
	"path/filepath"
	"strings"
)

// ScanChef inspects root for Chef cookbook structure and returns a
// single CIProvider entry when detected, nil otherwise.
//
// Detection precedence (strongest wins for ConfigFile):
//  1. cookbooks/<name>/metadata.rb (multi-cookbook, Telia layout)
//  2. Berksfile / Policyfile.rb / Policyfile.lock.json (strong)
//  3. metadata.rb at root alone (single-cookbook repo, medium)
//  4. Two medium signals (metadata.rb + .kitchen.yml / kitchen.yml)
//
// Weak-only signals (chefignore, roles/*.rb, environments/*.rb) never
// emit on their own — too many false positives in generic Ruby repos.
func ScanChef(root string) *CIProvider {
	if cookbooksDir(root) {
		return &CIProvider{Marker: "ci:chef", ConfigFile: "cookbooks"}
	}
	if p := firstExisting(root, []string{
		"Berksfile", "Policyfile.rb", "Policyfile.lock.json",
	}); p != "" {
		return &CIProvider{Marker: "ci:chef", ConfigFile: p}
	}
	med := existingAny(root, []string{"metadata.rb", ".kitchen.yml", "kitchen.yml"})
	hasMeta := len(med) > 0 && strings.EqualFold(med[0], "metadata.rb")
	if hasMeta || len(med) >= 2 {
		return &CIProvider{Marker: "ci:chef", ConfigFile: med[0]}
	}
	return nil
}

// HasChef reports whether root shows Chef cookbook structure.
func HasChef(root string) bool { return ScanChef(root) != nil }

// cookbooksDir reports whether root/cookbooks contains at least one
// subdir with a metadata.rb file — the multi-cookbook layout signal.
func cookbooksDir(root string) bool {
	dir := filepath.Join(root, "cookbooks")
	entries, err := os.ReadDir(dir)
	if err != nil {
		return false
	}
	for _, e := range entries {
		if !e.IsDir() || skipDirs[e.Name()] {
			continue
		}
		if fileExists(filepath.Join(dir, e.Name(), "metadata.rb")) {
			return true
		}
	}
	return false
}

// firstExisting returns the canonical name (from names) of the first
// root-level file matching case-insensitively. Empty when none match.
func firstExisting(root string, names []string) string {
	entries, err := os.ReadDir(root)
	if err != nil {
		return ""
	}
	lookup := map[string]string{}
	for _, n := range names {
		lookup[strings.ToLower(n)] = n
	}
	for _, e := range entries {
		if c, ok := lookup[strings.ToLower(e.Name())]; ok && !e.IsDir() {
			return c
		}
	}
	return ""
}

// existingAny returns every name in names that exists at root,
// preserving caller order and matching case-insensitively.
func existingAny(root string, names []string) []string {
	var out []string
	for _, n := range names {
		if firstExisting(root, []string{n}) != "" {
			out = append(out, n)
		}
	}
	return out
}
