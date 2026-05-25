package main

import (
	"fmt"

	"github.com/finsavvyai/pushci/internal/cli"
)

func printUsage() {
	fmt.Print(cli.Bold("pushci") + " — AI-native CI/CD\n\n")
	fmt.Println(cli.Bold("Usage:") + "  pushci <command> [flags]\n")
	fmt.Println(cli.Bold("Commands:"))
	cmds := [][]string{
		{"init", "Detect stack and generate pushci.yml"},
		{"run", "Execute pipeline checks"},
		{"deploy", "Deploy to target environment"},
		{"diagnose", "AI-diagnose failed runs"},
		{"extend", "AI-edit pushci.yml via natural language"},
		{"status", "Show last run results"},
		{"secret", "Manage encrypted secrets"},
		{"heal", "AI self-heal broken pipeline"},
		{"ask", "Natural language CI commands"},
		{"generate", "AI-generate pushci.yml"},
		{"migrate", "Convert GitHub Actions workflow"},
		{"trigger", "Fire GitHub workflow_dispatch event via REST API"},
		{"mcp", "Start MCP server for AI agents"},
		{"agent", "Start webhook agent server"},
		{"index", "Build dependency graph for blast radius analysis"},
		{"skill", "Install/list/remove marketplace skills"},
		{"login", "Authenticate with PushCI (Pro)"},
		{"logout", "Remove saved credentials"},
		{"doctor", "Check environment health"},
		{"troubleshoot", "Diagnose issues with actionable fixes"},
		{"trace", "View Perfetto performance traces"},
		{"release", "Build & publish release locally ($0)"},
		{"promote", "Register with AI registries & search engines"},
		{"uninstall", "Remove hooks, config, and .pushci from project"},
		{"version", "Print version"},
	}
	for _, c := range cmds {
		fmt.Printf("  %-12s %s\n", cli.Green(c[0]), c[1])
	}
	fmt.Println("\nRun " + cli.Blue("pushci <command> --help") + " for details.")
	fmt.Println(cli.Dim("https://pushci.dev"))
}
