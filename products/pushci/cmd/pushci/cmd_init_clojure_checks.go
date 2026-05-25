package main

import (
	"path/filepath"

	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/detect"
)

// allClojureChecks aggregates clojureChecks across every Clojure
// project in projects. Called from extCheckCommands.
func allClojureChecks(root string, projects []detect.Project) (build, test []config.Check) {
	for _, p := range projects {
		if p.Stack != detect.Clojure {
			continue
		}
		cb, ct := clojureChecks(root, p)
		build = append(build, cb...)
		test = append(test, ct...)
	}
	return
}

// clojureChecks returns build/test checks for one Clojure project,
// tool-aware. Lint intentionally empty — clj-kondo needs extra install
// steps and we refuse to emit stages we can't run in a clean CI image.
func clojureChecks(root string, p detect.Project) (build, test []config.Check) {
	dir := filepath.Join(root, p.Dir)
	switch detect.DetectClojure(dir) {
	case detect.ToolClojureCLI:
		build, test = cljDepsEdnChecks(dir)
	case detect.ToolLein:
		build = append(build, config.Check{Name: "lein-build", Run: "lein jar"})
		test = append(test, config.Check{Name: "lein-test", Run: "lein test"})
	case detect.ToolShadowCLJS:
		build = append(build, config.Check{Name: "shadow-build", Run: "shadow-cljs release app"})
		test = append(test, config.Check{Name: "shadow-test", Run: "shadow-cljs compile test && node out/test.js"})
	case detect.ToolBabashka:
		if detect.BbEdnHasTask(dir, "test") {
			test = append(test, config.Check{Name: "bb-test", Run: "bb test"})
		}
	case detect.ToolBoot:
		build = append(build, config.Check{Name: "boot-build", Run: "boot build"})
		test = append(test, config.Check{Name: "boot-test", Run: "boot test"})
	}
	return
}

// cljDepsEdnChecks returns the clj-CLI flavoured checks. The :test
// alias is preferred (`clojure -M:test`); otherwise fall back to
// `clojure -X:test` (exec via data). A :build alias + build.clj
// triggers the tools.build stage.
func cljDepsEdnChecks(dir string) (build, test []config.Check) {
	if detect.DepsEdnHasAlias(dir, "test") {
		test = append(test, config.Check{Name: "clj-test", Run: "clojure -M:test"})
	} else {
		test = append(test, config.Check{Name: "clj-test", Run: "clojure -X:test"})
	}
	if detect.DepsEdnHasAlias(dir, "build") && fileExistsCLI(dir, "build.clj") {
		build = append(build, config.Check{Name: "clj-build", Run: "clojure -T:build"})
	}
	return
}
