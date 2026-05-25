package runner

import (
	"path/filepath"
	"testing"

	"github.com/finsavvyai/pushci/internal/detect"
)

// TestPnpmWorkspace_EndToEnd is the v1.4.3 Bug B regression at
// the detect → checks integration level.
//
// detect.Scan surfaces the workspace *root* as a single Node
// project — it does not recurse into apps/* packages (that
// belongs to the init-time workspace detection path, which has
// its own dogfood test in internal/detect). For `pushci run`
// auto-detect, the only thing that matters is: given the root
// project of a pnpm workspace, what commands does the runner
// emit?
//
// Pre-Bug-B: `npx vite build` from the root. Fails with
// "vite: not found" because pnpm does not hoist bin to the
// workspace root (only to the package that declares the dep).
//
// Post-Bug-B: `pnpm run build` from the root, which delegates
// to the root's `scripts.build` — which in turn runs
// `pnpm -r build` to build every workspace package from its
// own directory, where the hoisted bin actually exists.
//
// The fixture's root package.json has a build script, so the
// scripts-aware path kicks in instead of the bare-bin fallback.
// That is the exact shape the user's tenantiq repo had.
func TestPnpmWorkspace_EndToEnd(t *testing.T) {
	fixture, err := filepath.Abs(filepath.Join("testdata", "pnpm_workspace_fixture"))
	if err != nil {
		t.Fatal(err)
	}

	projects := detect.Scan(fixture)
	if len(projects) != 1 {
		t.Fatalf("detect.Scan found %d projects, want 1 (the root) — workspace detection changed shape", len(projects))
	}
	root := projects[0]
	if root.Stack != detect.Node {
		t.Fatalf("root project stack = %q, want node", root.Stack)
	}
	if root.BuildTool != detect.ToolPnpm {
		t.Fatalf("root project build tool = %q, want pnpm (lockfile-driven detection broken)", root.BuildTool)
	}

	checks := checksForProject(root, fixture)
	if len(checks) < 3 {
		t.Fatalf("got %d checks, want >= 3 (tsc, test, build)", len(checks))
	}

	assertPnpmShape(t, "build", checks)
	assertPnpmShape(t, "test", checks)
}

// assertPnpmShape walks checks for one named step and confirms
// it uses `pnpm run <name>` rather than the bare-bin fallback.
// The cmd field is the program we exec; args[0..1] must be
// `run <name>`. Anything else is the v1.4.3 regression.
func assertPnpmShape(t *testing.T, stepName string, checks []check) {
	t.Helper()
	for _, c := range checks {
		if c.name != stepName {
			continue
		}
		if c.cmd != "pnpm" {
			t.Errorf("%s cmd = %q, want pnpm — Bug B: bare npx fails in pnpm workspaces", stepName, c.cmd)
			return
		}
		if len(c.args) < 2 || c.args[0] != "run" || c.args[1] != stepName {
			t.Errorf("%s args = %v, want [run %s]", stepName, c.args, stepName)
		}
		return
	}
	t.Errorf("no %s check emitted for the fixture", stepName)
}
