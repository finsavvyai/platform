package intel

import (
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/finsavvyai/pushci/internal/detect"
)

// DetectChanges returns files changed since the previous commit.
func DetectChanges(root string) ([]string, error) {
	cmd := exec.Command("git", "diff", "--name-only", "HEAD~1")
	cmd.Dir = root
	out, err := cmd.Output()
	if err != nil {
		return nil, err
	}
	return parseLines(strings.TrimSpace(string(out))), nil
}

func parseLines(s string) []string {
	if s == "" {
		return nil
	}
	return strings.Split(s, "\n")
}

// AffectedProjects filters projects to only those with changed files.
func AffectedProjects(changes []string, projects []detect.Project) []detect.Project {
	var affected []detect.Project
	for _, p := range projects {
		if projectAffected(changes, p) {
			affected = append(affected, p)
		}
	}
	return affected
}

func projectAffected(changes []string, p detect.Project) bool {
	for _, f := range changes {
		if fileInProject(f, p.Dir) {
			return true
		}
	}
	return false
}

func fileInProject(file, dir string) bool {
	if dir == "." || dir == "" {
		return true
	}
	rel, err := filepath.Rel(dir, file)
	if err != nil {
		return false
	}
	return !strings.HasPrefix(rel, "..")
}

// AffectedChecks determines which checks to run based on changed files.
func AffectedChecks(changes []string, project detect.Project) []string {
	hasTest, hasSrc := false, false
	for _, f := range changes {
		if !fileInProject(f, project.Dir) {
			continue
		}
		if isTestFile(f) {
			hasTest = true
		} else {
			hasSrc = true
		}
	}
	if !hasTest && !hasSrc {
		return nil
	}
	if hasTest && !hasSrc {
		return []string{"test"}
	}
	return []string{"build", "test"}
}

func isTestFile(f string) bool {
	base := filepath.Base(f)
	return strings.HasSuffix(base, "_test.go") ||
		strings.HasSuffix(base, ".test.ts") ||
		strings.HasSuffix(base, ".test.tsx") ||
		strings.HasSuffix(base, ".test.js") ||
		strings.HasSuffix(base, ".spec.ts") ||
		strings.HasSuffix(base, ".spec.js") ||
		strings.Contains(base, "test_") ||
		strings.HasPrefix(base, "test_")
}
