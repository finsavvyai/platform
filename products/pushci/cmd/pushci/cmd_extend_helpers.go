package main

import (
	"fmt"
	"strings"

	"github.com/finsavvyai/pushci/internal/cli"
)

type extendFlags struct {
	dryRun bool
	yes    bool
}

// parseExtendArgs peels off --dry-run / --yes / -y / --help and returns
// the remaining positional tokens joined as the natural-language prompt.
func parseExtendArgs(args []string) (string, extendFlags) {
	var f extendFlags
	var rest []string
	for _, a := range args {
		switch a {
		case "--dry-run":
			f.dryRun = true
		case "--yes", "-y":
			f.yes = true
		default:
			rest = append(rest, a)
		}
	}
	return strings.TrimSpace(strings.Join(rest, " ")), f
}

func printExtendHelp() {
	fmt.Println(`pushci extend — edit pushci.yml with natural language

USAGE
  pushci extend "<instruction>" [flags]

EXAMPLES
  pushci extend "add an e2e stage that runs npx playwright test"
  pushci extend "add Cloudflare Pages deploy on main branch"
  pushci extend "cache node_modules between runs"
  pushci extend "fail the build if coverage drops below 80%"

FLAGS
  --dry-run   Show the diff, don't write the file
  --yes, -y   Skip the apply confirmation prompt
  --help      Show this help

BILLING
  Free with your own AI key (ANTHROPIC_API_KEY, GROQ_API_KEY, etc.).
  PushCI-managed AI requires Pro or Team plan.`)
}

// printExtendDiff renders a unified-ish line diff. Lines only in current
// are red (removed), only in next are green (added), shared lines dim.
// Good enough for yaml review without pulling in a diff library.
func printExtendDiff(current, next string) {
	cur := strings.Split(strings.TrimRight(current, "\n"), "\n")
	nxt := strings.Split(strings.TrimRight(next, "\n"), "\n")
	curSet := map[string]int{}
	for _, l := range cur {
		curSet[l]++
	}
	nxtSet := map[string]int{}
	for _, l := range nxt {
		nxtSet[l]++
	}

	fmt.Println()
	fmt.Println(cli.Dim("──────── diff ────────"))
	for _, l := range cur {
		if nxtSet[l] == 0 {
			fmt.Printf("  %s %s\n", cli.Red("-"), cli.Red(l))
		}
	}
	for _, l := range nxt {
		if curSet[l] == 0 {
			fmt.Printf("  %s %s\n", cli.Green("+"), cli.Green(l))
		}
	}
	fmt.Println(cli.Dim("──────────────────────"))
}
