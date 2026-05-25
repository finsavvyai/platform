package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/finsavvyai/pushci/internal/detect"
)

func TestPythonBuildChecks_NoBuild(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "requirements.txt"), []byte("flask==2.3\n"), 0o644)
	p := detect.Project{Stack: detect.Python, Dir: "."}
	checks := pythonBuildChecks(p, dir)
	if len(checks) != 0 {
		t.Fatalf("plain Python should have no build, got %+v", checks)
	}
}

func TestPythonBuildChecks_Pyproject(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "pyproject.toml"), []byte("[build-system]\nrequires = [\"setuptools\"]\n"), 0o644)
	p := detect.Project{Stack: detect.Python, Dir: "."}
	checks := pythonBuildChecks(p, dir)
	if len(checks) != 1 || checks[0].Run != "python -m build" {
		t.Fatalf("expected python -m build, got %+v", checks)
	}
}

func TestPythonBuildChecks_SetupPy(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "setup.py"), []byte("from setuptools import setup\nsetup(\n)\n"), 0o644)
	p := detect.Project{Stack: detect.Python, Dir: "."}
	checks := pythonBuildChecks(p, dir)
	if len(checks) != 1 || checks[0].Run != "python setup.py build" {
		t.Fatalf("expected setup.py build, got %+v", checks)
	}
}

func TestPythonTestChecks_Default(t *testing.T) {
	p := detect.Project{Stack: detect.Python}
	checks := pythonTestChecks(p)
	if len(checks) != 1 || checks[0].Run != "pytest" {
		t.Fatalf("expected pytest, got %+v", checks)
	}
}

func TestPythonTestChecks_Django(t *testing.T) {
	p := detect.Project{Stack: detect.Python, Framework: "django"}
	checks := pythonTestChecks(p)
	if len(checks) != 1 || checks[0].Run != "python manage.py test" {
		t.Fatalf("expected manage.py test, got %+v", checks)
	}
}

func TestPythonLintChecks_Ruff(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "requirements.txt"), []byte("ruff==0.1.0\n"), 0o644)
	p := detect.Project{Stack: detect.Python, Dir: "."}
	checks := pythonLintChecks(p, dir)
	if len(checks) != 1 || checks[0].Run != "ruff check ." {
		t.Fatalf("expected ruff check, got %+v", checks)
	}
}

func TestPythonLintChecks_Fallback(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "requirements.txt"), []byte("flask==2.3\n"), 0o644)
	p := detect.Project{Stack: detect.Python, Dir: "."}
	checks := pythonLintChecks(p, dir)
	if len(checks) != 1 || !strings.Contains(checks[0].Run, "compileall") {
		t.Fatalf("expected py_compile fallback, got %+v", checks)
	}
}

func TestPythonPipeline_NoBuildStage(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "requirements.txt"), []byte("flask==2.3\n"), 0o644)
	stacks := map[detect.Stack]bool{detect.Python: true}
	projects := []detect.Project{{Stack: detect.Python, Dir: "."}}
	build, _, _ := buildCheckCommands(dir, stacks, projects)
	if len(build) != 0 {
		t.Fatalf("Python without build-system should produce no build checks, got %+v", build)
	}
}

func TestFindPythonProject_Found(t *testing.T) {
	projects := []detect.Project{{Stack: detect.Node}, {Stack: detect.Python, Framework: "django"}}
	if p := findPythonProject(projects); p.Framework != "django" {
		t.Fatalf("expected django, got %q", p.Framework)
	}
}

func TestFindPythonProject_Fallback(t *testing.T) {
	if p := findPythonProject(nil); p.Stack != detect.Python {
		t.Fatalf("expected Python fallback, got %v", p.Stack)
	}
}
