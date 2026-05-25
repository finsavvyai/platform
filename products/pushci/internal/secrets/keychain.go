package secrets

import (
	"context"
	"fmt"
	"os"
	"os/user"
	"strings"
	"sync"
)

// KeychainResolver fetches secrets from the OS-native keystore (macOS
// Keychain, Windows Credential Manager, Linux Secret Service). On
// systems where the keystore is unavailable — typically headless
// Linux CI without a running gnome-keyring-daemon — it falls back
// transparently to an AES-encrypted file at ~/.pushci/keychain.enc.
//
// Refs use keychain://<service>[#<account>]. account defaults to the
// current OS user, so simple refs like keychain://npm-publish-token
// match the .zshrc helper pattern used by many developers.
type KeychainResolver struct {
	defaultAccount string
	fallback       *Store
	mu             sync.Mutex
	warned         bool
}

// NewKeychainResolver constructs a resolver. If account is empty the
// current OS user is used. Always returns a usable resolver; an error
// from this constructor only fires when the home directory cannot be
// resolved (extreme edge case).
func NewKeychainResolver(account string) (*KeychainResolver, error) {
	if account == "" {
		if u, err := user.Current(); err == nil && u.Username != "" {
			account = u.Username
		} else {
			account = os.Getenv("USER")
		}
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("keychain: home dir: %w", err)
	}
	store, err := newUserStore(home)
	if err != nil {
		return nil, fmt.Errorf("keychain fallback init: %w", err)
	}
	return &KeychainResolver{defaultAccount: account, fallback: store}, nil
}

// Resolve fetches a keychain://service[#account] reference. It tries
// the OS keystore first; on "keystore unavailable" (D-Bus errors,
// missing daemon) it falls through to the encrypted user file.
func (k *KeychainResolver) Resolve(_ context.Context, ref string) (string, error) {
	if !strings.HasPrefix(ref, "keychain://") {
		return "", fmt.Errorf("keychain: not a keychain:// ref: %s", ref)
	}
	svc, acct := parseKeychainRef(ref, k.defaultAccount)
	v, err := osKeyringGet(svc, acct)
	if err == nil {
		return v, nil
	}
	if !isKeyringUnavailable(err) {
		return "", fmt.Errorf("keychain: %s#%s: %w", svc, acct, err)
	}
	k.warnFallback()
	v, ok := k.fallback.Get(fallbackKey(svc, acct))
	if !ok {
		return "", fmt.Errorf("keychain: %s#%s not found", svc, acct)
	}
	return v, nil
}

// Close is a no-op. The fallback store has no resources to release.
func (k *KeychainResolver) Close() error { return nil }

// parseKeychainRef splits keychain://<service>[#<account>] into its
// two parts, substituting defaultAcct when the # is omitted.
func parseKeychainRef(ref, defaultAcct string) (svc, acct string) {
	path := strings.TrimPrefix(ref, "keychain://")
	parts := strings.SplitN(path, "#", 2)
	svc = parts[0]
	acct = defaultAcct
	if len(parts) == 2 {
		acct = parts[1]
	}
	return
}

// fallbackKey is how an OS-keystore (service, account) tuple is
// flattened into a single key inside the AES file store.
func fallbackKey(svc, acct string) string { return svc + "#" + acct }
