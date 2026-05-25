// Package detect — Clojure detection + strong-signal helpers.
//
// Telia NokiaPCRFTeliaGateway regression: a Clojure repo with a
// `deps.edn`, `bb.edn`, `build.clj`, `src/*.clj`, and a `Makefile`
// orchestrator was misclassified as C++ because the Makefile marker
// emitted Cpp first. The helpers here let Scan() pick Clojure when
// a strong signal is present and suppress the bogus Cpp emission.

package detect

import (
	"os"
	"path/filepath"
	"regexp"
)

// Strong Clojure signals. A bare `.clj` source file is NOT sufficient.
var clojureStrongFiles = []string{
	"deps.edn", "project.clj", "shadow-cljs.edn", "build.boot", "bb.edn",
}

// HasClojureSignal reports whether dir contains any strong Clojure
// build descriptor. Scan() uses it to suppress Cpp on Makefile-only
// collisions.
func HasClojureSignal(dir string) bool {
	for _, f := range clojureStrongFiles {
		if fileExists(filepath.Join(dir, f)) {
			return true
		}
	}
	return false
}

// DetectClojure picks the primary build tool for dir, in priority
// order: deps.edn > project.clj > shadow-cljs.edn > build.boot >
// bb.edn. Returns "" when no strong signal is present.
func DetectClojure(dir string) BuildTool {
	if fileExists(filepath.Join(dir, "deps.edn")) {
		return ToolClojureCLI
	}
	if fileExists(filepath.Join(dir, "project.clj")) {
		return ToolLein
	}
	if fileExists(filepath.Join(dir, "shadow-cljs.edn")) {
		return ToolShadowCLJS
	}
	if fileExists(filepath.Join(dir, "build.boot")) {
		return ToolBoot
	}
	if fileExists(filepath.Join(dir, "bb.edn")) {
		return ToolBabashka
	}
	return ""
}

// DepsEdnHasAlias reports whether deps.edn in dir defines an alias
// :<name> inside the :aliases map. Textual two-step scan — find the
// :aliases keyword, then check for :<name> anywhere after it. Nested
// {} inside aliases would trip up a single `[^}]*` match.
func DepsEdnHasAlias(dir, name string) bool {
	data, err := os.ReadFile(filepath.Join(dir, "deps.edn"))
	if err != nil {
		return false
	}
	idx := regexp.MustCompile(`:aliases\s*\{`).FindIndex(data)
	if idx == nil {
		return false
	}
	re := regexp.MustCompile(`:` + regexp.QuoteMeta(name) + `\b`)
	return re.Match(data[idx[1]:])
}

// BbEdnHasTask reports whether bb.edn in dir defines the named task
// inside :tasks {...}.
func BbEdnHasTask(dir, name string) bool {
	data, err := os.ReadFile(filepath.Join(dir, "bb.edn"))
	if err != nil {
		return false
	}
	re := regexp.MustCompile(`(?s):tasks\s*\{[^}]*\b` + regexp.QuoteMeta(name) + `\b`)
	return re.Match(data)
}

// init registers the remaining Clojure markers (project.clj lives in
// stack_ext.go from pre-v1.6.3). Duplicates are de-duped by Scan's
// `seen` map keyed on `<stack>:<rel>`.
func init() {
	markers = append(markers, []struct {
		file  string
		stack Stack
		tool  BuildTool
	}{
		{"deps.edn", Clojure, ToolClojureCLI},
		{"shadow-cljs.edn", Clojure, ToolShadowCLJS},
		{"build.boot", Clojure, ToolBoot},
		{"bb.edn", Clojure, ToolBabashka},
	}...)
}
