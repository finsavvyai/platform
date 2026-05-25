package main

import (
	"context"
	"fmt"
	"time"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/detect"
	"github.com/finsavvyai/pushci/internal/observe"
	"github.com/finsavvyai/pushci/internal/runner"
)

// recordPipelineRun persists a pipeline-mode run (used by runWithStages and
// runWithEngine). The auto-detect path uses processRunResults instead.
func recordPipelineRun(passed bool, elapsed time.Duration, started time.Time) {
	collector := observe.LoadCollector()
	saved := elapsed.Seconds() * 0.008 / 60
	collector.Record(observe.RunRecord{
		ID: fmt.Sprintf("local-%d", time.Now().Unix()), Passed: passed,
		Duration: elapsed, Timestamp: started, CostSaved: saved,
	})
}

func processRunResults(ctx context.Context, root string, run *runner.Run, projects []detect.Project, pipe *config.Pipeline) error {
	collector := observe.LoadCollector()
	saved := run.Elapsed.Seconds() * 0.008 / 60
	collector.Record(observe.RunRecord{
		ID: fmt.Sprintf("local-%d", time.Now().Unix()), Passed: run.Passed,
		Duration: run.Elapsed, Timestamp: run.Started, CostSaved: saved,
	})

	printRunResults(run)
	skillFailed := runInstalledSkills(ctx, root)

	metrics := collector.BuildMetricsSummary()
	if metrics.CostSaved > 0 {
		cli.Info(fmt.Sprintf("Saved ~$%.4f vs GitHub Actions", metrics.CostSaved))
	}

	sendNotifications(pipe, run, root)
	maybeIndexRunForSemanticHeal(ctx, run)

	if !run.Passed || skillFailed {
		printFailureSummary(run)
		failed := countFailed(run)
		if skillFailed {
			failed++
		}
		return fmt.Errorf("%d check(s) failed", failed)
	}

	cli.Success("All checks passed")
	sendTelemetry("run", projects)
	reportRun(run)
	return nil
}
