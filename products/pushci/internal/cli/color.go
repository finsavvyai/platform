package cli

import (
	"fmt"
)

const (
	reset  = "\033[0m"
	bold   = "\033[1m"
	dim    = "\033[2m"
	red    = "\033[31m"
	green  = "\033[32m"
	yellow = "\033[33m"
	blue   = "\033[34m"
)

func Green(s string) string  { return green + s + reset }
func Red(s string) string    { return red + s + reset }
func Yellow(s string) string { return yellow + s + reset }
func Blue(s string) string   { return blue + s + reset }
func Bold(s string) string   { return bold + s + reset }
func Dim(s string) string    { return dim + s + reset }

func CheckMark() string { return Green("\u2713") }
func CrossMark() string { return Red("\u2717") }
func Dot() string       { return Yellow("\u25cf") }

// Spinner is defined in cli_spinner.go.

func ProgressBar(current, total int, label string) string {
	if total <= 0 {
		return fmt.Sprintf("  %s [%s] 0%%", label, Dim("░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░"))
	}
	width := 30
	filled := width * current / total
	filledBar := ""
	emptyBar := ""
	for i := 0; i < width; i++ {
		if i < filled {
			filledBar += "█"
		} else {
			emptyBar += "░"
		}
	}
	pct := 100 * current / total
	return fmt.Sprintf("  %s [%s%s] %d%%", label, Green(filledBar), Dim(emptyBar), pct)
}
