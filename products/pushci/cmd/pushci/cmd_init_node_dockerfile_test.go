package main

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/detect"
)

// Global-Remit v1.6.4 bug B reproduction: admin-dashboard has
// package.json (scripts: test/build/lint), Dockerfile, and a
// governance-only .gitlab-ci.yml. The migration yielded only the
// governance stages (approve/audit/release) and dropped Node's
// install/lint/test/build even though package.json was present.
//
// Root cause (cmd_init_source_header.go:mergeSecondaryHeuristic):
// the heuristic-merge path ran only for FromBuildspec / FromChef /
// FromJenkins. Generic CI migrations (GitLab/CircleCI/Bitbucket/
// Azure) short-circuited before Node language stages got a chance
// to append. Fix: introduce FromGenericCI and add it to the merge
// eligibility check, while still excluding GitHub Actions (whose
// migrator emits language stages natively).
func TestInitGlobalRemitRegression_NodeStagesMergeAfterGitLabGovernance(t *testing.T) {
	dir := seedGlobalRemitFixture(t, true)

	origArgs := os.Args
	defer func() { os.Args = origArgs }()
	os.Args = []string{"pushci", "init", "--force", "--non-interactive"}

	projects := detect.Scan(dir)
	targets := detect.ScanDeployTargets(dir)
	src := pickMigrationSource(dir)
	if src.Pipeline == nil || !src.FromGenericCI || src.GenericCIKind != "gitlab" {
		t.Fatalf("expected GitLab-CI migration source; got %+v", src)
	}
	pipe := src.Pipeline
	mergeSecondaryHeuristic(pipe, src, dir, projects, targets)

	names := map[string]bool{}
	for _, s := range pipe.Stages {
		names[s.Name] = true
	}
	for _, want := range []string{"heur-install", "heur-build", "heur-test", "heur-lint"} {
		if !names[want] {
			t.Errorf("expected %q stage after merge; got %v", want, stageNamesFromPipe(pipe))
		}
	}
	// Governance stages from .gitlab-ci.yml must survive untouched.
	for _, want := range []string{"approve", "audit", "release"} {
		if !names[want] {
			t.Errorf("governance stage %q dropped; got %v", want, stageNamesFromPipe(pipe))
		}
	}
}

// Fixture without Dockerfile: Node stages still emit. Guards that
// the merge fix doesn't accidentally depend on Docker presence.
func TestInitGlobalRemitRegression_NoDockerfileStillMerges(t *testing.T) {
	dir := seedGlobalRemitFixture(t, false)
	origArgs := os.Args
	defer func() { os.Args = origArgs }()
	os.Args = []string{"pushci", "init", "--force", "--non-interactive"}
	src := pickMigrationSource(dir)
	if !src.FromGenericCI {
		t.Fatalf("expected FromGenericCI=true; got %+v", src)
	}
	projects := detect.Scan(dir)
	mergeSecondaryHeuristic(src.Pipeline, src, dir, projects, nil)
	if !hasStage(src.Pipeline, "heur-test") {
		t.Errorf("expected heur-test; got %v", stageNamesFromPipe(src.Pipeline))
	}
}

// Dockerfile-only repo (no package.json, no .gitlab-ci.yml) must
// NOT grow spurious Node stages. Guards against over-merging.
func TestInitGlobalRemitRegression_DockerfileOnlyNoNodeStages(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "Dockerfile"), []byte("FROM alpine\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	origArgs := os.Args
	defer func() { os.Args = origArgs }()
	os.Args = []string{"pushci", "init", "--force", "--non-interactive"}
	src := pickMigrationSource(dir)
	if src.Pipeline != nil {
		t.Errorf("expected no migration source for Dockerfile-only repo; got %+v", src)
	}
}

// seedGlobalRemitFixture writes a minimal Vite+Node project with
// scripts test/build/lint, optionally plus a Dockerfile, plus the
// governance-only .gitlab-ci.yml that triggered the bug.
func seedGlobalRemitFixture(t *testing.T, withDockerfile bool) string {
	t.Helper()
	dir := t.TempDir()
	files := map[string]string{
		"package.json": `{
  "name": "admin-dashboard",
  "private": true,
  "scripts": {
    "test": "playwright test",
    "build": "vite build",
    "lint": "eslint ."
  }
}
`,
		".gitlab-ci.yml": `stages:
  - approve
  - audit
  - release
approve:
  stage: approve
  script:
    - echo approved
audit:
  stage: audit
  script:
    - npm audit --audit-level=moderate
release:
  stage: release
  script:
    - echo tag master
`,
	}
	if withDockerfile {
		files["Dockerfile"] = "FROM node:20-alpine\nCOPY . .\nRUN npm ci\n"
	}
	for name, body := range files {
		full := filepath.Join(dir, name)
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(full, []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	return dir
}

func hasStage(pipe *config.Pipeline, name string) bool {
	for _, s := range pipe.Stages {
		if s.Name == name {
			return true
		}
	}
	return false
}

func stageNamesFromPipe(pipe *config.Pipeline) []string {
	out := make([]string, 0, len(pipe.Stages))
	for _, s := range pipe.Stages {
		out = append(out, s.Name)
	}
	return out
}
