package main

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/finsavvyai/pushci/internal/detect"
)

// Norlys pos-dk dogfood (2026-05-02): a pnpm+turbo monorepo with a
// custom .github/workflows/build.yml whose steps the importer cannot
// map. The GH Actions migrator returned "Migrated 0 steps" and the
// generated pushci.yml contained only `on: [push, pull_request]` —
// zero stages. Heuristic merge had been gated off for GitHub Actions
// migrations, so the empty-pipe edge case fell through.
//
// Fix in cmd_init_source_header.go: allow heuristic merge when the
// GitHub Actions importer produced zero stages.
func TestInitNorlysPosDkRegression_TurboStagesMergeAfterEmptyGHA(t *testing.T) {
	dir := seedNorlysPosDkFixture(t)

	origArgs := os.Args
	defer func() { os.Args = origArgs }()
	os.Args = []string{"pushci", "init", "--force", "--non-interactive"}

	src := pickMigrationSource(dir)
	if src.Pipeline == nil || !src.FromGenericCI || src.GenericCIKind != "github" {
		t.Fatalf("expected GitHub Actions migration source; got %+v", src)
	}
	if len(src.Pipeline.Stages) != 0 {
		t.Fatalf("expected 0 migrated stages from unmappable workflow; got %d: %v",
			len(src.Pipeline.Stages), stageNamesFromPipe(src.Pipeline))
	}

	projects := detect.Scan(dir)
	mergeSecondaryHeuristic(src.Pipeline, src, dir, projects, nil)

	want := []string{"heur-install", "heur-lint", "heur-test", "heur-build"}
	for _, name := range want {
		if !hasStage(src.Pipeline, name) {
			t.Errorf("expected turbo stage %q after merge; got %v",
				name, stageNamesFromPipe(src.Pipeline))
		}
	}
}

// seedNorlysPosDkFixture writes a minimal pnpm+turbo workspace plus
// a GitHub Actions workflow whose steps the importer cannot map
// (custom shell only, no recognised actions/setup-node etc.). This
// reproduces the exact shape of Norlys-A-S/pos-dk that triggered
// the empty-stages bug.
func seedNorlysPosDkFixture(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	files := map[string]string{
		"package.json": `{
  "name": "toca",
  "private": true,
  "packageManager": "pnpm@9.15.9",
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint"
  },
  "devDependencies": {"turbo": "^1.13.4"}
}
`,
		"turbo.json": `{"$schema":"https://turbo.build/schema.json","pipeline":{"build":{},"test":{},"lint":{}}}
`,
		"pnpm-workspace.yaml": "packages:\n  - 'packages/*'\n",
		".github/workflows/build.yml": `name: build
on:
  workflow_call:
  workflow_dispatch:
jobs:
  build-services:
    permissions:
      id-token: write
    uses: ./.github/workflows/build-services.yml
    secrets: inherit
  build-pos:
    permissions:
      id-token: write
    uses: ./.github/workflows/build-pos.yml
    secrets: inherit
`,
		".github/workflows/build-services.yml": `name: build-services
on:
  workflow_call:
jobs:
  noop:
    uses: ./.github/workflows/template-service-build.yml
`,
		".github/workflows/build-pos.yml": `name: build-pos
on:
  workflow_call:
jobs:
  noop:
    uses: ./.github/workflows/template-service-build.yml
`,
		"packages/app/package.json": `{"name":"app","scripts":{"build":"echo build","test":"echo test","lint":"echo lint"}}
`,
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
