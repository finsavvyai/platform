package integrate

import (
	"testing"

	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/detect"
)

func TestDependsOnValidation(t *testing.T) {
	stages := []config.Stage{
		{Name: "test", DependsOn: []string{"install", "phantom"}},
	}
	result := stripOrphanDeps(stages)
	if len(result[0].DependsOn) != 0 {
		t.Errorf("orphan deps not stripped: %v", result[0].DependsOn)
	}
}

func TestEmptyChecksRemoved(t *testing.T) {
	dir := setupRepo(t, map[string]string{
		"go.mod": "module example.com/app\n\ngo 1.22\n",
	})

	pipe, _ := scanAndBuild(dir)
	for _, s := range pipe.Stages {
		if len(s.Checks) == 0 {
			t.Errorf("stage %q has no checks but was not filtered", s.Name)
		}
	}
}

func TestMonorepoSubdirs(t *testing.T) {
	dir := setupRepo(t, map[string]string{
		"frontend/package.json": `{"name":"web","scripts":{"build":"vite build","test":"vitest"}}`,
		"backend/go.mod":        "module example.com/be\n\ngo 1.22\n",
	})

	pipe, projects := scanAndBuild(dir)
	if len(projects) < 2 {
		t.Fatalf("expected 2 projects, got %d", len(projects))
	}

	// Verify dir fields are set on monorepo stages
	feInstall := hasStage(pipe, "frontend-install")
	beInstall := hasStage(pipe, "backend-install")
	if feInstall == nil {
		t.Error("missing frontend-install stage")
	} else if feInstall.Dir != "frontend" {
		t.Errorf("frontend dir = %q, want frontend", feInstall.Dir)
	}
	if beInstall == nil {
		t.Error("missing backend-install stage")
	} else if beInstall.Dir != "backend" {
		t.Errorf("backend dir = %q, want backend", beInstall.Dir)
	}

	// Verify depends_on is set correctly
	feTest := hasStage(pipe, "frontend-test")
	if feTest != nil && len(feTest.DependsOn) > 0 {
		if feTest.DependsOn[0] != "frontend-install" {
			t.Errorf("frontend-test depends_on = %v", feTest.DependsOn)
		}
	}
}

func TestNoProjectDetected(t *testing.T) {
	dir := setupRepo(t, map[string]string{
		"README.md": "# Empty project\n",
	})

	projects := detect.Scan(dir)
	if len(projects) != 0 {
		t.Errorf("expected 0 projects, got %d: %+v", len(projects), projects)
	}
}
