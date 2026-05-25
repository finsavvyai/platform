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

func runAutoDetect(ctx context.Context, root string, args []string, parallel, trace bool, pipe *config.Pipeline) error {
	sp := cli.NewSpinner()
	sp.Start("Scanning projects...")
	projects := detect.Scan(root)
	sp.Stop(len(projects) > 0)

	if len(projects) == 0 {
		cli.Warn("No projects detected. Run: pushci init")
		return nil
	}

	if detect.IsMonorepo(root) && !hasFlag(args, "--all") {
		projects = filterAffectedProjects(root, projects)
	}

	cli.Info(fmt.Sprintf("Running %d project(s)...", len(projects)))

	run, tracer := executeRun(ctx, root, projects, parallel, trace)
	writeTraceIfNeeded(trace, tracer, root)

	return processRunResults(ctx, root, run, projects, pipe)
}

func executeRun(ctx context.Context, root string, projects []detect.Project, parallel, trace bool) (*runner.Run, *observe.Tracer) {
	var tracer *observe.Tracer
	if trace {
		tracer = observe.NewTracer()
	}
	if parallel {
		cli.Info("Parallel mode — 4 workers")
		return runner.ExecuteParallel(ctx, root, projects, 4), tracer
	}
	return runner.ExecuteWithTracer(ctx, root, projects, tracer), tracer
}

func writeTraceIfNeeded(trace bool, tracer *observe.Tracer, root string) {
	if !trace || tracer == nil {
		return
	}
	runID := fmt.Sprintf("local-%d", time.Now().Unix())
	if path, err := observe.WriteTraceFile(tracer, root, runID); err == nil {
		cli.Info(fmt.Sprintf("Trace saved: %s", path))
		cli.Info("View in Perfetto: pushci trace --open")
	}
	observe.PrintTraceSummary(tracer)
}
