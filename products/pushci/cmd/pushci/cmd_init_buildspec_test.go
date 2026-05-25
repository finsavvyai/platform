package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/finsavvyai/pushci/internal/config"
)

// Minimal teddk-style buildspec. We don't duplicate the whole fixture
// — the migrator tests own that — but we do assert that the real
// commands make it end-to-end through tryBuildspecMigrate.
const initBuildspecFixture = `version: 0.2
phases:
  pre_build:
    commands:
      - aws ecr get-login-password --region eu-north-1
  build:
    commands:
      - mvn deploy -P deploy-to-s3 -DskipTests
      - docker build -t teddk:latest .
`

func writeInitFixture(t *testing.T, dir, name, content string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0o644); err != nil {
		t.Fatalf("write %s: %v", name, err)
	}
}

func TestInitBuildspecProducesRealStages(t *testing.T) {
	dir := t.TempDir()
	writeInitFixture(t, dir, "buildspec.yml", initBuildspecFixture)
	pipe := tryBuildspecMigrate(dir)
	if pipe == nil {
		t.Fatal("tryBuildspecMigrate returned nil for valid buildspec.yml")
	}
	if len(pipe.Stages) != 2 {
		t.Fatalf("stages=%d want 2 (pre-build, build); got %+v", len(pipe.Stages), stageNames(pipe.Stages))
	}
	seen := map[string]string{}
	for _, s := range pipe.Stages {
		for _, c := range s.Checks {
			// Migrator uses name-as-command shorthand (see CLAUDE.md):
			// a check without explicit `run:` executes its `name` as a shell command.
			cmd := c.Run
			if cmd == "" {
				cmd = c.Name
			}
			seen[s.Name] = seen[s.Name] + " " + cmd
		}
	}
	all := ""
	for _, v := range seen {
		all += " " + v
	}
	for _, substr := range []string{"aws ecr get-login-password", "mvn deploy -P deploy-to-s3"} {
		if !strings.Contains(all, substr) {
			t.Errorf("expected command %q not found in any stage; saw: %+v", substr, seen)
		}
	}
}

func TestInitBuildspecMalformedFallsBack(t *testing.T) {
	dir := t.TempDir()
	writeInitFixture(t, dir, "buildspec.yml", ":::: not yaml")
	pipe := tryBuildspecMigrate(dir)
	if pipe != nil {
		t.Errorf("expected nil pipeline for malformed buildspec, got: %+v", pipe)
	}
}

func TestInitBuildspecAbsentReturnsNil(t *testing.T) {
	dir := t.TempDir()
	if got := tryBuildspecMigrate(dir); got != nil {
		t.Errorf("expected nil for dir with no buildspec.yml, got: %+v", got)
	}
}

func TestInitBuildspecMergeSecondaryStages(t *testing.T) {
	primary := []config.Stage{{Name: "build"}}
	heur := []config.Stage{{Name: "lint"}, {Name: "build"}}
	merged := appendSecondaryStages(primary, heur)
	if len(merged) != 2 {
		t.Fatalf("merged=%d want 2 (primary build + heur-lint), got %+v", len(merged), stageNames(merged))
	}
	if merged[1].Name != "heur-lint" {
		t.Errorf("second stage name = %q, want heur-lint", merged[1].Name)
	}
	if len(merged[1].DependsOn) != 1 || merged[1].DependsOn[0] != "build" {
		t.Errorf("heur stage depends_on = %+v, want [build]", merged[1].DependsOn)
	}
}

func TestInitBuildspecMergeRemapsInternalDeps(t *testing.T) {
	primary := []config.Stage{{Name: "build"}}
	heur := []config.Stage{
		{Name: "node-install"},
		{Name: "node-test", DependsOn: []string{"node-install"}},
	}
	merged := appendSecondaryStages(primary, heur)
	if len(merged) != 3 {
		t.Fatalf("merged=%d want 3, got %+v", len(merged), stageNames(merged))
	}
	if merged[2].Name != "heur-node-test" {
		t.Fatalf("third stage = %q, want heur-node-test", merged[2].Name)
	}
	if len(merged[2].DependsOn) != 1 || merged[2].DependsOn[0] != "heur-node-install" {
		t.Errorf("heur-node-test depends_on = %+v, want [heur-node-install]", merged[2].DependsOn)
	}
}

func stageNames(ss []config.Stage) []string {
	out := make([]string, len(ss))
	for i, s := range ss {
		out[i] = s.Name
	}
	return out
}
