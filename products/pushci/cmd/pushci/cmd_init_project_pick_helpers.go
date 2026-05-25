package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/detect"
)

func printProjectChoices(projects []detect.Project, included []bool) {
	fmt.Println()
	for i, p := range projects {
		mark := cli.Dim("[ ]")
		if included[i] {
			mark = cli.Green("[x]")
		}
		fmt.Printf("    %s %d) %s %s (%s)\n",
			mark, i+1, cli.Bold(string(p.Stack)), p.Framework, p.Dir,
		)
	}
}

func readLine() string {
	r := bufio.NewReader(os.Stdin)
	line, _ := r.ReadString('\n')
	return strings.TrimSpace(line)
}

func looksGenerated(dir string) bool {
	d := strings.ToLower(strings.TrimPrefix(dir, "./"))
	for _, seg := range strings.Split(d, "/") {
		switch seg {
		case "codegen", "generated", "gen", "node_modules",
			"vendor", "target", "dist", "build":
			return true
		}
	}
	return strings.HasSuffix(d, "/bin") || d == "bin"
}
