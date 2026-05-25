package debug

import (
	"context"
	"fmt"
	"time"

	"github.com/finsavvyai/pushci/internal/detect"
	"github.com/finsavvyai/pushci/internal/runner"
)

// DebugState holds current debugging state for inspection.
type DebugState struct {
	Completed []runner.Result
	Current   string
	Env       map[string]string
	Paused    bool
}

// DebugRunner wraps a runner with breakpoint support.
type DebugRunner struct {
	state  DebugState
	pause  chan struct{}
	resume chan struct{}
}

// NewDebugRunner creates a new debug runner.
func NewDebugRunner() *DebugRunner {
	return &DebugRunner{
		pause:  make(chan struct{}, 1),
		resume: make(chan struct{}, 1),
	}
}

// RunWithBreakpoints executes checks, pausing after breakAfter.
func (d *DebugRunner) RunWithBreakpoints(
	ctx context.Context,
	root string,
	projects []detect.Project,
	breakAfter string,
) *runner.Run {
	run := &runner.Run{Started: time.Now()}
	result := runner.Execute(ctx, root, projects)

	for i, r := range result.Results {
		d.state.Current = r.Check
		d.state.Completed = append(d.state.Completed, r)
		run.Results = append(run.Results, r)

		if shouldBreak(r.Check, breakAfter) && i < len(result.Results)-1 {
			d.state.Paused = true
			d.state.Env = captureEnv()
			fmt.Printf("\n[debug] paused after: %s\n", r.Check)
			fmt.Printf("[debug] %d/%d checks complete\n", i+1, len(result.Results))
			d.pause <- struct{}{}
			<-d.resume
			d.state.Paused = false
		}
	}

	run.Elapsed = time.Since(run.Started)
	run.Passed = result.Passed
	return run
}

// Continue resumes execution after a breakpoint.
func (d *DebugRunner) Continue() {
	d.resume <- struct{}{}
}

// WaitForPause blocks until runner hits a breakpoint.
func (d *DebugRunner) WaitForPause() {
	<-d.pause
}

// Inspect returns the current debug state.
func (d *DebugRunner) Inspect() *DebugState {
	return &d.state
}

func shouldBreak(check, breakAfter string) bool {
	if breakAfter == "" {
		return false
	}
	return check == breakAfter ||
		len(check) > len(breakAfter) &&
			check[len(check)-len(breakAfter):] == breakAfter
}
