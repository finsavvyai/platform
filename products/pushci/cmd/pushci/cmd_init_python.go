package main

import (
	"path/filepath"

	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/detect"
)

// pythonBuildChecks returns build checks for Python projects.
// Python is interpreted so build is only needed when a build-system exists.
func pythonBuildChecks(p detect.Project, root string) []config.Check {
	base := filepath.Join(root, p.Dir)
	pyproject := filepath.Join(base, "pyproject.toml")

	if detect.FileContainsPublic(pyproject, "build-system") {
		return []config.Check{{Name: "py-build", Run: "python -m build"}}
	}

	setupPy := filepath.Join(base, "setup.py")
	if detect.FileExistsPublic(setupPy) && detect.FileContainsPublic(setupPy, "setup(") {
		return []config.Check{{Name: "py-build", Run: "python setup.py build"}}
	}

	return nil
}

// pythonTestChecks returns the test command based on framework.
func pythonTestChecks(p detect.Project) []config.Check {
	if p.Framework == "django" {
		return []config.Check{{Name: "django-test", Run: "python manage.py test"}}
	}
	return []config.Check{{Name: "pytest", Run: "pytest"}}
}

// pythonLintChecks returns lint checks for Python projects.
// Uses ruff if found in requirements, otherwise py_compile.
func pythonLintChecks(p detect.Project, root string) []config.Check {
	base := filepath.Join(root, p.Dir)
	for _, f := range []string{"requirements.txt", "pyproject.toml"} {
		if detect.FileContainsPublic(filepath.Join(base, f), "ruff") {
			return []config.Check{{Name: "py-lint", Run: "ruff check ."}}
		}
	}
	return []config.Check{{Name: "py-lint", Run: "python -m compileall -q ."}}
}
