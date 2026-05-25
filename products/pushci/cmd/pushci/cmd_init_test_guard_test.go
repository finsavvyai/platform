package main

import (
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/finsavvyai/pushci/internal/detect"
)

// Remittance-shape fixture: package.json with ONLY a build script.
// Must emit NO test stage — the v1.6.4 dogfood bug.
func TestGuardNode_NoTestScript_NoTestStage(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "package.json"),
		[]byte(`{"name":"remittance","scripts":{"build":"vite build"}}`), 0o644)
	stacks := map[detect.Stack]bool{detect.Node: true}
	projects := []detect.Project{{Stack: detect.Node, Dir: "."}}
	_, test, _ := buildCheckCommands(dir, stacks, projects)
	if len(test) != 0 {
		t.Fatalf("Node project without test script must emit no test checks, got %+v", test)
	}
}

func TestGuardNode_WithTestScript_EmitsTestStage(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "package.json"),
		[]byte(`{"name":"admin","scripts":{"test":"jest","build":"vite build"}}`), 0o644)
	stacks := map[detect.Stack]bool{detect.Node: true}
	projects := []detect.Project{{Stack: detect.Node, Dir: "."}}
	_, test, _ := buildCheckCommands(dir, stacks, projects)
	if len(test) != 1 || test[0].Run != "npm test" {
		t.Fatalf("Node with test script should emit npm test, got %+v", test)
	}
}

func TestGuardPython_NoTests_NoTestStage(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "requirements.txt"), []byte("flask==2.3\n"), 0o644)
	stacks := map[detect.Stack]bool{detect.Python: true}
	projects := []detect.Project{{Stack: detect.Python, Dir: "."}}
	_, test, _ := buildCheckCommands(dir, stacks, projects)
	if len(test) != 0 {
		t.Fatalf("Python without pytest.ini/tests dir must emit no test checks, got %+v", test)
	}
}

func TestGuardPython_PytestIni_EmitsTestStage(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "pytest.ini"), []byte("[pytest]\n"), 0o644)
	stacks := map[detect.Stack]bool{detect.Python: true}
	projects := []detect.Project{{Stack: detect.Python, Dir: "."}}
	_, test, _ := buildCheckCommands(dir, stacks, projects)
	if len(test) != 1 || test[0].Run != "pytest" {
		t.Fatalf("Python with pytest.ini should emit pytest, got %+v", test)
	}
}

func TestGuardPython_TestsDir_EmitsTestStage(t *testing.T) {
	dir := t.TempDir()
	os.MkdirAll(filepath.Join(dir, "tests"), 0o755)
	stacks := map[detect.Stack]bool{detect.Python: true}
	projects := []detect.Project{{Stack: detect.Python, Dir: "."}}
	_, test, _ := buildCheckCommands(dir, stacks, projects)
	if len(test) != 1 {
		t.Fatalf("Python with tests/ dir should emit test stage, got %+v", test)
	}
}

func TestGuardPython_Django_EmitsTestStage(t *testing.T) {
	dir := t.TempDir()
	stacks := map[detect.Stack]bool{detect.Python: true}
	projects := []detect.Project{{Stack: detect.Python, Dir: ".", Framework: "django"}}
	_, test, _ := buildCheckCommands(dir, stacks, projects)
	if len(test) != 1 || test[0].Run != "python manage.py test" {
		t.Fatalf("Django project should always emit manage.py test, got %+v", test)
	}
}

func TestGuardGo_NoTestFiles_NoTestStage(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "main.go"), []byte("package main\nfunc main() {}\n"), 0o644)
	stacks := map[detect.Stack]bool{detect.Go: true}
	_, test, _ := buildCheckCommands(dir, stacks, nil)
	if len(test) != 0 {
		t.Fatalf("Go project with no *_test.go must emit no test checks, got %+v", test)
	}
}

func TestGuardGo_WithTestFiles_EmitsTestStage(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "foo_test.go"), []byte("package main\n"), 0o644)
	stacks := map[detect.Stack]bool{detect.Go: true}
	_, test, _ := buildCheckCommands(dir, stacks, nil)
	if len(test) != 1 || test[0].Run != "go test ./..." {
		t.Fatalf("Go with test files should emit go test, got %+v", test)
	}
}

// Repo-wide sanity: no checked-in pushci.yml fixture may carry
// `- name: test` without a `run:` field — that form executes the
// BSD `test` utility and silently succeeds.
func TestGuardRepoFixtures_NoBareTestCheck(t *testing.T) {
	roots := []string{".", "../.."}
	for _, root := range roots {
		filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
			if err != nil || d.IsDir() {
				return nil
			}
			if strings.Contains(path, "node_modules") || strings.Contains(path, "/.git/") {
				return nil
			}
			name := d.Name()
			if name != "pushci.yml" && name != "pushci.yaml" {
				return nil
			}
			data, rerr := os.ReadFile(path)
			if rerr != nil {
				return nil
			}
			if containsBareTestCheck(string(data)) {
				t.Errorf("%s: contains `- name: test` without an explicit `run:` field", path)
			}
			return nil
		})
	}
}

// containsBareTestCheck finds a `- name: test` entry whose check
// body inside the same list item lacks a `run:` field. Exact-
// shorthand forms like `- name: npm test` or `- name: go test
// ./...` are allowed: the name IS the command.
func containsBareTestCheck(text string) bool {
	lines := strings.Split(text, "\n")
	for i, ln := range lines {
		trim := strings.TrimLeft(ln, " \t")
		if trim != "- name: test" {
			continue
		}
		indent := len(ln) - len(trim)
		if !siblingHasRun(lines, i, indent) {
			return true
		}
	}
	return false
}

// siblingHasRun scans subsequent lines of the same list item
// (indentation strictly greater than the `- name:` dash column)
// until a sibling or parent starts, looking for a `run:` key.
func siblingHasRun(lines []string, start, indent int) bool {
	for j := start + 1; j < len(lines); j++ {
		ln := lines[j]
		trim := strings.TrimLeft(ln, " \t")
		if trim == "" {
			continue
		}
		cur := len(ln) - len(trim)
		if cur <= indent {
			return false
		}
		if strings.HasPrefix(trim, "run:") {
			return true
		}
	}
	return false
}

func TestGuardRemittance_NoBareTestStageInPipeline(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "package.json"),
		[]byte(`{"name":"remittance","scripts":{"build":"vite build"}}`), 0o644)
	stacks := map[detect.Stack]bool{detect.Node: true}
	projects := []detect.Project{{Stack: detect.Node, Dir: "."}}
	stages := buildSingleProjectStages(dir, stacks, projects, "")
	for _, st := range stages {
		if st.Name == "test" {
			t.Fatalf("remittance-shape project should not emit a test stage, got stages: %+v", stages)
		}
		for _, c := range st.Checks {
			if c.Name == "test" && c.Run == "" {
				t.Fatalf("stage %q has bare `name: test` without Run — the BSD test-utility bug", st.Name)
			}
		}
	}
}
