package main

import (
	"os"
	"path/filepath"

	"github.com/finsavvyai/pushci/internal/detect"
)

// clojureInstallCmdForProject returns the canonical deps-warm command
// for one Clojure project, keyed on the primary build tool that
// DetectClojure picked in internal/detect/clojure.go.
func clojureInstallCmdForProject(root string, p detect.Project) string {
	dir := filepath.Join(root, p.Dir)
	switch detect.DetectClojure(dir) {
	case detect.ToolClojureCLI:
		return "clojure -P"
	case detect.ToolLein:
		return "lein deps"
	case detect.ToolShadowCLJS:
		// shadow-cljs uses Node deps too; install them first.
		return "npm install"
	case detect.ToolBoot:
		return "boot show -d"
	case detect.ToolBabashka:
		return "bb --version"
	}
	return "lein deps"
}

// clojureInstallCmds returns deduplicated install commands for every
// Clojure project in projects. A hybrid deps.edn+bb.edn repo emits
// both `clojure -P` (primary) and `bb --version` (to warm bb).
func clojureInstallCmds(root string, projects []detect.Project) []string {
	seen := map[string]bool{}
	var out []string
	for _, p := range projects {
		if p.Stack != detect.Clojure {
			continue
		}
		cmd := clojureInstallCmdForProject(root, p)
		if cmd != "" && !seen[cmd] {
			seen[cmd] = true
			out = append(out, cmd)
		}
		if cmd == "clojure -P" {
			bb := filepath.Join(root, p.Dir, "bb.edn")
			if _, err := os.Stat(bb); err == nil && !seen["bb --version"] {
				seen["bb --version"] = true
				out = append(out, "bb --version")
			}
		}
	}
	return out
}

// fileExistsCLI is a local os.Stat shim.
func fileExistsCLI(dir, name string) bool {
	_, err := os.Stat(filepath.Join(dir, name))
	return err == nil
}
