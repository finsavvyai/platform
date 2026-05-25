package main

import (
	"context"
	"fmt"
	"strings"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/secrets"
)

// cmdSecretsKeychain routes `pushci secrets keychain <verb>` to the
// matching action against the OS-native keystore (with encrypted-file
// fallback on headless Linux). The four verbs mirror the .zshrc helpers
// developers tend to write: set / get / list / rm.
//
// Helpers (list/rm/usage) live in cmd_secrets_keychain_more.go to keep
// each file under the 100-line cap enforced by the filesize check in
// pushci.yml.
func cmdSecretsKeychain(args []string) error {
	if wantsHelp(args) || len(args) == 0 {
		keychainUsage()
		return nil
	}
	k, err := secrets.NewKeychainResolver("")
	if err != nil {
		return fmt.Errorf("init keychain resolver: %w", err)
	}
	defer k.Close()
	switch args[0] {
	case "set":
		return keychainSet(k, args[1:])
	case "get":
		return keychainGet(k, args[1:])
	case "list", "ls":
		return keychainList(k)
	case "rm", "delete", "del":
		return keychainRm(k, args[1:])
	case "rotate":
		return keychainRotate(k, args[1:])
	default:
		return fmt.Errorf("unknown subcommand: %s (try: set, get, list, rm, rotate)", args[0])
	}
}

func keychainSet(k *secrets.KeychainResolver, args []string) error {
	if len(args) < 2 {
		return fmt.Errorf("usage: pushci secrets keychain set <service[#account]> <value>")
	}
	svc, acct := splitServiceAccount(args[0])
	if err := k.Set(svc, acct, args[1]); err != nil {
		return err
	}
	cli.Success(fmt.Sprintf("Stored %s%s in keychain", svc, accountSuffix(acct)))
	return nil
}

func keychainGet(k *secrets.KeychainResolver, args []string) error {
	if len(args) < 1 {
		return fmt.Errorf("usage: pushci secrets keychain get <service[#account]>")
	}
	ref := args[0]
	if !strings.HasPrefix(ref, "keychain://") {
		ref = "keychain://" + ref
	}
	val, err := k.Resolve(context.Background(), ref)
	if err != nil {
		return err
	}
	fmt.Println(val)
	return nil
}
