package main

import (
	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/detect"
)

func generatePipeline(root string, projects []detect.Project, deployTargets []detect.DeployTarget) *config.Pipeline {
	stacks := map[detect.Stack]bool{}
	dirs := map[string]bool{}
	for _, p := range projects {
		stacks[p.Stack] = true
		if p.Dir != "" && p.Dir != "." {
			dirs[p.Dir] = true
		}
	}

	stages := pickStages(root, projects, stacks, dirs)

	var nonEmpty []config.Stage
	for _, s := range stages {
		if len(s.Checks) > 0 {
			nonEmpty = append(nonEmpty, s)
		}
	}
	nonEmpty = validateDependsOn(nonEmpty)

	return &config.Pipeline{
		On:      []string{"push", "pull_request"},
		Stages:  nonEmpty,
		Deploys: pickDeployTargets(deployTargets),
	}
}

// pickStages emits turbo-canonical stages when the repo is a workspace
// with turbo.json (avoids opensyber's 77-stage explosion), monorepo
// stages when multiple project dirs are present, or single-project
// scaffolding otherwise.
func pickStages(root string, projects []detect.Project, stacks map[detect.Stack]bool, dirs map[string]bool) []config.Stage {
	ws := detect.DetectWorkspace(root)
	switch {
	case ws.IsWorkspace && ws.IsTurbo:
		return buildTurboStages(nodeBuildTool(projects))
	case len(dirs) > 1:
		return buildMonorepoStages(root, projects)
	default:
		return buildSingleProjectStages(root, stacks, projects, singleDir(dirs))
	}
}

// nodeBuildTool returns the build tool from the first Node project in
// the list, defaulting to npm when no Node project is present.
func nodeBuildTool(projects []detect.Project) detect.BuildTool {
	for _, p := range projects {
		if p.Stack == detect.Node && p.BuildTool != "" {
			return p.BuildTool
		}
	}
	return detect.ToolNpm
}

func singleDir(dirs map[string]bool) string {
	if len(dirs) == 1 {
		for d := range dirs {
			return d
		}
	}
	return ""
}

func resolveDeployTarget(targets []detect.DeployTarget) []config.DeployTarget {
	return pickDeployTargets(targets)
}
