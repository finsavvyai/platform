package main

import (
	"context"
	"fmt"

	"github.com/finsavvyai/pushci/internal/cli"
)

// cmdTriggerList enumerates workflows in the current repo via the
// GitHub REST API. Shows workflow IDs + filenames so users can pick
// one to trigger.
func cmdTriggerList(ctx context.Context) error {
	client, owner, repo, err := newTriggerClient()
	if err != nil {
		return err
	}
	cli.Header(fmt.Sprintf("Workflows: %s/%s", owner, repo))
	wfs, err := client.listWorkflows(ctx, owner, repo)
	if err != nil {
		return fmt.Errorf("list workflows: %w", err)
	}
	rows := make([][]string, 0, len(wfs))
	for _, wf := range wfs {
		rows = append(rows, []string{fmt.Sprintf("%d", wf.ID), wf.Name, wf.Path, wf.State})
	}
	cli.Table([]string{"ID", "NAME", "PATH", "STATE"}, rows)
	return nil
}

// cmdTriggerDispatch fires one or more workflow_dispatch events. When
// an input value contains commas we fan out: one dispatch per matrix
// cell. After each dispatch we poll for the newly-created run and
// print its HTML URL, plus optionally stream status via watch.
func cmdTriggerDispatch(ctx context.Context, args []string) error {
	opts, err := parseTriggerFlags(args)
	if err != nil {
		return err
	}
	client, owner, repo, err := newTriggerClient()
	if err != nil {
		return err
	}
	cli.Header(fmt.Sprintf("Trigger: %s → %s/%s@%s", opts.Workflow, owner, repo, opts.Ref))
	cells := expandMatrix(opts.Inputs)
	for i, cell := range cells {
		if err := runOneDispatch(ctx, client, owner, repo, opts, cell, i, len(cells)); err != nil {
			return err
		}
	}
	return nil
}

// runOneDispatch handles a single matrix cell: fire, locate the run,
// optionally watch. Extracted to keep cmdTriggerDispatch short enough
// to comply with the 100-line production-file cap.
func runOneDispatch(ctx context.Context, client *triggerClient, owner, repo string,
	opts *triggerOptions, cell map[string]string, i, total int) error {
	if total > 1 {
		cli.Info(fmt.Sprintf("Dispatch %d/%d: %v", i+1, total, cell))
	}
	if err := client.dispatch(ctx, owner, repo, opts.Workflow, opts.Ref, cell); err != nil {
		return fmt.Errorf("dispatch: %w", err)
	}
	run, err := client.findLatestRun(ctx, owner, repo, opts.Workflow)
	if err != nil {
		cli.Warn("dispatched but run lookup failed: " + err.Error())
		return nil
	}
	cli.Success(fmt.Sprintf("Run #%d: %s", run.RunNumber, run.HTMLURL))
	if opts.Watch {
		return watchRun(ctx, client, owner, repo, run.ID)
	}
	return nil
}
