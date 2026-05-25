package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"github.com/finsavvyai/pushci/internal/cli"
)

// confirmApproval gates a sensitive action (stage or deploy) behind a
// human yes/no. Three modes, in order:
//
//  1. Env override: PUSHCI_APPROVE=1 auto-approves (for CI that gates
//     via ServiceNow CHG / pipeline of pipelines, not per-run prompt).
//     PUSHCI_APPROVE=0 auto-denies — useful for smoke tests.
//  2. TTY: prompt on stdin, accept y/yes (case-insensitive).
//  3. Non-TTY with no env: deny with a loud stderr message so the
//     operator can see why the run stopped. Never hang on stdin in CI.
func confirmApproval(kind, name string) bool {
	if v := strings.ToLower(strings.TrimSpace(os.Getenv("PUSHCI_APPROVE"))); v != "" {
		switch v {
		case "1", "true", "yes", "y":
			fmt.Fprintf(os.Stderr, "  %s Auto-approved %s %q via PUSHCI_APPROVE=%s\n",
				cli.Blue("i"), kind, name, v)
			return true
		case "0", "false", "no", "n":
			fmt.Fprintf(os.Stderr, "  %s Auto-denied %s %q via PUSHCI_APPROVE=%s\n",
				cli.Blue("i"), kind, name, v)
			return false
		}
	}

	if !isStdinTTY() {
		cli.Warn(fmt.Sprintf(
			"%s %q requires approval but no TTY is attached. "+
				"Set PUSHCI_APPROVE=1 to auto-approve or run interactively.",
			kind, name))
		return false
	}

	fmt.Printf("    %s %s %q requires approval. Continue? [y/N]: ",
		cli.Dot(), titleCase(kind), name)
	reader := bufio.NewReader(os.Stdin)
	line, _ := reader.ReadString('\n')
	line = strings.ToLower(strings.TrimSpace(line))
	return line == "y" || line == "yes"
}

func isStdinTTY() bool {
	stat, err := os.Stdin.Stat()
	if err != nil {
		return false
	}
	return (stat.Mode() & os.ModeCharDevice) != 0
}

func titleCase(s string) string {
	if s == "" {
		return s
	}
	return strings.ToUpper(s[:1]) + s[1:]
}
