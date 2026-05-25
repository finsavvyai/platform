package main

// Opt-in semantic-heal indexing. Set PUSHCI_VECTOR_INDEX=1 to index
// every run into the local vector store. Best-effort: any error is
// swallowed so the run's primary result is never affected.

import (
	"context"
	"os"
	"time"

	"github.com/finsavvyai/pushci/internal/heal"
	"github.com/finsavvyai/pushci/internal/runner"
)

func maybeIndexRunForSemanticHeal(ctx context.Context, run *runner.Run) {
	if os.Getenv("PUSHCI_VECTOR_INDEX") != "1" || run == nil {
		return
	}
	vs, err := heal.Open("")
	if err != nil {
		return
	}
	for _, r := range run.Results {
		rec := heal.RunRecord{
			Status:    statusOf(r.Passed),
			Stage:     r.Check,
			Command:   r.Check,
			ExitCode:  exitOf(r.Passed),
			Stderr:    r.Output,
			Timestamp: time.Now().UTC(),
			Outcome:   statusOf(r.Passed),
		}
		if fix := heal.DiagnoseOutput(r.Output); fix != nil {
			rec.RootCause = fix.Pattern
			rec.AppliedFix = fix.Action
		}
		_ = vs.Index(ctx, rec)
	}
}

func statusOf(passed bool) string {
	if passed {
		return "passed"
	}
	return "failed"
}

func exitOf(passed bool) int {
	if passed {
		return 0
	}
	return 1
}
