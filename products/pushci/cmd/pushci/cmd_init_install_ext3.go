package main

import "github.com/finsavvyai/pushci/internal/detect"

// ext3InstallCommands returns install commands for Terraform, Helm, Solidity, Bun.
func ext3InstallCommands(stacks map[detect.Stack]bool) []string {
	var cmds []string
	if stacks[detect.Terraform] {
		cmds = append(cmds, "terraform init")
	}
	if stacks[detect.Helm] {
		cmds = append(cmds, "helm dependency update")
	}
	if stacks[detect.Solidity] {
		cmds = append(cmds, "forge install")
	}
	if stacks[detect.Bun] {
		cmds = append(cmds, "bun install")
	}
	return cmds
}
