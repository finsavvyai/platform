package main

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/finsavvyai/pushci/internal/detect"
)

func TestBuildMonorepoStages(t *testing.T) {
	dir := t.TempDir()
	fe := filepath.Join(dir, "frontend")
	be := filepath.Join(dir, "backend")
	os.MkdirAll(fe, 0o755)
	os.MkdirAll(be, 0o755)
	os.WriteFile(filepath.Join(fe, "package.json"),
		[]byte(`{"scripts":{"build":"vite build","test":"vitest"}}`), 0o644)
	os.WriteFile(filepath.Join(be, "go.mod"), []byte("module example"), 0o644)

	projects := []detect.Project{
		{Stack: detect.Node, Dir: "frontend"},
		{Stack: detect.Go, Dir: "backend"},
	}
	stages := buildMonorepoStages(dir, projects)

	// Should have stages for frontend and backend, each with install prefix
	frontendFound := false
	backendFound := false
	for _, s := range stages {
		if s.Name == "frontend-install" && s.Dir == "frontend" {
			frontendFound = true
		}
		if s.Name == "backend-install" && s.Dir == "backend" {
			backendFound = true
		}
	}
	if !frontendFound {
		t.Error("missing frontend-install stage with dir=frontend")
	}
	if !backendFound {
		t.Error("missing backend-install stage with dir=backend")
	}
}

func TestBuildMonorepoStagesDirField(t *testing.T) {
	dir := t.TempDir()
	fe := filepath.Join(dir, "web")
	os.MkdirAll(fe, 0o755)
	os.WriteFile(filepath.Join(fe, "package.json"),
		[]byte(`{"scripts":{"test":"jest","lint":"eslint ."}}`), 0o644)

	projects := []detect.Project{
		{Stack: detect.Node, Dir: "web"},
	}
	stages := buildMonorepoStages(dir, projects)

	for _, s := range stages {
		if s.Dir != "web" {
			t.Errorf("stage %q has dir=%q, want web", s.Name, s.Dir)
		}
	}
}

func TestBuildSingleProjectStages(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "package.json"),
		[]byte(`{"scripts":{"build":"tsc","test":"jest","lint":"eslint ."}}`), 0o644)

	stacks := map[detect.Stack]bool{detect.Node: true}
	projects := []detect.Project{{Stack: detect.Node, Dir: "."}}
	stages := buildSingleProjectStages(dir, stacks, projects, "")

	if len(stages) < 3 {
		t.Fatalf("expected at least 3 stages, got %d", len(stages))
	}
	if stages[0].Name != "install" {
		t.Errorf("first stage name = %q, want install", stages[0].Name)
	}
}

func TestMonorepoSkipsDocker(t *testing.T) {
	dir := t.TempDir()
	projects := []detect.Project{
		{Stack: detect.Docker, Dir: "."},
		{Stack: detect.Go, Dir: "api"},
	}
	os.MkdirAll(filepath.Join(dir, "api"), 0o755)
	os.WriteFile(filepath.Join(dir, "api", "go.mod"), []byte("module ex"), 0o644)
	stages := buildMonorepoStages(dir, projects)
	for _, s := range stages {
		if s.Dir == "." || s.Dir == "" {
			t.Errorf("unexpected root stage: %s (Docker should be skipped)", s.Name)
		}
	}
}
