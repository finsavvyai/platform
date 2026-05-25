package integrate

import (
	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/detect"
)

// intAllClojureChecks aggregates intClojureChecks across every
// Clojure project in projects.
func intAllClojureChecks(projects []detect.Project) (build, test []config.Check) {
	for _, p := range projects {
		if p.Stack != detect.Clojure {
			continue
		}
		cb, ct := intClojureChecks(p)
		build = append(build, cb...)
		test = append(test, ct...)
	}
	return
}

// intClojureChecks returns tool-aware build/test checks for a single
// Clojure project. Runs against p.Dir directly (integrate tests
// setupRepo with deps.edn / project.clj / bb.edn at the root).
func intClojureChecks(p detect.Project) (build, test []config.Check) {
	dir := p.Dir
	switch p.BuildTool {
	case detect.ToolClojureCLI:
		if detect.DepsEdnHasAlias(dir, "test") {
			test = append(test, config.Check{Name: "clj-test", Run: "clojure -M:test"})
		} else {
			test = append(test, config.Check{Name: "clj-test", Run: "clojure -X:test"})
		}
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
