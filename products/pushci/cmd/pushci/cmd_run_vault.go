package main

import (
	"context"
	"fmt"
	"os"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/runner"
	"github.com/finsavvyai/pushci/internal/secrets"
)

// resolveVaultEnv expands secret:// refs in env values before they
// hit a shell command. Recognized schemes today: vault:// (when
// VAULT_ADDR is configured) and keychain:// (always — backed by OS
// keystore + encrypted-file fallback). Returns the resolved env or
// ok=false on the first error so the caller can fail-fast the stage.
//
// Name kept as resolveVaultEnv to avoid churn in the run/deploy/check
// call sites; "vault" here is shorthand for "secret-bearing env."
func resolveVaultEnv(ctx context.Context, env map[string]string) (map[string]string, bool) {
	if len(env) == 0 {
		return env, true
	}
	var vaultR secrets.Resolver
	if addr := os.Getenv("VAULT_ADDR"); addr != "" {
		vc, ok := openVault(ctx, addr)
		if !ok {
			return nil, false
		}
		defer vc.Close()
		vaultR = vc
	}
	kc, err := secrets.NewKeychainResolver("")
	if err != nil {
		cli.Error(fmt.Sprintf("keychain init: %v", err))
		return nil, false
	}
	defer kc.Close()
	resolved, err := runner.ResolveEnv(ctx, env, vaultR, kc)
	if err != nil {
		cli.Error(fmt.Sprintf("secret env: %v", err))
		return nil, false
	}
	return resolved, true
}

// openVault performs the AppRole login. Split out so resolveVaultEnv
// stays under the 100-line cap and so the auth branch can be unit
// tested independently.
func openVault(ctx context.Context, addr string) (*secrets.VaultClient, bool) {
	roleID := os.Getenv("VAULT_ROLE_ID")
	secretID := os.Getenv("VAULT_SECRET_ID")
	if roleID == "" || secretID == "" {
		cli.Error("vault: VAULT_ROLE_ID and VAULT_SECRET_ID required when VAULT_ADDR is set")
		return nil, false
	}
	vc, err := secrets.NewVaultClient(ctx, addr, roleID, secretID)
	if err != nil {
		cli.Error(fmt.Sprintf("vault: %v", err))
		return nil, false
	}
	return vc, true
}
