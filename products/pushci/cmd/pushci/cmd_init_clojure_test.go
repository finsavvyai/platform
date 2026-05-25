package main

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/finsavvyai/pushci/internal/detect"
)

func writeCljFile(t *testing.T, dir, name, body string) {
	t.Helper()
	full := filepath.Join(dir, name)
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(full, []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestClojureInstallCmd_DepsEdn(t *testing.T) {
	dir := t.TempDir()
	writeCljFile(t, dir, "deps.edn", `{:aliases {:test {}}}`)
	p := detect.Project{Stack: detect.Clojure, BuildTool: detect.ToolClojureCLI, Dir: "."}
	if got := clojureInstallCmdForProject(dir, p); got != "clojure -P" {
		t.Errorf("install cmd = %q, want 'clojure -P'", got)
	}
}

func TestClojureInstallCmd_Hybrid(t *testing.T) {
	// deps.edn + bb.edn → both install commands should be emitted.
	dir := t.TempDir()
	writeCljFile(t, dir, "deps.edn", "{}")
	writeCljFile(t, dir, "bb.edn", "{:tasks {}}")
	projects := []detect.Project{
		{Stack: detect.Clojure, BuildTool: detect.ToolClojureCLI, Dir: "."},
	}
	cmds := clojureInstallCmds(dir, projects)
	if len(cmds) != 2 || cmds[0] != "clojure -P" || cmds[1] != "bb --version" {
		t.Errorf("cmds = %v, want [clojure -P, bb --version]", cmds)
	}
}

func TestClojureChecks_DepsEdnWithTestAlias(t *testing.T) {
	dir := t.TempDir()
	writeCljFile(t, dir, "deps.edn", `{:aliases {:test {:extra-deps {}}
                                                  :build {:deps {}}}}`)
	writeCljFile(t, dir, "build.clj", `(ns build)`)
	p := detect.Project{Stack: detect.Clojure, BuildTool: detect.ToolClojureCLI, Dir: "."}
	build, test := clojureChecks(dir, p)
	if len(test) != 1 || test[0].Run != "clojure -M:test" {
		t.Errorf("test checks = %+v, want clojure -M:test", test)
	}
	if len(build) != 1 || build[0].Run != "clojure -T:build" {
		t.Errorf("build checks = %+v, want clojure -T:build", build)
	}
}

func TestClojureChecks_DepsEdnNoAlias(t *testing.T) {
	dir := t.TempDir()
	writeCljFile(t, dir, "deps.edn", "{}")
	p := detect.Project{Stack: detect.Clojure, BuildTool: detect.ToolClojureCLI, Dir: "."}
	_, test := clojureChecks(dir, p)
	if len(test) != 1 || test[0].Run != "clojure -X:test" {
		t.Errorf("test = %+v, want clojure -X:test fallback", test)
	}
}

func TestClojureChecks_Lein(t *testing.T) {
	dir := t.TempDir()
	writeCljFile(t, dir, "project.clj", `(defproject x "0.1.0")`)
	p := detect.Project{Stack: detect.Clojure, BuildTool: detect.ToolLein, Dir: "."}
	build, test := clojureChecks(dir, p)
	if len(build) != 1 || build[0].Run != "lein jar" {
		t.Errorf("build = %+v, want lein jar", build)
	}
	if len(test) != 1 || test[0].Run != "lein test" {
		t.Errorf("test = %+v, want lein test", test)
	}
}

func TestClojureChecks_Babashka(t *testing.T) {
	dir := t.TempDir()
	writeCljFile(t, dir, "bb.edn", `{:tasks {test {:doc "runs tests"}}}`)
	p := detect.Project{Stack: detect.Clojure, BuildTool: detect.ToolBabashka, Dir: "."}
	_, test := clojureChecks(dir, p)
	if len(test) != 1 || test[0].Run != "bb test" {
		t.Errorf("test = %+v, want bb test", test)
	}
}

func TestGenerateClojureFixture(t *testing.T) {
	// End-to-end: Clojure fixture produces a pipeline with clojure -M:test
	// and no C++ misclassification.
	dir := t.TempDir()
	writeCljFile(t, dir, "deps.edn", `{:aliases {:test {:extra-deps {}}}}`)
	writeCljFile(t, dir, "Makefile", "test:\n\tclojure -M:test\n")
	writeCljFile(t, dir, "src/core.clj", `(ns core)`)
	projects := detect.Scan(dir)
	var clj *detect.Project
	for i, p := range projects {
		if p.Stack == detect.Cpp {
			t.Fatalf("Cpp leaked in: %+v", projects)
		}
		if p.Stack == detect.Clojure {
			clj = &projects[i]
		}
	}
	if clj == nil {
		t.Fatalf("Clojure not detected: %+v", projects)
	}
	if clj.BuildTool != detect.ToolClojureCLI {
		t.Errorf("build tool = %q, want %q", clj.BuildTool, detect.ToolClojureCLI)
	}
}
