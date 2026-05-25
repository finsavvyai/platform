package detect

import (
	"os"
	"path/filepath"
	"testing"
)

func writeClj(t *testing.T, dir, name, body string) {
	t.Helper()
	full := filepath.Join(dir, name)
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(full, []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestDetectClojure(t *testing.T) {
	cases := []struct {
		name  string
		files []string
		want  BuildTool
	}{
		{"deps.edn", []string{"deps.edn"}, ToolClojureCLI},
		{"project.clj", []string{"project.clj"}, ToolLein},
		{"shadow", []string{"shadow-cljs.edn"}, ToolShadowCLJS},
		{"boot", []string{"build.boot"}, ToolBoot},
		{"bb-only", []string{"bb.edn"}, ToolBabashka},
		{"deps+project → deps wins", []string{"deps.edn", "project.clj"}, ToolClojureCLI},
		{"deps+bb → deps wins", []string{"deps.edn", "bb.edn"}, ToolClojureCLI},
		{"none", []string{}, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			dir := t.TempDir()
			for _, f := range tc.files {
				writeClj(t, dir, f, "{}")
			}
			if got := DetectClojure(dir); got != tc.want {
				t.Errorf("DetectClojure() = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestHasClojureSignal(t *testing.T) {
	dir := t.TempDir()
	if HasClojureSignal(dir) {
		t.Fatal("empty dir reports signal")
	}
	writeClj(t, dir, "deps.edn", "{}")
	if !HasClojureSignal(dir) {
		t.Fatal("deps.edn should register")
	}
}

func TestScanClojureBeatsCpp(t *testing.T) {
	// Nokia dogfood: deps.edn + bb.edn + Makefile + build.clj must
	// classify as Clojure (not Cpp) even though Makefile exists.
	dir := t.TempDir()
	writeClj(t, dir, "deps.edn", `{:aliases {:test {} :build {}}}`)
	writeClj(t, dir, "bb.edn", `{:tasks {test {}}}`)
	writeClj(t, dir, "build.clj", `(ns build)`)
	writeClj(t, dir, "Makefile", "test:\n\tclojure -M:test\n")
	writeClj(t, dir, "src/core.clj", `(ns core)`)
	projects := Scan(dir)
	foundClj, foundCpp := false, false
	for _, p := range projects {
		if p.Stack == Clojure {
			foundClj = true
			if p.BuildTool != ToolClojureCLI {
				t.Errorf("expected ToolClojureCLI, got %q", p.BuildTool)
			}
		}
		if p.Stack == Cpp {
			foundCpp = true
		}
	}
	if !foundClj {
		t.Fatalf("expected Clojure project; got %+v", projects)
	}
	if foundCpp {
		t.Fatalf("Cpp should be suppressed when Clojure signal present")
	}
}

func TestScanRealCppStillWorks(t *testing.T) {
	// A Makefile without any Clojure signal must still emit Cpp.
	dir := t.TempDir()
	writeClj(t, dir, "Makefile", "all:\n\tgcc main.c\n")
	writeClj(t, dir, "main.c", "int main(){return 0;}")
	projects := Scan(dir)
	found := false
	for _, p := range projects {
		if p.Stack == Cpp {
			found = true
		}
	}
	if !found {
		t.Fatalf("Cpp detection must survive for real C/C++ repos; got %+v", projects)
	}
}

func TestDepsEdnAliases(t *testing.T) {
	dir := t.TempDir()
	writeClj(t, dir, "deps.edn", `{:paths ["src"]
 :aliases {:test {:extra-deps {}}
           :build {:ns-default build}}}`)
	if !DepsEdnHasAlias(dir, "test") {
		t.Error("expected :test alias")
	}
	if !DepsEdnHasAlias(dir, "build") {
		t.Error("expected :build alias")
	}
	if DepsEdnHasAlias(dir, "nope") {
		t.Error("unexpected :nope alias")
	}
}

func TestBbEdnTasks(t *testing.T) {
	dir := t.TempDir()
	writeClj(t, dir, "bb.edn", `{:tasks {test {:task (println :ok)}
                                         run  {}}}`)
	if !BbEdnHasTask(dir, "test") {
		t.Error("expected test task")
	}
	if BbEdnHasTask(dir, "nope") {
		t.Error("unexpected task")
	}
}
