package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/detect"
)

func checkConfig(root string) int {
	issues := 0
	fmt.Println(cli.Bold("\n  Configuration"))

	path := filepath.Join(root, "pushci.yml")
	pipe, err := config.Load(path)
	if err != nil {
		cli.Warn("  pushci.yml not found or invalid")
		fmt.Printf("    %s pushci init\n", cli.Green("Fix:"))
		return 1
	}
	cli.Success("  pushci.yml found")

	if !pipe.HasStages() && len(pipe.Checks) == 0 {
		cli.Warn("  No stages or checks defined")
		fmt.Printf("    %s Add stages to pushci.yml or run: pushci init\n", cli.Green("Fix:"))
		issues++
	}

	for _, s := range pipe.Stages {
		if s.Dir != "" {
			full := filepath.Join(root, s.Dir)
			if _, err := os.Stat(full); os.IsNotExist(err) {
				cli.Warn(fmt.Sprintf("  Stage '%s' dir '%s' does not exist", s.Name, s.Dir))
				fmt.Printf("    %s Check the dir: field in pushci.yml\n", cli.Green("Fix:"))
				issues++
			}
		}
	}
	return issues
}

func checkProject(root string) int {
	fmt.Println(cli.Bold("\n  Project Detection"))

	projects := detect.Scan(root)
	if len(projects) == 0 {
		cli.Warn("  No projects detected")
		fmt.Printf("    %s Ensure source files exist (package.json, go.mod, etc.)\n", cli.Green("Fix:"))
		return 1
	}
	for _, p := range projects {
		cli.Success(fmt.Sprintf("  %s detected (%s)", p.Stack, p.Dir))
	}
	return 0
}

func checkHook(root string) int {
	fmt.Println(cli.Bold("\n  Git Hook"))

	hookPath := filepath.Join(root, ".git", "hooks", "pre-push")
	data, err := os.ReadFile(hookPath)
	if err != nil {
		cli.Warn("  pre-push hook not installed")
		fmt.Printf("    %s pushci init (or create manually)\n", cli.Green("Fix:"))
		return 1
	}
	if !strings.Contains(string(data), "pushci") {
		cli.Warn("  pre-push hook exists but doesn't reference pushci")
		fmt.Printf("    %s Run: pushci init (will skip if hook exists)\n", cli.Green("Fix:"))
		return 1
	}
	cli.Success("  pre-push hook installed")
	return 0
}
