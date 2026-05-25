//go:build darwin

package secrets

import (
	"fmt"
	"os/exec"
	"strings"
)

// osKeyringGet shells out to /usr/bin/security so values round-trip
// raw — matching the developer's existing `.zshrc secret` helpers:
//
//	secret() { security find-generic-password -a "$USER" -s "$1" -w; }
//
// Using github.com/zalando/go-keyring instead would write values with
// a `go-keyring-base64:` prefix, breaking interop with anything that
// uses the raw `security` CLI. We pay one fork() per call to preserve
// that compatibility — Keychain access is interactive-speed anyway.
func osKeyringGet(svc, acct string) (string, error) {
	out, err := exec.Command("security",
		"find-generic-password", "-a", acct, "-s", svc, "-w").Output()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			stderr := strings.ToLower(string(exitErr.Stderr))
			if strings.Contains(stderr, "could not be found") {
				return "", errKeychainNotFound
			}
		}
		return "", fmt.Errorf("security find: %w", err)
	}
	return strings.TrimRight(string(out), "\n"), nil
}

// osKeyringSet creates or updates an entry (-U). Mirrors the
// `.zshrc secret-set` helper exactly.
func osKeyringSet(svc, acct, val string) error {
	cmd := exec.Command("security",
		"add-generic-password", "-a", acct, "-s", svc, "-w", val, "-U")
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("security add: %w: %s", err, strings.TrimSpace(string(out)))
	}
	return nil
}

// osKeyringDelete removes an entry. Returns errKeychainNotFound when
// the entry is already missing so the resolver can treat that as a
// successful no-op (idempotent rm semantics).
func osKeyringDelete(svc, acct string) error {
	cmd := exec.Command("security",
		"delete-generic-password", "-a", acct, "-s", svc)
	if out, err := cmd.CombinedOutput(); err != nil {
		text := strings.ToLower(string(out))
		if strings.Contains(text, "could not be found") {
			return errKeychainNotFound
		}
		return fmt.Errorf("security delete: %w: %s", err, strings.TrimSpace(string(out)))
	}
	return nil
}
