package detect

import (
	"os"
	"path/filepath"
	"strings"
)

// CIProvider represents a detected CI/CD system already wired into the
// repo. Unlike DeployTarget (where/how to ship) and Stack (what to
// build), a CIProvider tells us what foreign pipeline format lives
// next to the source — so pushci init / migrate / actions can offer
// to translate or co-exist.
//
// Marker format: "ci:<provider>" (e.g. "ci:jenkins"). The prefix
// mirrors the SARIF / artifact conventions used elsewhere and keeps
// the namespace separate from Stack and deploy platform strings.
type CIProvider struct {
	Marker     string // e.g. "ci:jenkins"
	ConfigFile string // relative path, e.g. "Jenkinsfile" or "subdir/Jenkinsfile"
}

// jenkinsMaxDepth caps how far ScanJenkins walks. Jenkinsfiles live
// at repo root in the overwhelming majority of real-world repos; a
// small allowance covers monorepos that push per-service pipelines
// one level deep. The limit also prevents runaway walks in vendored
// copies that slip past skipDirs.
const jenkinsMaxDepth = 3

// ScanJenkins walks root and returns a CIProvider entry for every
// Jenkinsfile found (root or subdir). Returns nil when none exist.
//
// A Jenkinsfile has no enforced extension — it is matched by exact
// file name, case-sensitively, matching Jenkins' own convention.
func ScanJenkins(root string) []CIProvider {
	matches := findFiles(root, "Jenkinsfile", jenkinsMaxDepth)
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
		out = append(out, CIProvider{Marker: "ci:jenkins", ConfigFile: rel})
	}
	return out
}

// HasJenkins reports whether root contains at least one Jenkinsfile.
// Cheap shortcut for callers that only care about the boolean signal.
func HasJenkins(root string) bool {
	// Fast path: root-level Jenkinsfile is by far the common case.
	if _, err := os.Stat(filepath.Join(root, "Jenkinsfile")); err == nil {
		return true
	}
	return len(ScanJenkins(root)) > 0
}

// ciProviderKey returns the stable lookup key for a provider marker;
// exported helper so other detectors that emit ci:<name> entries can
// dedupe consistently without importing strings directly.
func ciProviderKey(p CIProvider) string {
	return strings.ToLower(p.Marker) + "|" + filepath.ToSlash(p.ConfigFile)
}
