package detect

import (
	"path/filepath"
	"testing"
)

// The big opensyber fixture lives in dogfood_opensyber_test.go. This
// file holds the smaller, focused scenarios.

// TestDogfood_LockfileDrivenBuildTool pins the priority order the
// dogfood report demanded: bun.lockb > pnpm-lock.yaml > yarn.lock >
// package-lock.json. A package.json alone falls back to npm.
func TestDogfood_LockfileDrivenBuildTool(t *testing.T) {
	cases := []struct {
		name     string
		files    map[string]string
		wantTool BuildTool
	}{
		{
			name: "bun wins over everything",
			files: map[string]string{
				"package.json":      `{}`,
				"bun.lockb":         "\x00",
				"pnpm-lock.yaml":    "#",
				"yarn.lock":         "",
				"package-lock.json": "{}",
			},
			wantTool: ToolBun,
		},
		{
			name: "pnpm wins over yarn+npm",
			files: map[string]string{
				"package.json":      `{}`,
				"pnpm-lock.yaml":    "#",
				"yarn.lock":         "",
				"package-lock.json": "{}",
			},
			wantTool: ToolPnpm,
		},
		{
			name: "yarn wins over npm",
			files: map[string]string{
				"package.json":      `{}`,
				"yarn.lock":         "",
				"package-lock.json": "{}",
			},
			wantTool: ToolYarn,
		},
		{
			name: "npm default when only package-lock present",
			files: map[string]string{
				"package.json":      `{}`,
				"package-lock.json": "{}",
			},
			wantTool: ToolNpm,
		},
		{
			name: "bare package.json defaults to npm",
			files: map[string]string{
				"package.json": `{}`,
			},
			wantTool: ToolNpm,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			dir := t.TempDir()
			for name, body := range tc.files {
				writeFile(t, dir, name, body)
			}
			projects := Scan(dir)
			nodes := filterStack(projects, Node)
			if len(nodes) != 1 {
				t.Fatalf("expected 1 Node project, got %d: %+v", len(nodes), nodes)
			}
			if nodes[0].BuildTool != tc.wantTool {
				t.Errorf("BuildTool = %q, want %q", nodes[0].BuildTool, tc.wantTool)
			}
		})
	}
}

// TestDogfood_IgnoredDirectories lists every directory that must be
// skipped during the scan. New build tools add new artifact
// conventions — keep this list honest.
func TestDogfood_IgnoredDirectories(t *testing.T) {
	ignored := []string{
		".next",
		".turbo",
		".cache",
		".svelte-kit",
		".nuxt",
		".output",
		".angular",
		".expo",
		".parcel-cache",
		".docusaurus",
		"coverage",
		"out",
	}
	for _, d := range ignored {
		t.Run(d, func(t *testing.T) {
			root := t.TempDir()
			// Root project so the scan has *something* to find.
			writeFile(t, root, "Dockerfile", "FROM alpine")
			// Artifact directory that should be invisible.
			writeFile(t, filepath.Join(root, d), "package.json", `{}`)

			projects := Scan(root)
			for _, p := range projects {
				if containsPathSegment(p.Dir, d) {
					t.Errorf("directory %q was not ignored; found project %+v", d, p)
				}
			}
		})
	}
}

// Shared helpers (writeFile, filterStack, containsPathSegment) live
// in dogfood_helpers_test.go.
