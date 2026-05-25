package main

import (
	"fmt"
	"os"
	"time"

	"github.com/finsavvyai/pushci/internal/intel"
)

// cmdIntel dispatches `pushci intel <sub>` — bus-factor + hotspot analytics.
func cmdIntel(args []string) error {
	if len(args) == 0 {
		return intelUsage()
	}
	flags := parseIntelFlags(args[1:])
	root, _ := os.Getwd()
	dist, err := intel.ComputeBusFactor(root, flags.since)
	if err != nil {
		return fmt.Errorf("git log failed (are you in a git repo?): %w", err)
	}
	switch args[0] {
	case "bus-factor":
		return renderBusFactor(dist, flags)
	case "hotspots":
		return renderHotspots(dist, flags)
	default:
		return intelUsage()
	}
}

type intelFlags struct {
	since time.Duration
	json  bool
	topN  int
}

func parseIntelFlags(rest []string) intelFlags {
	f := intelFlags{since: 365 * 24 * time.Hour, topN: 20}
	for _, a := range rest {
		switch {
		case a == "--json":
			f.json = true
		case len(a) > 8 && a[:8] == "--since=":
			if d, err := time.ParseDuration(a[8:]); err == nil {
				f.since = d
			}
		case len(a) > 6 && a[:6] == "--top=":
			var n int
			_, _ = fmt.Sscanf(a[6:], "%d", &n)
			if n > 0 {
				f.topN = n
			}
		}
	}
	return f
}

func intelUsage() error {
	fmt.Println("Usage: pushci intel <bus-factor|hotspots> [--since=<duration>] [--top=N] [--json]")
	return nil
}
