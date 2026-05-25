package server

import (
	"context"
	"fmt"
	"log"
	"os"
	"sync"
	"time"

	"github.com/finsavvyai/pushci/internal/actions"
	"github.com/finsavvyai/pushci/internal/platform"
	"github.com/finsavvyai/pushci/internal/runner"
)

// runPipeline orchestrates the full CI lifecycle for a single push event:
// pending status → run → final status → PR comment.
func (s *Server) runPipeline(provider platform.Provider, event *platform.Event) {
	ctx := context.Background()

	provider.PostStatus(ctx, event, &platform.Status{
		SHA: event.SHA, State: platform.StatePending,
		Context: "pushci/ci", Description: "Running checks...",
	})

	passed, summary, elapsed := s.dispatch(ctx, provider, event)

	state := platform.StateSuccess
	desc := fmt.Sprintf("All checks passed (%s)", elapsed)
	if !passed {
		state = platform.StateFailure
		desc = fmt.Sprintf("Checks failed (%s)", elapsed)
	}
	provider.PostStatus(ctx, event, &platform.Status{
		SHA: event.SHA, State: state,
		Context: "pushci/ci", Description: desc,
	})

	if event.PRNumber > 0 {
		provider.PostComment(ctx, event, summary)
	}
}

// dispatch chooses between the actions runner and the legacy pipeline
// runner based on what the repository contains. It returns the pass
// flag, a human-readable summary for PR comments, and elapsed time.
//
// Decision rules:
//  1. If .github/workflows/*.yml exists AND act is installed → actions
//  2. Else → legacy pushci.yml runner
func (s *Server) dispatch(ctx context.Context, provider platform.Provider, event *platform.Event) (bool, string, time.Duration) {
	if actions.HasWorkflows(s.repoRoot) {
		if _, err := actions.ActBinary(); err == nil {
			return s.dispatchActions(ctx, provider, event)
		}
		log.Printf("[dispatch] workflows detected but act binary missing — falling back to legacy runner")
	}
	return s.dispatchLegacy(ctx)
}

// dispatchActions routes the event through the act-backed runner and
// posts one GitHub status check per job as it runs.
func (s *Server) dispatchActions(ctx context.Context, provider platform.Provider, event *platform.Event) (bool, string, time.Duration) {
	events := make(chan actions.Event, 64)
	poster := newActionsStatusPoster(ctx, provider, event)
	var wg sync.WaitGroup
	wg.Add(1)
	go poster.stream(events, &wg)

	r := &actions.Runner{
		Stdout: os.Stdout,
		Stderr: os.Stderr,
		Events: events,
	}
	res, err := r.Run(ctx, actions.RunOptions{
		WorkingDir: s.repoRoot,
		Event:      "push",
		JSONLogs:   true,
	})
	close(events)
	wg.Wait()

	if err != nil {
		return false, fmt.Sprintf("workflow execution error: %v", err), res.Duration
	}
	return res.Success, buildStatusSummary(res.Success, res.ExitCode, len(poster.seen)), res.Duration
}

// dispatchLegacy preserves the original pushci.yml execution path so
// repos that haven't migrated yet keep working.
func (s *Server) dispatchLegacy(ctx context.Context) (bool, string, time.Duration) {
	result := runner.Execute(ctx, s.repoRoot, s.projects)
	return result.Passed, result.Summary(), result.Elapsed
}
