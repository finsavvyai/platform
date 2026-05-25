// Package detect — pytest signal aggregator.
//
// Bug E (global-remit v1.6.4 dogfood): a repo with only `pytest.ini`
// (no requirements.txt / pyproject.toml) failed to emit a pytest
// stage because no Python marker existed. HasPytestSignal collects
// every conventional pytest marker and is also referenced from the
// markers table so such repos register as Python projects.

package detect

import (
	"os"
	"path/filepath"
	"strings"
)

// HasPytestSignal returns true if any conventional pytest marker
// exists at (or under) `base`. Kept exported for use by scan /
// init stage builders.
func HasPytestSignal(base string) bool {
	// 1) pytest.ini / tox.ini / setup.cfg / pyproject.toml sections
	if fileExists(filepath.Join(base, "pytest.ini")) {
		return true
	}
	if hasSection(filepath.Join(base, "tox.ini"), "[pytest]") ||
		hasSection(filepath.Join(base, "tox.ini"), "[testenv") {
		return true
	}
	if hasSection(filepath.Join(base, "setup.cfg"), "[tool:pytest]") {
		return true
	}
	if hasSection(filepath.Join(base, "pyproject.toml"), "[tool.pytest") {
		return true
	}
	// 2) conftest.py at root or inside tests/
	if fileExists(filepath.Join(base, "conftest.py")) ||
		fileExists(filepath.Join(base, "tests", "conftest.py")) {
		return true
	}
	// 3) tests/ or test/ directory containing at least one test file
	if hasTestFile(base) {
		return true
	}
	// 4) pytest listed as an explicit dep
	return hasPyDep(base, "pytest")
}

// hasSection returns true when `path` reads successfully AND its
// body contains `header` on a line by itself (ignoring whitespace).
func hasSection(path, header string) bool {
	data, err := os.ReadFile(path)
	if err != nil {
		return false
	}
	for _, line := range strings.Split(string(data), "\n") {
		trim := strings.TrimSpace(line)
		if strings.HasPrefix(trim, header) {
			return true
		}
	}
	return false
}

// hasTestFile walks up to depth 2 looking for test_*.py / *_test.py.
func hasTestFile(base string) bool {
	for _, dir := range []string{"tests", "test"} {
		if fileExists(filepath.Join(base, dir)) {
			if found, _ := walkForTestPy(filepath.Join(base, dir), 2); found {
				return true
			}
		}
	}
	return false
}

func walkForTestPy(root string, maxDepth int) (bool, error) {
	entries, err := os.ReadDir(root)
	if err != nil {
		return false, err
	}
	for _, e := range entries {
		name := e.Name()
		if e.IsDir() && maxDepth > 0 {
			if ok, _ := walkForTestPy(filepath.Join(root, name), maxDepth-1); ok {
				return true, nil
			}
			continue
		}
		if strings.HasSuffix(name, ".py") &&
			(strings.HasPrefix(name, "test_") || strings.HasSuffix(name, "_test.py")) {
			return true, nil
		}
	}
	return false, nil
}
