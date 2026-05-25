package main

import (
	"context"
	"fmt"
	"os"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/secrets"
)

// keychainRotate swaps an entry's value while remembering enough of the
// old one for the human to confirm a downstream revoke at the provider
// (e.g. npmjs.com → Access Tokens → revoke <oldPrefix>).
//
// New value source order:
//  1. `--from-stdin`  → reads from os.Stdin (raw, no trim)
//  2. positional arg  → pushci secrets keychain rotate <service> <new-value>
//  3. `PUSHCI_NEW_SECRET` env var
//
// Stdout prints a single line: "rotated <service>[#<account>]
// old_prefix=<first-8>... — revoke at your provider." Nothing else,
// so the line is paste-safe into a tracking issue.
func keychainRotate(k *secrets.KeychainResolver, args []string) error {
	if len(args) < 1 {
		return fmt.Errorf("usage: pushci secrets keychain rotate <service[#account]> [<new-value>|--from-stdin]")
	}
	svc, acct := splitServiceAccount(args[0])
	newVal, err := readRotateValue(args[1:])
	if err != nil {
		return err
	}
	old, oldOK := readOldForRotate(k, svc, acct)
	if err := k.Set(svc, acct, newVal); err != nil {
		return err
	}
	cli.Success(rotateSummary(svc, acct, old, oldOK))
	return nil
}

func readRotateValue(args []string) (string, error) {
	if len(args) > 0 && args[0] == "--from-stdin" {
		buf := make([]byte, 4096)
		n, err := os.Stdin.Read(buf)
		if err != nil || n == 0 {
			return "", fmt.Errorf("--from-stdin: no input")
		}
		return string(buf[:n]), nil
	}
	if len(args) > 0 {
		return args[0], nil
	}
	if v := os.Getenv("PUSHCI_NEW_SECRET"); v != "" {
		return v, nil
	}
	return "", fmt.Errorf("no new value: pass an arg, set PUSHCI_NEW_SECRET, or use --from-stdin")
}

func readOldForRotate(k *secrets.KeychainResolver, svc, acct string) (string, bool) {
	ref := "keychain://" + svc
	if acct != "" {
		ref += "#" + acct
	}
	v, err := k.Resolve(context.Background(), ref)
	if err != nil {
		return "", false
	}
	return v, true
}

func rotateSummary(svc, acct, old string, oldOK bool) string {
	base := "Rotated " + svc + accountSuffix(acct)
	if !oldOK {
		return base + " (no prior value)"
	}
	return base + " old_prefix=" + maskPrefix(old) + " — revoke at your provider"
}

func maskPrefix(s string) string {
	if len(s) <= 8 {
		return "********"
	}
	return s[:8] + "…"
}
