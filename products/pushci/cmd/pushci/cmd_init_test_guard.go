package main

import (
	"io/fs"
	"path/filepath"
	"strings"

	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/detect"
)

// nodeScriptsFromProjects merges available scripts across Node projects.
func nodeScriptsFromProjects(root string, projects []detect.Project) map[string]bool {
	merged := map[string]bool{}
	for _, p := range projects {
		if p.Stack != detect.Node {
			continue
		}
		for k, v := range detect.NodeScripts(filepath.Join(root, p.Dir)) {
			if v {
				merged[k] = true
			}
		}
	}
	return merged
}

// allExtCheckCommands aggregates the ext1..ext4 emitters so the
// primary buildCheckCommands body stays under the 100-line cap.
func allExtCheckCommands(root string, stacks map[detect.Stack]bool, projects []detect.Project) (build, test, lint []config.Check) {
	b1, t1, l1 := extCheckCommands(root, stacks, projects)
	b2, t2, l2 := ext2CheckCommands(stacks, projects)
	b3, t3, l3 := ext3CheckCommands(stacks)
	b4, t4, l4 := ext4CheckCommands(stacks, projects)
	build = append(append(append(b1, b2...), b3...), b4...)
	test = append(append(append(t1, t2...), t3...), t4...)
	lint = append(append(append(l1, l2...), l3...), l4...)
	return
}

// hasGoTestFiles returns true when any *_test.go file exists
// anywhere under root (skipping vendor/, node_modules/, .git/).
// Prevents `pushci init` from emitting a `go test ./...` stage
// on a project that has no tests at all.
func hasGoTestFiles(root string) bool {
	found := false
	_ = filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil || found {
			return nil
		}
		if d.IsDir() {
			name := d.Name()
			if name == "vendor" || name == "node_modules" || name == ".git" {
				return filepath.SkipDir
			}
			return nil
		}
		if strings.HasSuffix(d.Name(), "_test.go") {
			found = true
			return filepath.SkipDir
		}
		return nil
	})
	return found
}

// hasPythonTests returns true when a Python project has any
// credible test signal: a pytest/tox config, a [tool.pytest*]
// section in pyproject.toml, a [tool:pytest] block in setup.cfg,
// or a top-level tests/ or test/ directory.
func hasPythonTests(base string) bool {
	for _, name := range []string{"pytest.ini", "tox.ini", "conftest.py"} {
		if detect.FileExistsPublic(filepath.Join(base, name)) {
			return true
		}
	}
	if detect.FileContainsPublic(filepath.Join(base, "setup.cfg"), "[tool:pytest]") {
		return true
	}
	if detect.FileContainsPublic(filepath.Join(base, "pyproject.toml"), "[tool.pytest") {
		return true
	}
	for _, d := range []string{"tests", "test"} {
		if detect.FileExistsPublic(filepath.Join(base, d)) {
			return true
		}
	}
	return false
}

// pythonHasDjango reports whether the project's framework is
// Django — Django ships with its own test runner so `manage.py
// test` is safe to emit even without a tests/ dir.
func pythonHasDjango(p detect.Project) bool {
	return p.Framework == "django"
}
