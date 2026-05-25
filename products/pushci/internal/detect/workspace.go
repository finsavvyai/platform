package detect

import (
	"path/filepath"
)

// WorkspaceInfo captures the monorepo signals the scanner uses to
// consolidate per-package stages into a single root project.
type WorkspaceInfo struct {
	// IsWorkspace is true when the root is a Node workspace of some
	// flavour (pnpm, npm, yarn, bun). Callers use this to suppress
	// per-subpackage enumeration.
	IsWorkspace bool

	// Flavour is the workspace style — "pnpm", "npm", "yarn", or "bun".
	// Derived from the lockfile + workspace manifest combination.
	Flavour string

	// IsTurbo is true when turbo.json is present at the root. When
	// true, init should emit `turbo build/test/lint` instead of
	// iterating workspaces.
	IsTurbo bool

	// Packages lists the directories matched by the workspace globs.
	// Informational — the scanner does NOT turn these into Project
	// entries; they're rolled up under the root project.
	Packages []string
}

// DetectWorkspace inspects the repo root for workspace signals. It is
// the canonical entry point that both scan.go and cmd_init consult
// before enumerating per-package projects.
//
// Priority of the workspace flavour:
//
//	pnpm-workspace.yaml present             → pnpm workspace
//	package.json has "workspaces" + bun.lockb → bun workspace
//	package.json has "workspaces"           → npm/yarn workspace
//	                                          (use lockfile to pick)
func DetectWorkspace(root string) WorkspaceInfo {
	info := WorkspaceInfo{
		IsTurbo: fileExists(filepath.Join(root, "turbo.json")),
	}

	// pnpm: pnpm-workspace.yaml is authoritative even without a
	// lockfile, because a fresh clone may not have run `pnpm install`
	// yet.
	if fileExists(filepath.Join(root, "pnpm-workspace.yaml")) {
		info.IsWorkspace = true
		info.Flavour = "pnpm"
		info.Packages = resolvePnpmWorkspaces(root)
		return info
	}

	// npm/yarn/bun: package.json with "workspaces" array.
	if pkgs := readNpmWorkspaces(root); pkgs != nil {
		info.IsWorkspace = true
		info.Packages = pkgs
		switch DetectNodeBuildToolAtRoot(root) {
		case ToolBun:
			info.Flavour = "bun"
		case ToolYarn:
			info.Flavour = "yarn"
		default:
			info.Flavour = "npm"
		}
	}
	return info
}

// readNpmWorkspaces and expandGlobs live in workspace_npm.go.
