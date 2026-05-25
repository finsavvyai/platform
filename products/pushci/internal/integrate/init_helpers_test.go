package integrate

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/detect"
)

// setupRepo creates a temp dir with git init and writes the given files.
func setupRepo(t *testing.T, files map[string]string) string {
	t.Helper()
	dir := t.TempDir()
	os.MkdirAll(filepath.Join(dir, ".git"), 0o755)
	for name, content := range files {
		full := filepath.Join(dir, name)
		os.MkdirAll(filepath.Dir(full), 0o755)
		if err := os.WriteFile(full, []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	return dir
}

// scanAndBuild detects projects and builds a pipeline using the same
// logic as cmd_init (install/build/test/lint stages).
func scanAndBuild(root string) (*config.Pipeline, []detect.Project) {
	projects := detect.Scan(root)
	stacks := map[detect.Stack]bool{}
	dirs := map[string]bool{}
	for _, p := range projects {
		stacks[p.Stack] = true
		if p.Dir != "" && p.Dir != "." {
			dirs[p.Dir] = true
		}
	}
	var stages []config.Stage
	if len(dirs) > 1 {
		stages = buildMonorepo(root, projects)
	} else {
		stages = buildSingle(root, stacks, projects)
	}
	var nonEmpty []config.Stage
	for _, s := range stages {
		if len(s.Checks) > 0 {
			nonEmpty = append(nonEmpty, s)
		}
	}
	nonEmpty = stripOrphanDeps(nonEmpty)
	return &config.Pipeline{On: []string{"push"}, Stages: nonEmpty}, projects
}

// hasStage returns the stage with the given name, or nil.
func hasStage(pipe *config.Pipeline, name string) *config.Stage {
	for i, s := range pipe.Stages {
		if s.Name == name {
			return &pipe.Stages[i]
		}
	}
	return nil
}

// hasCheck returns true if the stage contains a check with the given name.
func hasCheck(stage *config.Stage, name string) bool {
	for _, c := range stage.Checks {
		if c.Name == name {
			return true
		}
	}
	return false
}

// checkRun returns the run command for a named check, or "".
func checkRun(stage *config.Stage, name string) string {
	for _, c := range stage.Checks {
		if c.Name == name {
			return c.Run
		}
	}
	return ""
}
