package main

import (
	"fmt"
	"strings"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/secrets"
)

// keychainList prints the entries known to the encrypted-file fallback.
// OS keystore contents are intentionally omitted — those belong to the
// user's broader system. To inspect them use the native OS tool:
// Keychain Access.app (macOS), Credential Manager (Windows), or
// seahorse / kwalletmanager (Linux).
func keychainList(k *secrets.KeychainResolver) error {
	entries := k.List()
	if len(entries) == 0 {
		cli.Info("No fallback-file entries. OS keystore contents are not listed " +
			"(use Keychain Access.app / Credential Manager / seahorse).")
		return nil
	}
	for _, e := range entries {
		fmt.Println(e)
	}
	return nil
}

func keychainRm(k *secrets.KeychainResolver, args []string) error {
	if len(args) < 1 {
		return fmt.Errorf("usage: pushci secrets keychain rm <service[#account]>")
	}
	svc, acct := splitServiceAccount(args[0])
	if err := k.Delete(svc, acct); err != nil {
		return err
	}
	cli.Success(fmt.Sprintf("Removed %s%s from keychain", svc, accountSuffix(acct)))
	return nil
}

func splitServiceAccount(s string) (svc, acct string) {
	s = strings.TrimPrefix(s, "keychain://")
	parts := strings.SplitN(s, "#", 2)
	svc = parts[0]
	if len(parts) == 2 {
		acct = parts[1]
	}
	return
}

func accountSuffix(acct string) string {
	if acct == "" {
		return ""
	}
	return "#" + acct
}

func keychainUsage() {
	printSubUsage("secrets keychain",
		"pushci secrets keychain <set|get|list|rm> [args]",
		"Store secrets in the OS-native keystore (macOS Keychain, Windows "+
			"Credential Manager, Linux Secret Service) with an encrypted-file "+
			"fallback for headless Linux CI.",
		nil,
		[]string{
			"pushci secrets keychain set npm-publish-token npm_xxxxxxxxxxxx",
			"pushci secrets keychain set deploy-bot#prod  s3cr3t",
			"pushci secrets keychain get npm-publish-token",
			"pushci secrets keychain list",
			"pushci secrets keychain rm npm-publish-token",
			"pushci secrets keychain rotate npm-publish-token npm_new_xxx",
			"echo $NEW | pushci secrets keychain rotate npm-publish-token --from-stdin",
		})
}
