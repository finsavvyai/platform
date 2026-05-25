package actions

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"sync"
	"time"
)

// runner_stream.go: attachStreams, pump

// Runner spawns act with a validated argument set and streams the
// output as structured Events. It is the only type in this package
// that performs side effects on the host (process spawn, temp files).
type Runner struct {
	// Stdout/Stderr are the byte streams act will write to. The runner
	// also intercepts a copy via Events to produce structured events.
	// Either may be nil to discard.
	Stdout io.Writer
	Stderr io.Writer

	// Events is an optional channel the runner will publish parsed
	// events on. If nil, structured parsing is skipped (saves a
	// goroutine and a pipe). Closed when the run completes.
	Events chan<- Event
}

// Result summarises the outcome of a single Run() call. Success is true
// if and only if act exited zero.
type Result struct {
	Success  bool
	ExitCode int
	Duration time.Duration
	Args     []string
}

// Run validates options, builds the act command line, executes it, and
// returns a Result. The caller can inspect Stderr for error context on
// failure. Run blocks until act exits or ctx is cancelled.
func (r *Runner) Run(ctx context.Context, opts RunOptions) (Result, error) {
	if err := opts.Validate(); err != nil {
		return Result{}, fmt.Errorf("invalid options: %w", err)
	}
	bin, err := ActBinary()
	if err != nil {
		return Result{}, err
	}

	args, cleanup, err := buildArgs(opts)
	if err != nil {
		return Result{}, err
	}
	defer cleanup()

	cmd := exec.CommandContext(ctx, bin, args...)
	if opts.WorkingDir != "" {
		cmd.Dir = opts.WorkingDir
	}
	cmd.Env = os.Environ()

	stdout, stderr, err := r.attachStreams(cmd)
	if err != nil {
		return Result{}, err
	}

	start := time.Now()
	if err := cmd.Start(); err != nil {
		return Result{}, fmt.Errorf("start act: %w", err)
	}
	var wait sync.WaitGroup
	wait.Add(2)
	go r.pump(stdout, r.Stdout, &wait, true)
	go r.pump(stderr, r.Stderr, &wait, false)
	wait.Wait()
	exitErr := cmd.Wait()
	dur := time.Since(start)

	exitCode := 0
	var ee *exec.ExitError
	if errors.As(exitErr, &ee) {
		exitCode = ee.ExitCode()
	} else if exitErr != nil {
		return Result{Args: args, Duration: dur}, exitErr
	}
	return Result{
		Success:  exitCode == 0,
		ExitCode: exitCode,
		Duration: dur,
		Args:     args,
	}, nil
}

// attachStreams and pump live in runner_stream.go.
// buildArgs and its helpers live in args.go.
