package detect

import (
	"os"
	"path/filepath"
	"testing"
)

func TestIsTurboRepo(t *testing.T) {
	dir := t.TempDir()
	if IsTurboRepo(dir) {
		t.Fatal("expected false for empty dir")
	}
	os.WriteFile(filepath.Join(dir, "turbo.json"), []byte(`{"tasks":{}}`), 0o644)
	if !IsTurboRepo(dir) {
		t.Fatal("expected true when turbo.json exists")
	}
}

func TestTurboProjects(t *testing.T) {
	dir := t.TempDir()
	// Setup workspace structure
	os.WriteFile(filepath.Join(dir, "package.json"),
		[]byte(`{"workspaces":["apps/*","packages/*"]}`), 0o644)
	os.WriteFile(filepath.Join(dir, "turbo.json"),
		[]byte(`{"tasks":{"build":{},"test":{}}}`), 0o644)

	// Create sub-projects
	for _, sub := range []string{"apps/web", "apps/api", "packages/db"} {
		os.MkdirAll(filepath.Join(dir, sub), 0o755)
		os.WriteFile(filepath.Join(dir, sub, "package.json"), []byte(`{}`), 0o644)
	}

	projects := TurboProjects(dir)
	if len(projects) != 3 {
		t.Fatalf("expected 3 projects, got %d", len(projects))
	}
	for _, p := range projects {
		if p.Stack != Node {
			t.Errorf("expected Node stack, got %s", p.Stack)
		}
	}
}

func TestTurboTasks(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "turbo.json"),
		[]byte(`{"tasks":{"build":{},"test":{},"lint":{}}}`), 0o644)
	tasks := TurboTasks(dir)
	if len(tasks) != 3 {
		t.Fatalf("expected 3 tasks, got %d", len(tasks))
	}
}

func TestTurboTasksLegacyPipeline(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "turbo.json"),
		[]byte(`{"pipeline":{"build":{},"test":{}}}`), 0o644)
	tasks := TurboTasks(dir)
	if len(tasks) != 2 {
		t.Fatalf("expected 2 tasks, got %d", len(tasks))
	}
}
