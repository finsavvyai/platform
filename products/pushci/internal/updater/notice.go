package updater

import (
	"fmt"
	"os"
	"strings"
)

// colorize wraps `s` with an ANSI color code when the environment
// supports it. Returns `s` unchanged in NO_COLOR environments,
// non-TTY output, or when color codes would otherwise be noise
// (log files, CI scrollback). Kept trivial so notice.go doesn't
// need to import internal/cli.
func colorize(code, s string) string {
	if noColor() {
		return s
	}
	return "\033[" + code + "m" + s + "\033[0m"
}

// noColor reports whether ANSI color codes should be skipped. We
// honor NO_COLOR (the de-facto standard), FORCE_COLOR as an
// override, and fall back to isTerminal() for auto-detection.
func noColor() bool {
	if os.Getenv("FORCE_COLOR") != "" {
		return false
	}
	if os.Getenv("NO_COLOR") != "" {
		return true
	}
	return !isTerminal()
}

// formatNotice renders the one-line upgrade banner the CLI prints
// at the top of a command. Small and visually distinct — one
// border line above, one below, two content lines inside.
func formatNotice(current, latest string) string {
	curr := strings.TrimPrefix(current, "v")
	next := strings.TrimPrefix(latest, "v")

	// Pre-colorize each fragment so the string assembly below is
	// readable. The alternative — inline \033 sequences in a big
	// Sprintf — was illegible and buggy.
	label := colorize("1;33", "pushci update available")
	from := colorize("2", curr)
	arrow := colorize("2", "→")
	to := colorize("1;32", next)
	upgradeLabel := colorize("2", "upgrade:")
	npmCmd := colorize("36", "npm i -g pushci@latest")
	orWord := colorize("2", "or")
	brewCmd := colorize("36", "brew upgrade pushci")

	line1 := fmt.Sprintf("  %s  %s %s %s", label, from, arrow, to)
	line2 := fmt.Sprintf("  %s %s  %s  %s", upgradeLabel, npmCmd, orWord, brewCmd)

	return fmt.Sprintf("\n%s\n%s\n\n", line1, line2)
}
