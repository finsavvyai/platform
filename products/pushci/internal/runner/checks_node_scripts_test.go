package runner

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/finsavvyai/pushci/internal/detect"
)

// Regression tests for v1.4.3 Bug B: `pushci run` auto-detect
// ran `npx vite build` from the repo root in a pnpm workspace
// and failed with "vite: not found" because pnpm's hoisted bin
// lives under `apps/web/node_modules/.bin/`, not the root.
//
// The fix: when package.json has a matching `scripts.<name>`
// entry, prefer `<pkgmgr> run <name>` so the package manager
// resolves the bin from the right place.

func writePackageJSON(t *testing.T, dir, body string) {
	t.Helper()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "package.json"), []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestNodeChecks_PnpmWithBuildScript_UsesPnpmRun(t *testing.T) {
	dir := t.TempDir()
	writePackageJSON(t, dir, `{"name":"web","scripts":{"build":"vite build","test":"vitest run"}}`)

	p := detect.Project{Stack: detect.Node, Framework: "vite", BuildTool: detect.ToolPnpm}
	checks := checksForProject(p, dir)
	if len(checks) != 3 {
		t.Fatalf("got %d checks, want 3", len(checks))
	}

	build := checks[2]
	if build.cmd != "pnpm" {
		t.Errorf("build cmd = %q, want pnpm (bare `npx vite build` was the v1.4.3 monorepo regression)", build.cmd)
	}
	if build.args[0] != "run" || build.args[1] != "build" {
		t.Errorf("build args = %v, want [run build]", build.args)
	}

	test := checks[1]
	if test.cmd != "pnpm" {
		t.Errorf("test cmd = %q, want pnpm", test.cmd)
	}
}

func TestNodeChecks_NoPackageJSON_FallsBackToBareBin(t *testing.T) {
	dir := t.TempDir()
	// No package.json — prior fallback path must still work so
	// we don't break frameworks without script entries.
	p := detect.Project{Stack: detect.Node, Framework: "vite", BuildTool: detect.ToolPnpm}
	checks := checksForProject(p, dir)
	if len(checks) != 3 {
		t.Fatalf("got %d checks, want 3", len(checks))
	}
	if checks[2].cmd != "npx" || checks[2].args[0] != "vite" {
		t.Errorf("fallback build = %q %v, want npx vite build", checks[2].cmd, checks[2].args)
	}
}

func TestNodeChecks_NpmTool_UsesNpmRun(t *testing.T) {
	dir := t.TempDir()
	writePackageJSON(t, dir, `{"name":"app","scripts":{"build":"webpack","test":"jest"}}`)

	p := detect.Project{Stack: detect.Node, Framework: "", BuildTool: detect.ToolNpm}
	checks := checksForProject(p, dir)

	if checks[2].cmd != "npm" {
		t.Errorf("build cmd = %q, want npm", checks[2].cmd)
	}
	if checks[1].cmd != "npm" {
		t.Errorf("test cmd = %q, want npm", checks[1].cmd)
	}
}

func TestNodeChecks_PkgJSONWithoutBuildScript_BareBinFallback(t *testing.T) {
	dir := t.TempDir()
	writePackageJSON(t, dir, `{"name":"app","scripts":{"lint":"eslint ."}}`)

	p := detect.Project{Stack: detect.Node, Framework: "astro", BuildTool: detect.ToolPnpm}
	checks := checksForProject(p, dir)

	if checks[2].cmd != "npx" || checks[2].args[0] != "astro" {
		t.Errorf("build = %q %v, want npx astro build", checks[2].cmd, checks[2].args)
	}
}
