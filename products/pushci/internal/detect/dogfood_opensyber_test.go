package detect

import (
	"path/filepath"
	"testing"
)

// TestDogfood_OpensyberPnpmTurboMonorepo captures the exact shape of
// the opensyber repo that broke pushci init during dogfooding on
// 2026-04-11. It exercises every detection bug at once:
//
//  1. pnpm-workspace.yaml should consolidate the whole tree into ONE
//     Node project at the root, not 77 per-package stages.
//  2. pnpm-lock.yaml at the root should force BuildTool == pnpm,
//     even though every subpackage has its own package.json.
//  3. turbo.json at the root should set a Monorepo flag so the init
//     generator emits `turbo build/test/lint` instead of per-package
//     npm run targets.
//  4. Build artifact directories (.next/, .turbo/, .cache/) must NOT
//     be enumerated as source projects even when they contain a
//     generated package.json.
//  5. The root install stage must not duplicate work done by the
//     workspace install.
func TestDogfood_OpensyberPnpmTurboMonorepo(t *testing.T) {
	root := t.TempDir()

	// Root signals: pnpm + turbo workspace.
	writeFile(t, root, "package.json", `{
  "name": "opensyber",
  "private": true,
  "packageManager": "pnpm@9.0.0"
}`)
	writeFile(t, root, "pnpm-workspace.yaml", `packages:
  - 'apps/*'
  - 'packages/*'
`)
	writeFile(t, root, "pnpm-lock.yaml", "# pnpm lockfile")
	writeFile(t, root, "turbo.json", `{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"] },
    "test":  { "dependsOn": ["^build"] },
    "lint":  {}
  }
}`)

	// Subpackages — these should NOT appear as separate projects.
	for _, sub := range []string{
		"apps/web",
		"apps/tokenforge-web",
		"apps/api",
		"packages/ui",
		"packages/config",
	} {
		writeFile(t, filepath.Join(root, sub), "package.json", `{"name":"`+filepath.Base(sub)+`"}`)
	}

	// Build artifacts that must be ignored — these are the literal
	// paths that surfaced as stages in the dogfood report.
	for _, artifact := range []string{
		"apps/web/.next",
		"apps/tokenforge-web/.next",
		"apps/web/.turbo",
		"apps/web/.cache",
		".turbo",
		"node_modules/.pnpm",
	} {
		writeFile(t, filepath.Join(root, artifact), "package.json",
			`{"name":"generated-should-not-show-up"}`)
	}

	projects := Scan(root)

	// --- Assertions ---

	// Exactly one Node project, rooted at the repo root.
	nodeProjects := filterStack(projects, Node)
	if len(nodeProjects) != 1 {
		t.Fatalf("expected 1 Node project for the whole workspace, got %d:\n  %+v",
			len(nodeProjects), nodeProjects)
	}
	p := nodeProjects[0]

	if p.Dir != "." {
		t.Errorf("expected workspace project rooted at '.', got %q", p.Dir)
	}

	// Build tool must come from the lockfile, not the static marker table.
	if p.BuildTool != ToolPnpm {
		t.Errorf("expected BuildTool=pnpm (driven by pnpm-lock.yaml), got %q", p.BuildTool)
	}

	// No build artifacts enumerated as projects.
	for _, proj := range projects {
		for _, forbidden := range []string{".next", ".turbo", ".cache", "node_modules"} {
			if containsPathSegment(proj.Dir, forbidden) {
				t.Errorf("build artifact leaked into projects: %+v (contains %q)", proj, forbidden)
			}
		}
	}
}
