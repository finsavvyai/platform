package actions

import (
	"bufio"
	"context"
	"fmt"
	"os/exec"
	"strings"
)

// splitColumns lives in list_parse.go.

// JobInfo describes a single job act has discovered in a workflow file.
// The fields mirror the columns of `act --list`.
type JobInfo struct {
	Stage    string // execution stage / order
	JobID    string // YAML key under jobs:
	JobName  string // jobs.<id>.name or JobID
	Workflow string // workflow .name field
	File     string // workflow file name
	Events   string // comma-separated triggers
}

// ListJobs runs `act --list` against the given workflows directory and
// parses the tab-separated output. It is the canonical way to enumerate
// jobs without spawning containers, so the dispatcher and CLI both rely
// on it for dry-run validation and job pickers.
func ListJobs(ctx context.Context, opts RunOptions) ([]JobInfo, error) {
	bin, err := ActBinary()
	if err != nil {
		return nil, err
	}
	args := []string{"--list"}
	if opts.WorkflowsDir != "" {
		args = append(args, "--workflows", opts.WorkflowsDir)
	}
	if opts.Event != "" {
		args = append(args, opts.Event)
	}
	cmd := exec.CommandContext(ctx, bin, args...)
	if opts.WorkingDir != "" {
		cmd.Dir = opts.WorkingDir
	}
	out, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("act --list failed: %w (output: %s)", err, strings.TrimSpace(string(out)))
	}
	return parseListOutput(string(out))
}

// parseListOutput is split out for unit testing — feed it captured
// fixture output and verify column extraction without needing act.
func parseListOutput(s string) ([]JobInfo, error) {
	var jobs []JobInfo
	sc := bufio.NewScanner(strings.NewReader(s))
	headerSeen := false
	for sc.Scan() {
		line := sc.Text()
		// Skip act's info logger noise that prefixes the table.
		if strings.Contains(line, "level=") || strings.TrimSpace(line) == "" {
			continue
		}
		fields := splitColumns(line)
		if len(fields) < 6 {
			continue
		}
		if !headerSeen {
			// First valid row with the expected column count is the
			// header. Skip it but flip the flag.
			if strings.EqualFold(fields[0], "Stage") {
				headerSeen = true
				continue
			}
		}
		jobs = append(jobs, JobInfo{
			Stage:    fields[0],
			JobID:    fields[1],
			JobName:  fields[2],
			Workflow: fields[3],
			File:     fields[4],
			Events:   fields[5],
		})
	}
	if err := sc.Err(); err != nil {
		return nil, err
	}
	return jobs, nil
}

// splitColumns lives in list_parse.go.
