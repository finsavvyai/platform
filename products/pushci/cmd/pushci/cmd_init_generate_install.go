package main

import (
	"strings"

	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/detect"
)

// buildInstallCommands is kept for callers that don't have project
// info handy; it falls back to `npm install` as before.
func buildInstallCommands(stacks map[detect.Stack]bool) []string {
	var cmds []string
	if stacks[detect.Node] {
		cmds = append(cmds, "npm install")
	}
	return append(cmds, buildRemainingInstallCommands(stacks)...)
}

// buildRemainingInstallCommands is the non-Node portion of
// buildInstallCommands, split out so the Node tool can be picked
// independently by callers that know the lockfile.
func buildRemainingInstallCommands(stacks map[detect.Stack]bool) []string {
	var cmds []string
	if stacks[detect.Python] {
		cmds = append(cmds, "pip install -r requirements.txt")
	}
	if stacks[detect.Go] {
		cmds = append(cmds, "go mod download")
	}
	if stacks[detect.Rust] {
		cmds = append(cmds, "cargo fetch")
	}
	if stacks[detect.Java] {
		cmds = append(cmds, "mvn dependency:resolve -q")
	}
	if stacks[detect.Ruby] {
		cmds = append(cmds, "bundle install")
	}
	cmds = append(cmds, extInstallCommands(stacks)...)
	cmds = append(cmds, ext2InstallCommands(stacks)...)
	cmds = append(cmds, ext3InstallCommands(stacks)...)
	return cmds
}

func installChecksFromCmds(cmds []string) []config.Check {
	var checks []config.Check
	for _, cmd := range cmds {
		parts := strings.Fields(cmd)
		checks = append(checks, config.Check{Name: parts[0] + "-install", Run: cmd})
	}
	return checks
}
