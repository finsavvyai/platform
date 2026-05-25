package runner

import (
	"fmt"
	"strings"
)

// Summary returns a markdown summary of the run.
func (r *Run) Summary() string {
	var b strings.Builder
	b.WriteString("## PushCI CI Results\n\n")
	for _, res := range r.Results {
		icon := "pass"
		if !res.Passed {
			icon = "FAIL"
		}
		fmt.Fprintf(&b, "%s **%s** (%s)\n", icon, res.Check, res.Duration)
	}
	fmt.Fprintf(&b, "\n**Total: %s**\n", r.Elapsed)
	return b.String()
}
