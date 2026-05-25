package main

import (
	"fmt"
	"strings"

	"github.com/finsavvyai/pushci/internal/cli"
)

// wantsHelp returns true if any of the args is -h, --help, or help.
// Every subcommand that accepts positional args or flags must call
// this before doing any side-effectful work — otherwise `pushci run
// --help` silently kicks off a 20-minute pipeline (issue #1) and
// `pushci deploy --help` crashes with "unknown target: --help"
// (issue #2).
func wantsHelp(args []string) bool {
	for _, a := range args {
		switch strings.ToLower(a) {
		case "-h", "--help", "help":
			return true
		}
	}
	return false
}

// printSubUsage renders a per-subcommand usage block in the same
// visual style as the top-level printUsage. Each subcommand supplies
// its one-line synopsis, a short description, and an optional list of
// flags. Keeping this centralised means every command shares one
// layout — no drift between `pushci run --help` and
// `pushci deploy --help`.
func printSubUsage(name, synopsis, description string, flags [][2]string, examples []string) {
	fmt.Print(cli.Bold("pushci "+name) + " — " + description + "\n\n")
	fmt.Println(cli.Bold("Usage:") + "  " + synopsis + "\n")
	if len(flags) > 0 {
		fmt.Println(cli.Bold("Flags:"))
		for _, f := range flags {
			fmt.Printf("  %-22s %s\n", cli.Green(f[0]), f[1])
		}
		fmt.Println()
	}
	if len(examples) > 0 {
		fmt.Println(cli.Bold("Examples:"))
		for _, ex := range examples {
			fmt.Printf("  %s\n", cli.Dim(ex))
		}
		fmt.Println()
	}
}
