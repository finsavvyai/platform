package detect

import (
	"os"
	"path/filepath"
)

// antMaxDepth caps how far ScanAnt walks. Ant build files live at
// repo root in the overwhelming majority of Java projects; a small
// allowance covers monorepos that keep per-module build.xml files
// one or two levels deep.
const antMaxDepth = 3

// ScanAnt walks root and returns a CIProvider entry for every
// `build.xml` found (root or subdir). Returns nil when none exist.
//
// Ant is detected at provider-layer (not Stack-layer) so that
// `pushci init` can offer to migrate the Ant targets even when a
// pom.xml or build.gradle is also present — legacy Java repos often
// ship multiple build descriptors and Ant is the one that actually
// runs (telia v1.6.1 NinjaDKUtil).
func ScanAnt(root string) []CIProvider {
	matches := findFiles(root, "build.xml", antMaxDepth)
	if len(matches) == 0 {
		return nil
	}
	out := make([]CIProvider, 0, len(matches))
	seen := map[string]bool{}
	for _, m := range matches {
		rel, err := filepath.Rel(root, m)
		if err != nil {
			continue
		}
		rel = filepath.ToSlash(rel)
		if seen[rel] {
			continue
		}
		seen[rel] = true
		out = append(out, CIProvider{Marker: "ci:ant", ConfigFile: rel})
	}
	return out
}

// HasAnt reports whether root contains at least one Ant build.xml.
// Cheap shortcut for callers that only care about the boolean signal.
func HasAnt(root string) bool {
	if _, err := os.Stat(filepath.Join(root, "build.xml")); err == nil {
		return true
	}
	return len(ScanAnt(root)) > 0
}
