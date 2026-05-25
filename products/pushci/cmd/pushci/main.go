package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/updater"
)

// dispatch lives in main_dispatch.go

var version = "1.7.5" // overridden by goreleaser ldflags in release builds

// updateRefreshGrace caps how long main will wait at exit for the
// background refresh goroutine to finish. 400ms gives the fetch
// plenty of time on broadband (~200ms typical) without adding
// visible latency to instant commands like `pushci version`.
const updateRefreshGrace = 400 * time.Millisecond

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(0)
	}

	// Non-intrusive update check. Banner() reads a cached result
	// synchronously (a small JSON file) and returns empty in the
	// common case. The actual npm fetch runs in a parallel
	// goroutine kicked off immediately so it has the full
	// duration of the user's command to complete. At exit we
	// wait a bounded grace period (400ms) for any fast commands.
	refreshDone := make(chan struct{})
	go func() {
		updater.Refresh(version)
		close(refreshDone)
	}()
	if banner := updater.Banner(version); banner != "" {
		fmt.Fprint(os.Stderr, banner)
	}
	defer func() {
		select {
		case <-refreshDone:
		case <-time.After(updateRefreshGrace):
		}
	}()

	ctx := context.Background()
	cmd := os.Args[1]
	args := os.Args[2:]

	// dispatch is defined in main_dispatch.go
	err, _ := dispatch(ctx, cmd, args)

	waitTelemetry()

	if err != nil {
		cli.Error(err.Error())
		os.Exit(1)
	}
}
