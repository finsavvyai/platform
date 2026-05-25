package main

import (
	"fmt"
	"os"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/mcp"
	"github.com/finsavvyai/pushci/internal/secrets"
)

func cmdSecret(args []string) error {
	if wantsHelp(args) || len(args) == 0 {
		printSubUsage("secret",
			"pushci secret <set|get|list|delete> [key] [value]",
			"Manage encrypted project secrets (AES-256-GCM, machine-bound keys).",
			nil,
			[]string{
				"pushci secret set GITHUB_TOKEN ghp_xxx",
				"pushci secret get GITHUB_TOKEN",
				"pushci secret list",
				"pushci secret delete GITHUB_TOKEN",
			})
		return nil
	}
	dir, _ := os.Getwd()
	store, err := secrets.New(dir)
	if err != nil {
		return fmt.Errorf("init secret store: %w", err)
	}
	switch args[0] {
	case "vault":
		return cmdSecretsVault(args[1:])
	case "keychain":
		return cmdSecretsKeychain(args[1:])
	case "set":
		if len(args) < 3 {
			return fmt.Errorf("usage: pushci secret set <key> <value>")
		}
		if err := store.Set(args[1], args[2]); err != nil {
			return err
		}
		cli.Success(fmt.Sprintf("Set secret: %s", args[1]))
	case "get":
		if len(args) < 2 {
			return fmt.Errorf("usage: pushci secret get <key>")
		}
		val, ok := store.Get(args[1])
		if !ok {
			return fmt.Errorf("secret not found: %s", args[1])
		}
		fmt.Println(val)
	case "list":
		keys := store.List()
		if len(keys) == 0 {
			cli.Info("No secrets stored")
			return nil
		}
		for _, k := range keys {
			fmt.Printf("  %s %s\n", cli.Dot(), k)
		}
	case "delete":
		if len(args) < 2 {
			return fmt.Errorf("usage: pushci secret delete <key>")
		}
		if err := store.Delete(args[1]); err != nil {
			return err
		}
		cli.Success(fmt.Sprintf("Deleted: %s", args[1]))
	default:
		return fmt.Errorf("unknown secret command: %s", args[0])
	}
	return nil
}

func cmdMCP() error {
	cli.Info("Starting MCP server (stdio)...")
	srv := mcp.NewServer(os.Stdin, os.Stdout, version)
	return srv.Run()
}
