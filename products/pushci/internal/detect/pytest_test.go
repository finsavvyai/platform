package detect

import (
	"os"
	"path/filepath"
	"testing"
)

func TestHasPytestSignal(t *testing.T) {
	tests := []struct {
		name  string
		setup func(d string)
		want  bool
	}{
		{"pytest.ini alone", func(d string) {
			os.WriteFile(filepath.Join(d, "pytest.ini"), []byte("[pytest]\n"), 0o644)
		}, true},
		{"tox.ini with [pytest]", func(d string) {
			os.WriteFile(filepath.Join(d, "tox.ini"), []byte("[pytest]\naddopts = -v\n"), 0o644)
		}, true},
		{"tox.ini with [testenv]", func(d string) {
			os.WriteFile(filepath.Join(d, "tox.ini"),
				[]byte("[testenv]\ncommands = pytest\n"), 0o644)
		}, true},
		{"setup.cfg with [tool:pytest]", func(d string) {
			os.WriteFile(filepath.Join(d, "setup.cfg"),
				[]byte("[tool:pytest]\naddopts = -q\n"), 0o644)
		}, true},
		{"pyproject.toml with [tool.pytest.ini_options]", func(d string) {
			os.WriteFile(filepath.Join(d, "pyproject.toml"),
				[]byte("[tool.pytest.ini_options]\naddopts = \"-q\"\n"), 0o644)
		}, true},
		{"conftest.py at root", func(d string) {
			os.WriteFile(filepath.Join(d, "conftest.py"), []byte(""), 0o644)
		}, true},
		{"tests/test_foo.py", func(d string) {
			os.MkdirAll(filepath.Join(d, "tests"), 0o755)
			os.WriteFile(filepath.Join(d, "tests", "test_foo.py"), []byte(""), 0o644)
		}, true},
		{"test/foo_test.py", func(d string) {
			os.MkdirAll(filepath.Join(d, "test"), 0o755)
			os.WriteFile(filepath.Join(d, "test", "foo_test.py"), []byte(""), 0o644)
		}, true},
		{"pytest listed in requirements", func(d string) {
			os.WriteFile(filepath.Join(d, "requirements.txt"),
				[]byte("pytest==7.4\n"), 0o644)
		}, true},
		{"empty dir → no pytest", func(d string) {}, false},
		{"unrelated python project → no pytest", func(d string) {
			os.WriteFile(filepath.Join(d, "requirements.txt"),
				[]byte("boto3==1.20\n"), 0o644)
		}, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()
			tt.setup(dir)
			if got := HasPytestSignal(dir); got != tt.want {
				t.Errorf("HasPytestSignal() = %v, want %v", got, tt.want)
			}
		})
	}
}

// regression: cloudformation-style project has only pytest.ini —
// Scan must still register a Python project from that signal so a
// pytest stage lands in pushci.yml.
func TestScan_PytestIniRegistersPython(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "pytest.ini"), []byte("[pytest]\n"), 0o644)
	projects := Scan(dir)
	var found bool
	for _, p := range projects {
		if p.Stack == Python {
			found = true
		}
	}
	if !found {
		t.Fatalf("pytest.ini should register Python project; got %+v", projects)
	}
}

// regression: lambda-layers-style project has requirements.txt with
// only boto3 — must NOT be tagged as fastapi.
func TestScan_LambdaLayersNoFastapiFalsePositive(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "requirements.txt"),
		[]byte("boto3==1.20\nbotocore==1.23\n"), 0o644)
	projects := Scan(dir)
	for _, p := range projects {
		if p.Framework == "fastapi" {
			t.Fatalf("lambda-layers deps must not produce fastapi framework; got %+v", p)
		}
	}
}
