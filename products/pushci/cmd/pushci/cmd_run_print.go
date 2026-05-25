package main

import (
	"fmt"
	"time"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/runner"
)

func printRunResults(run *runner.Run) {
	headers := []string{"Check", "Status", "Duration"}
	var rows [][]string
	for _, r := range run.Results {
		status := cli.Green("pass")
		if !r.Passed {
			status = cli.Red("FAIL")
		}
		rows = append(rows, []string{r.Check, status, r.Duration.Truncate(time.Millisecond).String()})
	}
	cli.Table(headers, rows)
	fmt.Println()
}

func countFailed(run *runner.Run) int {
	n := 0
	for _, r := range run.Results {
		if !r.Passed {
			n++
		}
	}
	return n
}

func hasFlag(args []string, flags ...string) bool {
	for _, a := range args {
		for _, f := range flags {
			if a == f {
				return true
			}
		}
	}
	return false
}

func lastLines(s string, n int) []string {
	var lines []string
	for _, l := range splitLines(s) {
		l = trimSpace(l)
		if l != "" && l != ">" && len(l) > 2 {
			lines = append(lines, l)
		}
	}
	if len(lines) > n {
		lines = lines[len(lines)-n:]
	}
	return lines
}
