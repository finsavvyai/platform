package main

import (
	"context"
	"testing"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/detect"
)

// teddk-go bug #4: when pushci init's AI optimize pass runs, it
// regenerates a pipeline from `projects` alone and returns an
// empty Deploys slice. Before v1.6.1 that silently stripped the
// user-chosen deploy target. The wrapper below must preserve it.
func TestInitAIOptimizeDeployRegression_PreservesUserDeploys(t *testing.T) {
	orig := aiOptimizeFn
	defer func() { aiOptimizeFn = orig }()

	// Worst case: AI returns a valid pipeline with stages but
	// zero deploys (what the real Claude optimizer does today).
	aiOptimizeFn = func(ctx context.Context, sp *cli.Spinner,
		projects []detect.Project, pipe *config.Pipeline) *config.Pipeline {
		return &config.Pipeline{
			Stages:  []config.Stage{{Name: "test", Checks: []config.Check{{Run: "go test ./..."}}}},
			Deploys: nil,
		}
	}

	user := []config.DeployTarget{{Name: "docker-compose", Run: "docker-compose up -d"}}
	input := &config.Pipeline{
		Stages:  []config.Stage{{Name: "test", Checks: []config.Check{{Run: "go test ./..."}}}},
		Deploys: user,
	}

	out := aiOptimizePreservingDeploys(context.Background(), cli.NewSpinner(), nil, input)

	if len(out.Deploys) != 1 || out.Deploys[0].Name != "docker-compose" {
		t.Fatalf("user deploy stripped by AI pass; got %+v", out.Deploys)
	}
}

// Also verify: when AI returns its OWN deploys (future behavior
// if GeneratePipeline ever learns about deploys), user's explicit
// picks still win. This locks in the "user picks are sacred" rule.
func TestInitAIOptimizeDeployRegression_UserWinsOverAIDeploys(t *testing.T) {
	orig := aiOptimizeFn
	defer func() { aiOptimizeFn = orig }()
	aiOptimizeFn = func(ctx context.Context, sp *cli.Spinner,
		projects []detect.Project, pipe *config.Pipeline) *config.Pipeline {
		return &config.Pipeline{
			Stages:  []config.Stage{{Name: "test", Checks: []config.Check{{Run: "go test ./..."}}}},
			Deploys: []config.DeployTarget{{Name: "ai-guessed-fly-io"}},
		}
	}
	user := []config.DeployTarget{{Name: "docker-compose", Run: "docker-compose up -d"}}
	input := &config.Pipeline{Deploys: user}
	out := aiOptimizePreservingDeploys(context.Background(), cli.NewSpinner(), nil, input)
	if len(out.Deploys) != 1 || out.Deploys[0].Name != "docker-compose" {
		t.Fatalf("AI-guessed deploy overrode user choice; got %+v", out.Deploys)
	}
}

// When the user did NOT pick a deploy (empty), we accept the AI's
// deploys if it produced any. Guards against the opposite bug.
func TestInitAIOptimizeDeployRegression_NoUserDeployAllowsAIDeploys(t *testing.T) {
	orig := aiOptimizeFn
	defer func() { aiOptimizeFn = orig }()
	aiOptimizeFn = func(ctx context.Context, sp *cli.Spinner,
		projects []detect.Project, pipe *config.Pipeline) *config.Pipeline {
		return &config.Pipeline{
			Deploys: []config.DeployTarget{{Name: "ai-suggested"}},
		}
	}
	input := &config.Pipeline{Deploys: nil}
	out := aiOptimizePreservingDeploys(context.Background(), cli.NewSpinner(), nil, input)
	if len(out.Deploys) != 1 || out.Deploys[0].Name != "ai-suggested" {
		t.Fatalf("AI deploys dropped when user had none; got %+v", out.Deploys)
	}
}
