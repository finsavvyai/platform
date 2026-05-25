package artifacts

import (
	"fmt"
	"strings"
)

// Report generates a markdown report of artifact size changes.
func Report(changes []SizeChange) string {
	if len(changes) == 0 {
		return "No artifact changes detected."
	}

	var b strings.Builder
	b.WriteString("## Artifact Size Report\n\n")
	b.WriteString("| Artifact | Old Size | New Size | Change |\n")
	b.WriteString("|----------|----------|----------|--------|\n")

	for _, c := range changes {
		icon := statusIcon(c)
		fmt.Fprintf(&b, "| %s | %s | %s | %s %s |\n",
			c.Name,
			formatSize(c.OldSize),
			formatSize(c.NewSize),
			icon,
			formatChange(c),
		)
	}

	bloat := detectBloat(changes)
	if len(bloat) > 0 {
		b.WriteString("\n### Bloat Warnings\n\n")
		for _, c := range bloat {
			fmt.Fprintf(&b,
				"- **%s** grew %.0f%% (%s -> %s)\n",
				c.Name, c.DiffPercent,
				formatSize(c.OldSize), formatSize(c.NewSize),
			)
		}
	}

	return b.String()
}

func statusIcon(c SizeChange) string {
	if c.IsBloat() {
		return "🔴"
	}
	if c.DiffBytes < 0 {
		return "🟢"
	}
	if c.DiffBytes == 0 {
		return "⚪"
	}
	return "🟡"
}

func formatChange(c SizeChange) string {
	if c.DiffBytes == 0 {
		return "no change"
	}
	sign := "+"
	if c.DiffBytes < 0 {
		sign = ""
	}
	return fmt.Sprintf("%s%s (%.1f%%)", sign, formatSize(c.DiffBytes), c.DiffPercent)
}

func formatSize(bytes int64) string {
	abs := bytes
	if abs < 0 {
		abs = -abs
	}
	switch {
	case abs >= 1<<30:
		return fmt.Sprintf("%.1fGB", float64(bytes)/float64(1<<30))
	case abs >= 1<<20:
		return fmt.Sprintf("%.1fMB", float64(bytes)/float64(1<<20))
	case abs >= 1<<10:
		return fmt.Sprintf("%.1fKB", float64(bytes)/float64(1<<10))
	default:
		return fmt.Sprintf("%dB", bytes)
	}
}

func detectBloat(changes []SizeChange) []SizeChange {
	var bloat []SizeChange
	for _, c := range changes {
		if c.IsBloat() {
			bloat = append(bloat, c)
		}
	}
	return bloat
}
