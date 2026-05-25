package main

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/detect"
)

func TestBuildCheckCommandsNodeWithScripts(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "package.json"),
		[]byte(`{"scripts":{"build":"vite build","test":"jest","lint":"eslint ."}}`), 0o644)
	stacks := map[detect.Stack]bool{detect.Node: true}
	projects := []detect.Project{{Stack: detect.Node, Dir: "."}}
	build, test, lint := buildCheckCommands(dir, stacks, projects)
	assertCheck(t, "build", build, "npm run build")
	assertCheck(t, "test", test, "npm test")
	assertCheck(t, "lint", lint, "npm run lint")
}

func TestBuildCheckCommandsNodeNoBuild(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "package.json"),
		[]byte(`{"scripts":{"test":"jest"}}`), 0o644)
	stacks := map[detect.Stack]bool{detect.Node: true}
	projects := []detect.Project{{Stack: detect.Node, Dir: "."}}
	build, test, lint := buildCheckCommands(dir, stacks, projects)
	if len(build) != 0 {
		t.Errorf("expected no build checks, got %v", build)
	}
	assertCheck(t, "test", test, "npm test")
	if len(lint) != 0 {
		t.Errorf("expected no lint checks, got %v", lint)
	}
}

func TestBuildCheckCommandsNodeDefaultTest(t *testing.T) {
	dir := t.TempDir()
	pkg := `{"scripts":{"test":"echo \"Error: no test specified\" && exit 1"}}`
	os.WriteFile(filepath.Join(dir, "package.json"), []byte(pkg), 0o644)
	stacks := map[detect.Stack]bool{detect.Node: true}
	projects := []detect.Project{{Stack: detect.Node, Dir: "."}}
	build, test, _ := buildCheckCommands(dir, stacks, projects)
	if len(build) != 0 {
		t.Errorf("expected no build checks, got %v", build)
	}
	if len(test) != 0 {
		t.Errorf("expected no test checks for default-placeholder npm script, got %v", test)
	}
}

func TestBuildCheckCommandsGo(t *testing.T) {
	dir := t.TempDir()
	// Guard requires a *_test.go file to emit the test stage.
	os.WriteFile(filepath.Join(dir, "foo_test.go"), []byte("package x\n"), 0o644)
	stacks := map[detect.Stack]bool{detect.Go: true}
	build, test, lint := buildCheckCommands(dir, stacks, nil)
	assertCheck(t, "build", build, "go build ./...")
	assertCheck(t, "test", test, "go test ./...")
	assertCheck(t, "lint", lint, "go vet ./...")
}

func TestBuildCheckCommandsJava(t *testing.T) {
	stacks := map[detect.Stack]bool{detect.Java: true}
	build, test, _ := buildCheckCommands(".", stacks, nil)
	assertCheck(t, "build", build, "mvn compile -q")
	assertCheck(t, "test", test, "mvn test -q")
}

func TestBuildCheckCommandsRuby(t *testing.T) {
	stacks := map[detect.Stack]bool{detect.Ruby: true}
	_, test, lint := buildCheckCommands(".", stacks, nil)
	assertCheck(t, "test", test, "bundle exec rspec")
	assertCheck(t, "lint", lint, "bundle exec rubocop")
}

func TestBuildInstallCommandsJava(t *testing.T) {
	stacks := map[detect.Stack]bool{detect.Java: true}
	cmds := buildInstallCommands(stacks)
	if len(cmds) != 1 || cmds[0] != "mvn dependency:resolve -q" {
		t.Fatalf("expected mvn dependency:resolve, got %v", cmds)
	}
}

func TestBuildInstallCommandsRuby(t *testing.T) {
	stacks := map[detect.Stack]bool{detect.Ruby: true}
	cmds := buildInstallCommands(stacks)
	if len(cmds) != 1 || cmds[0] != "bundle install" {
		t.Fatalf("expected bundle install, got %v", cmds)
	}
}

func assertCheck(t *testing.T, label string, checks []config.Check, wantRun string) {
	t.Helper()
	if len(checks) == 0 {
		t.Fatalf("%s: expected at least 1 check, got 0", label)
	}
	if checks[0].Run != wantRun {
		t.Errorf("%s: got Run=%q, want %q", label, checks[0].Run, wantRun)
	}
}
