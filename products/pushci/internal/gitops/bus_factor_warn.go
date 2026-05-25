package gitops

import (
	"fmt"
	"io"

	"github.com/finsavvyai/pushci/internal/intel"
)

// BusFactorWarnOptions controls WarnBusFactorOne rendering + opt-in gate.
type BusFactorWarnOptions struct {
	Enabled bool
	Out     io.Writer
}

// WarnBusFactorOne prints a non-blocking warning for every changed file
// that has bus-factor == 1 in the provided distribution. Returns the
// number of warnings emitted so callers (tests, telemetry) can assert.
// Silent when Enabled=false, matching the opt-in contract in pushci.yml:
//
//	[bus-factor]
//	warn_on_bf1 = true
func WarnBusFactorOne(
	changed []string,
	dist map[string]intel.AuthorDistribution,
	opts BusFactorWarnOptions,
) int {
	if !opts.Enabled || opts.Out == nil || len(changed) == 0 {
		return 0
	}
	risky := collectRisky(changed, dist)
	if len(risky) == 0 {
		return 0
	}
	fmt.Fprintln(opts.Out, "⚠ Bus-factor check:")
	for _, r := range risky {
		fmt.Fprintf(opts.Out, "  %s — BF=1 (only %s in window)\n", r.Path, onlyAuthor(r.Authors))
	}
	fmt.Fprintln(opts.Out, "  Consider pair review before merge.")
	return len(risky)
}

func collectRisky(changed []string, dist map[string]intel.AuthorDistribution) []intel.AuthorDistribution {
	var risky []intel.AuthorDistribution
	for _, f := range changed {
		d, ok := dist[f]
		if !ok {
			continue
		}
		if d.BusFactor == 1 {
			risky = append(risky, d)
		}
	}
	return risky
}

func onlyAuthor(authors map[string]int) string {
	for a := range authors {
		return a
	}
	return "unknown"
}
