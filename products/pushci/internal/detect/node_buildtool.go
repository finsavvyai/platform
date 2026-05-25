package detect

import (
	"os"
	"path/filepath"
)

// DetectNodeBuildTool returns the package manager for a Node project
// at the given directory. It walks upward from that directory toward
// the repo root, returning as soon as it finds a lockfile. Priority
// order matches the dogfood report:
//
//	bun.lockb         → bun
//	pnpm-lock.yaml    → pnpm
//	yarn.lock         → yarn
//	package-lock.json → npm
//
// Falls back to npm when no lockfile is found. Walking upward is
// required for workspace subpackages whose package.json has no
// lockfile next to it — the lockfile lives at the workspace root.
//
// `repoRoot` caps the upward walk so we don't climb out of the
// project.
func DetectNodeBuildTool(dir, repoRoot string) BuildTool {
	// Priority list: first-found wins at each level, and levels are
	// walked from `dir` up to `repoRoot`.
	priority := []struct {
		file string
		tool BuildTool
	}{
		{"bun.lockb", ToolBun},
		{"pnpm-lock.yaml", ToolPnpm},
		{"yarn.lock", ToolYarn},
		{"package-lock.json", ToolNpm},
	}

	absDir, err := filepath.Abs(dir)
	if err != nil {
		return ToolNpm
	}
	absRoot, err := filepath.Abs(repoRoot)
	if err != nil {
		return ToolNpm
	}

	current := absDir
	for {
		for _, p := range priority {
			if fileExists(filepath.Join(current, p.file)) {
				return p.tool
			}
		}
		if current == absRoot {
			break
		}
		parent := filepath.Dir(current)
		if parent == current {
			break
		}
		// Safety: if we've walked above absRoot (different mount or
		// symlink drift), stop.
		rel, err := filepath.Rel(absRoot, parent)
		if err != nil || rel == ".." || len(rel) > 2 && rel[:3] == ".."+string(os.PathSeparator) {
			break
		}
		current = parent
	}
	return ToolNpm
}

// DetectNodeBuildToolAtRoot is a convenience for the common case
// where the caller already knows we're looking at a single root.
func DetectNodeBuildToolAtRoot(root string) BuildTool {
	return DetectNodeBuildTool(root, root)
}
