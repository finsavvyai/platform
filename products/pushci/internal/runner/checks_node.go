package runner

import (
	"encoding/json"
	"os"
	"path/filepath"

	"github.com/finsavvyai/pushci/internal/detect"
)

// nodeChecks returns the auto-detect check set for a Node project.
//
// Resolution order for test/build/lint:
//
//  1. If package.json has a matching `scripts.<name>` entry, emit
//     `<pkgmgr> run <name>` — this delegates bin resolution to the
//     package manager, which works uniformly across pnpm/yarn/bun
//     workspaces where the hoisted `.bin/` lives under the package
//     dir rather than the repo root. This is the Bug B fix: running
//     bare `npx vite build` from the root of a pnpm workspace fails
//     with "vite: not found" because `.bin/` is under `apps/web/`,
//     not under the root.
//  2. Otherwise fall back to the framework-aware bare-bin form
//     (`npx vite build`, `npx next build`, etc.) so repos without
//     script entries still run something sensible.
//
// tsc is always `npx tsc --noEmit` — there's no idiomatic
// script name for it and tsc is almost always a direct dep.
func nodeChecks(p detect.Project, dir string) []check {
	var c []check
	scripts := readPackageScripts(dir)
	tool := pkgmgrBin(p.BuildTool)

	c = append(c, check{"tsc", "npx", []string{"tsc", "--noEmit"}})

	if scripts["test"] {
		c = append(c, check{"test", tool, []string{"run", "test"}})
	} else {
		c = append(c, nodeTestCheck(p.Framework))
	}

	if scripts["build"] {
		c = append(c, check{"build", tool, []string{"run", "build"}})
	} else if b := nodeBuildCheck(p.Framework); b != nil {
		c = append(c, *b)
	}
	return c
}

// pkgmgrBin maps the detected BuildTool to its CLI binary name.
// Default is npm — matches the fallback in detect.DetectNodeBuildTool.
func pkgmgrBin(tool detect.BuildTool) string {
	switch tool {
	case detect.ToolPnpm:
		return "pnpm"
	case detect.ToolYarn:
		return "yarn"
	case detect.ToolBun:
		return "bun"
	default:
		return "npm"
	}
}

// readPackageScripts returns the set of script names defined in
// <dir>/package.json. Returns an empty map on any read/parse
// failure — callers just fall through to the bare-bin path, so a
// missing package.json is a silent no-op rather than an error.
func readPackageScripts(dir string) map[string]bool {
	out := map[string]bool{}
	data, err := os.ReadFile(filepath.Join(dir, "package.json"))
	if err != nil {
		return out
	}
	var pkg struct {
		Scripts map[string]string `json:"scripts"`
	}
	if err := json.Unmarshal(data, &pkg); err != nil {
		return out
	}
	for name := range pkg.Scripts {
		out[name] = true
	}
	return out
}

func nodeTestCheck(fw string) check {
	switch fw {
	case "nextjs", "expo":
		return check{"test", "npx", []string{"jest", "--passWithNoTests"}}
	default:
		return check{"test", "npx", []string{"vitest", "run"}}
	}
}

// nodeBuildCheck lives in checks_node_build.go.
