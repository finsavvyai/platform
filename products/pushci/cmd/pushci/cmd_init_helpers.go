package main

import (
	"context"
	"fmt"

	"gopkg.in/yaml.v3"

	"github.com/finsavvyai/pushci/internal/ai"
	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/detect"
)

// aiPipeBetter and printInitAuthGuide live in cmd_init_helpers_ai.go.

// nodeFrameworkFromProjects returns the framework of the first Node project.
func nodeFrameworkFromProjects(projects []detect.Project) string {
	for _, p := range projects {
		if p.Stack == detect.Node && p.Framework != "" {
			return p.Framework
		}
	}
	return ""
}

// findPythonProject returns the first Python project from the list.
func findPythonProject(projects []detect.Project) detect.Project {
	for _, p := range projects {
		if p.Stack == detect.Python {
			return p
		}
	}
	return detect.Project{Stack: detect.Python}
}

func printDetectedProjects(root string, projects []detect.Project) {
	cli.Success(fmt.Sprintf("Found %d project(s)", len(projects)))
	for i, p := range projects {
		cli.Step(i+1, len(projects), fmt.Sprintf(
			"%s %s (%s)", cli.Bold(string(p.Stack)), p.Framework, p.Dir,
		))
	}
	if detect.IsTurboRepo(root) {
		tasks := detect.TurboTasks(root)
		cli.Info(fmt.Sprintf("Turborepo detected — %d tasks", len(tasks)))
	}
}

func printDeployTargets(deployTargets []detect.DeployTarget) {
	if len(deployTargets) == 0 {
		return
	}
	cli.Info(fmt.Sprintf("Deploy targets detected: %d", len(deployTargets)))
	for _, t := range deployTargets {
		fmt.Printf("    %s %s %s\n", cli.Green(">>"), cli.Bold(t.Platform), cli.Dim("("+t.ConfigFile+")"))
	}
}

func tryAIOptimize(ctx context.Context, sp *cli.Spinner, projects []detect.Project, pipe *config.Pipeline) *config.Pipeline {
	client := ai.NewClient()
	if !client.IsConfigured() {
		return pipe
	}
	sp.Start("AI optimizing pipeline...")
	generated, err := ai.GeneratePipeline(ctx, client, projects)
	sp.Stop(err == nil)
	if err != nil || generated == "" {
		return pipe
	}
	var aiPipe config.Pipeline
	if err := yaml.Unmarshal([]byte(generated), &aiPipe); err != nil {
		return pipe
	}
	// Guard against AI regression: the deterministic detector
	// always produces a stages-based pipeline with explicit
	// Run commands. If the AI returned a weaker shape — zero
	// stages, or flat checks whose Name isn't a real shell
	// command — its output is strictly worse than what we
	// already have. Keep the deterministic pipe. This is the
	// v1.4.3 dispatch regression: AI emitted `{name: build}`
	// with no Run, `pushci run` silently ignored the file and
	// fell through to auto-detect, and users thought their
	// config was working when it wasn't.
	if !aiPipeBetter(&aiPipe, pipe) {
		return pipe
	}
	return &aiPipe
}

// aiPipeBetter and printInitAuthGuide live in cmd_init_helpers_ai.go.
