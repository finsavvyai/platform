package detect

import (
	"os"
	"path/filepath"
	"sort"
)

// shellOnlyBuildFiles lists every recognized build-tool descriptor
// that, when present at root, disqualifies a repo from the
// shell-only classification. Kept inline (not imported from stack
// detection) so this detector stays self-contained and cheap to run.
var shellOnlyBuildFiles = []string{
	"pom.xml", "build.gradle", "build.gradle.kts", "build.xml",
	"package.json", "go.mod", "Cargo.toml", "pyproject.toml",
	"setup.py", "requirements.txt", "Gemfile", "composer.json",
	"Makefile", "CMakeLists.txt", "mix.exs", "build.sbt",
	"deno.json", "bun.lockb", "Dockerfile",
	"deps.edn", "project.clj", "bb.edn", "shadow-cljs.edn", "build.boot",
}

// ScanShellOnly detects "shell-only" repos — directories with `*.sh`
// scripts at top level, no recognized build tool, and not a legacy
// WAR project. Returns a CIProvider with marker `project:shell-scripts`
// that includes the list of top-level `.sh` files in ConfigFile,
// comma-joined, so the init helper can emit per-script lint stages.
//
// This MUST run last in the provider chain — it intentionally fires
// only when every other detector has been silent (telia v1.6.1
// NinjaDKInstall: install.sh + weblogic configs + hibernate templates,
// no pom.xml, no build.gradle, no package.json).
func ScanShellOnly(root string) *CIProvider {
	for _, name := range shellOnlyBuildFiles {
		if _, err := os.Stat(filepath.Join(root, name)); err == nil {
			return nil
		}
	}
	if HasLegacyWAR(root) {
		return nil
	}
	scripts := topLevelShellScripts(root)
	if len(scripts) == 0 {
		return nil
	}
	sort.Strings(scripts)
	return &CIProvider{
		Marker:     "project:shell-scripts",
		ConfigFile: joinCSV(scripts),
	}
}

// HasShellOnly reports whether root is a shell-only project.
func HasShellOnly(root string) bool { return ScanShellOnly(root) != nil }

// topLevelShellScripts returns the names of `*.sh` files at the root
// of dir, skipping subdirectories — subdir scripts are often sample
// payloads or test fixtures and should not drive pipeline generation.
func topLevelShellScripts(root string) []string {
	entries, err := os.ReadDir(root)
	if err != nil {
		return nil
	}
	var out []string
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		if filepath.Ext(e.Name()) == ".sh" {
			out = append(out, e.Name())
		}
	}
	return out
}

// joinCSV returns names concatenated with ",". Inlined to avoid
// pulling strings into this file's import set for one call.
func joinCSV(names []string) string {
	out := ""
	for i, n := range names {
		if i > 0 {
			out += ","
		}
		out += n
	}
	return out
}
