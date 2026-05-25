package main

import (
	"context"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/detect"
)

// aiOptimizePreservingDeploys wraps tryAIOptimize so user-chosen
// deploy targets survive the AI pass. The optimizer regenerates
// the pipeline from `projects` alone and has no knowledge of the
// `deploy:` block — when it succeeds, `pipe.Deploys` is always
// empty. v1.6.1 regression fix (teddk-go bug #4): any non-empty
// user deploy list wins unconditionally; we do not trust the AI
// to preserve OR re-guess deploy targets.
//
// Test seam: tests swap `aiOptimizeFn` to avoid hitting the
// network while still exercising the preservation logic.
var aiOptimizeFn = tryAIOptimize

func aiOptimizePreservingDeploys(
	ctx context.Context, sp *cli.Spinner,
	projects []detect.Project, pipe *config.Pipeline,
) *config.Pipeline {
	savedDeploys := pipe.Deploys
	pipe = aiOptimizeFn(ctx, sp, projects, pipe)
	if len(savedDeploys) > 0 {
		pipe.Deploys = savedDeploys
	}
	return pipe
}
