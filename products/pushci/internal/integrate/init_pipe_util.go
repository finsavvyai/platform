package integrate

import (
	"path/filepath"

	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/detect"
)

// mergeNodeScripts combines scripts across Node projects.
func mergeNodeScripts(root string, projects []detect.Project) map[string]bool {
	merged := map[string]bool{}
	for _, p := range projects {
		if p.Stack != detect.Node {
			continue
		}
		dir := filepath.Join(root, p.Dir)
		for k, v := range detect.NodeScripts(dir) {
			if v {
				merged[k] = true
			}
		}
	}
	return merged
}

func findPy(projects []detect.Project) detect.Project {
	for _, p := range projects {
		if p.Stack == detect.Python {
			return p
		}
	}
	return detect.Project{Stack: detect.Python}
}

func pyBuild(p detect.Project, root string) []config.Check {
	base := filepath.Join(root, p.Dir)
	if detect.FileContainsPublic(filepath.Join(base, "pyproject.toml"), "build-system") {
		return []config.Check{{Name: "py-build", Run: "python -m build"}}
	}
	sp := filepath.Join(base, "setup.py")
	if detect.FileExistsPublic(sp) && detect.FileContainsPublic(sp, "setup(") {
		return []config.Check{{Name: "py-build", Run: "python setup.py build"}}
	}
	return nil
}

func pyTest(p detect.Project) []config.Check {
	if p.Framework == "django" {
		return []config.Check{{Name: "django-test", Run: "python manage.py test"}}
	}
	return []config.Check{{Name: "pytest", Run: "pytest"}}
}

func pyLint(p detect.Project, root string) []config.Check {
	base := filepath.Join(root, p.Dir)
	for _, f := range []string{"requirements.txt", "pyproject.toml"} {
		if detect.FileContainsPublic(filepath.Join(base, f), "ruff") {
			return []config.Check{{Name: "py-lint", Run: "ruff check ."}}
		}
	}
	return []config.Check{{Name: "py-lint", Run: "python -m compileall -q ."}}
}

// stripOrphanDeps removes depends_on refs to stages that don't exist.
func stripOrphanDeps(stages []config.Stage) []config.Stage {
	names := map[string]bool{}
	for _, s := range stages {
		names[s.Name] = true
	}
	for i, s := range stages {
		var valid []string
		for _, dep := range s.DependsOn {
			if names[dep] {
				valid = append(valid, dep)
			}
		}
		stages[i].DependsOn = valid
	}
	return stages
}
