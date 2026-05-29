package logger

import "fmt"

// defaultFormat returns a Sprintf("%v") of v. Split into its own file so the
// hot-path Logger methods don't import fmt directly at the package surface.
func defaultFormat(v any) string {
	return fmt.Sprintf("%v", v)
}
