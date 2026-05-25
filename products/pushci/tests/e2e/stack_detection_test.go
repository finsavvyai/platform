package e2e

import (
	"path/filepath"
	"runtime"
	"testing"

	"github.com/finsavvyai/pushci/internal/detect"
)

// testdataDir returns the absolute path to tests/e2e/testdata.
func testdataDir(t *testing.T) string {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller failed")
	}
	return filepath.Join(filepath.Dir(file), "testdata")
}

func TestStackDetection_Go(t *testing.T) {
	dir := filepath.Join(testdataDir(t), "stacks", "go-api")
	projects := detect.Scan(dir)
	if len(projects) == 0 {
		t.Fatal("expected at least one project detected, got none")
	}
	found := false
	for _, p := range projects {
		if p.Stack == detect.Go {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("expected Go stack to be detected, got: %+v", projects)
	}
}

func TestStackDetection_NodeNpm(t *testing.T) {
	dir := filepath.Join(testdataDir(t), "stacks", "node-npm")
	projects := detect.Scan(dir)
	if len(projects) == 0 {
		t.Fatal("expected at least one project detected, got none")
	}
	var nodeProject *detect.Project
	for i := range projects {
		if projects[i].Stack == detect.Node {
			nodeProject = &projects[i]
			break
		}
	}
	if nodeProject == nil {
		t.Fatalf("expected Node stack, got: %+v", projects)
	}
	// No lockfile in fixture → falls back to npm
	if nodeProject.BuildTool != detect.ToolNpm {
		t.Errorf("expected build tool npm, got %q", nodeProject.BuildTool)
	}
}

func TestStackDetection_NodePnpm(t *testing.T) {
	dir := filepath.Join(testdataDir(t), "stacks", "node-pnpm")
	projects := detect.Scan(dir)
	var nodeProject *detect.Project
	for i := range projects {
		if projects[i].Stack == detect.Node {
			nodeProject = &projects[i]
			break
		}
	}
	if nodeProject == nil {
		t.Fatalf("expected Node stack, got: %+v", projects)
	}
	if nodeProject.BuildTool != detect.ToolPnpm {
		t.Errorf("expected build tool pnpm (pnpm-lock.yaml present), got %q", nodeProject.BuildTool)
	}
}

func TestStackDetection_Python(t *testing.T) {
	dir := filepath.Join(testdataDir(t), "stacks", "python-pip")
	projects := detect.Scan(dir)
	found := false
	for _, p := range projects {
		if p.Stack == detect.Python {
			found = true
			if p.BuildTool != detect.ToolPip {
				t.Errorf("expected pip build tool, got %q", p.BuildTool)
			}
		}
	}
	if !found {
		t.Errorf("expected Python stack to be detected, got: %+v", projects)
	}
}

func TestStackDetection_Rust(t *testing.T) {
	dir := filepath.Join(testdataDir(t), "stacks", "rust")
	projects := detect.Scan(dir)
	found := false
	for _, p := range projects {
		if p.Stack == detect.Rust {
			found = true
			if p.BuildTool != detect.ToolCargo {
				t.Errorf("expected cargo build tool, got %q", p.BuildTool)
			}
		}
	}
	if !found {
		t.Errorf("expected Rust stack to be detected, got: %+v", projects)
	}
}

func TestStackDetection_JavaMaven(t *testing.T) {
	dir := filepath.Join(testdataDir(t), "stacks", "java-maven")
	projects := detect.Scan(dir)
	found := false
	for _, p := range projects {
		if p.Stack == detect.Java {
			found = true
			if p.BuildTool != detect.ToolMaven {
				t.Errorf("expected maven build tool, got %q", p.BuildTool)
			}
		}
	}
	if !found {
		t.Errorf("expected Java stack to be detected, got: %+v", projects)
	}
}

func TestStackDetection_SkipsDirs(t *testing.T) {
	// Scanning a directory with no marker files returns empty slice — no panics.
	dir := t.TempDir()
	projects := detect.Scan(dir)
	if projects == nil {
		// nil is fine — the contract is "no project found"
		return
	}
	if len(projects) != 0 {
		t.Errorf("expected no projects in empty dir, got: %+v", projects)
	}
}

func TestDetectNodeBuildTool_FallbackNpm(t *testing.T) {
	dir := t.TempDir()
	tool := detect.DetectNodeBuildToolAtRoot(dir)
	if tool != detect.ToolNpm {
		t.Errorf("expected npm fallback when no lockfile, got %q", tool)
	}
}
