package secrets

import (
	"fmt"
	"os"
	"strings"
)

// Set stores a (service, account, value) triple in the OS keystore,
// falling back to the encrypted file when the keystore is unavailable.
func (k *KeychainResolver) Set(svc, acct, val string) error {
	if acct == "" {
		acct = k.defaultAccount
	}
	err := osKeyringSet(svc, acct, val)
	if err == nil {
		return nil
	}
	if !isKeyringUnavailable(err) {
		return fmt.Errorf("keychain set %s#%s: %w", svc, acct, err)
	}
	k.warnFallback()
	return k.fallback.Set(fallbackKey(svc, acct), val)
}

// Delete removes an entry from whichever backend currently holds it.
// Missing-entry on both backends is treated as success to match
// idempotent CLI expectations (rm -f).
func (k *KeychainResolver) Delete(svc, acct string) error {
	if acct == "" {
		acct = k.defaultAccount
	}
	err := osKeyringDelete(svc, acct)
	if err == nil {
		return nil
	}
	if !isKeyringUnavailable(err) && !strings.Contains(err.Error(), "not found") {
		return fmt.Errorf("keychain delete %s#%s: %w", svc, acct, err)
	}
	k.warnFallback()
	_ = k.fallback.Delete(fallbackKey(svc, acct))
	return nil
}

// List returns the entries currently in the fallback encrypted file.
// The OS keystore is intentionally NOT enumerated — those entries
// belong to the user's broader system and pushci should not expose
// them by accident. To inspect OS-keystore contents use the native
// OS tool (macOS: Keychain Access.app, Windows: Credential Manager,
// Linux: seahorse / kwalletmanager).
func (k *KeychainResolver) List() []string {
	if k.fallback == nil {
		return nil
	}
	return k.fallback.List()
}

// warnFallback emits a single stderr line the first time we route a
// request to the encrypted file. Subsequent calls are silent so we
// don't spam logs during a long pushci run.
func (k *KeychainResolver) warnFallback() {
	k.mu.Lock()
	defer k.mu.Unlock()
	if k.warned {
		return
	}
	k.warned = true
	fmt.Fprintln(os.Stderr,
		"pushci: OS keyring unavailable — using encrypted fallback at "+
			"~/.pushci/keychain.enc (set PUSHCI_KEYCHAIN_BACKEND=os to force OS)")
}
