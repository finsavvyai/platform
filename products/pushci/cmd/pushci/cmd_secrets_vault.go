package main

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/secrets"
)

func cmdSecretsVault(args []string) error {
	if wantsHelp(args) {
		printSubUsage("secrets vault",
			"pushci secrets vault check",
			"Verify AppRole credentials and print Vault token policies.",
			nil,
			[]string{
				"VAULT_ADDR=http://vault:8200 VAULT_ROLE_ID=<id> VAULT_SECRET_ID=<sid> pushci secrets vault check",
			})
		return nil
	}

	sub := ""
	if len(args) > 0 {
		sub = args[0]
	}
	if sub != "check" && sub != "" {
		return fmt.Errorf("unknown secrets vault subcommand: %s (try: check)", sub)
	}

	addr := os.Getenv("VAULT_ADDR")
	roleID := os.Getenv("VAULT_ROLE_ID")
	secretID := os.Getenv("VAULT_SECRET_ID")

	for _, pair := range [][2]string{
		{"VAULT_ADDR", addr},
		{"VAULT_ROLE_ID", roleID},
		{"VAULT_SECRET_ID", secretID},
	} {
		if pair[1] == "" {
			return fmt.Errorf("%s not set — export it before running vault check", pair[0])
		}
	}

	cli.Info(fmt.Sprintf("Vault check → %s", addr))
	ctx := context.Background()
	vc, err := secrets.NewVaultClient(ctx, addr, roleID, secretID)
	if err != nil {
		cli.Error(fmt.Sprintf("AppRole login failed: %v", err))
		os.Exit(1)
	}
	defer vc.Close()
	cli.Success("AppRole login OK")

	policies, err := vc.Policies(ctx)
	if err != nil {
		cli.Warn(fmt.Sprintf("Could not fetch policies: %v", err))
	} else if len(policies) > 0 {
		fmt.Printf("  policies: %s\n", strings.Join(policies, ", "))
	}
	return nil
}
