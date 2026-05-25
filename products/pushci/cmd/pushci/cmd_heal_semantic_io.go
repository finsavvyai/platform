package main

import (
	"io"
	"os"
)

// readStdinAll returns all stdin if piped; otherwise "".
// Kept isolated so cmd_heal_semantic.go stays under 100 lines.
func readStdinAll() string {
	fi, err := os.Stdin.Stat()
	if err != nil || (fi.Mode()&os.ModeCharDevice) != 0 {
		return ""
	}
	b, err := io.ReadAll(os.Stdin)
	if err != nil {
		return ""
	}
	return string(b)
}
