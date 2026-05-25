package main

import (
	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/detect"
)

// buildTurboStages emits the canonical Turborepo pipeline:
// install → lint → test → build. install uses the detected package
// manager with frozen-lockfile semantics.
func buildTurboStages(tool detect.BuildTool) []config.Stage {
	return []config.Stage{
		{
			Name:   "install",
			Checks: []config.Check{{Name: "deps", Run: installCmdForTool(tool)}},
		},
		{
			Name:      "lint",
			DependsOn: []string{"install"},
			Checks:    []config.Check{{Name: "turbo-lint", Run: "npx turbo lint"}},
		},
		{
			Name:      "test",
			DependsOn: []string{"install"},
			Checks:    []config.Check{{Name: "turbo-test", Run: "npx turbo test"}},
		},
		{
			Name:      "build",
			DependsOn: []string{"install"},
			Checks:    []config.Check{{Name: "turbo-build", Run: "npx turbo build"}},
		},
	}
}

// installCmdForTool returns the canonical install command for a Node
// package manager with frozen-lockfile mode so CI fails on drift.
func installCmdForTool(tool detect.BuildTool) string {
	switch tool {
	case detect.ToolBun:
		return "bun install --frozen-lockfile"
	case detect.ToolPnpm:
		return "pnpm install --frozen-lockfile"
	case detect.ToolYarn:
		return "yarn install --frozen-lockfile"
	default:
		return "npm ci"
	}
}
