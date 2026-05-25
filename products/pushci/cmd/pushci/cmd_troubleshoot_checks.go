package main

import (
	"fmt"
	"os"
	"os/exec"

	"github.com/finsavvyai/pushci/internal/cli"
)

func checkEnvironment() int {
	issues := 0
	fmt.Println(cli.Bold("\n  Environment"))

	tools := []struct {
		name, cmd, fix string
	}{
		{"Git", "git", "Install from https://git-scm.com"},
		{"Go", "go", "Install from https://go.dev/dl"},
		{"Node.js", "node", "Install from https://nodejs.org or: brew install node"},
		{"Docker", "docker", "Install from https://docker.com/get-started"},
	}
	for _, t := range tools {
		if _, err := exec.LookPath(t.cmd); err != nil {
			cli.Warn(fmt.Sprintf("  %s not found", t.name))
			fmt.Printf("    %s %s\n", cli.Green("Fix:"), t.fix)
			issues++
		} else {
			cli.Success(fmt.Sprintf("  %s installed", t.name))
		}
	}

	if os.Getenv("ANTHROPIC_API_KEY") == "" {
		cli.Warn("  ANTHROPIC_API_KEY not set (AI features disabled)")
		fmt.Printf("    %s export ANTHROPIC_API_KEY=sk-ant-...\n", cli.Green("Fix:"))
		issues++
	} else {
		cli.Success("  ANTHROPIC_API_KEY configured")
	}
	return issues
}

func checkConnectivity() int {
	fmt.Println(cli.Bold("\n  Connectivity"))

	out, err := exec.Command("git", "remote", "-v").CombinedOutput()
	if err != nil || len(out) == 0 {
		cli.Warn("  No git remote configured")
		fmt.Printf("    %s git remote add origin <url>\n", cli.Green("Fix:"))
		return 1
	}
	cli.Success("  Git remote configured")
	return 0
}
