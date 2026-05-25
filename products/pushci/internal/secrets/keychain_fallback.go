package secrets

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
)

// errKeychainNotFound is the sentinel surfaced when a service/account
// pair is missing from the OS keystore. isKeyringUnavailable maps it
// onto the "try fallback file" path so a missing OS entry transparently
// falls through to the encrypted user file. Lives in this untagged
// file so darwin (raw `security` CLI) and non-darwin (go-keyring) can
// both produce it without import cycles.
var errKeychainNotFound = errors.New("keychain entry not found")

// newUserStore opens a per-user AES-encrypted secret file at
// $HOME/.pushci/keychain.enc. Distinct from the per-project file
// produced by secrets.New so that machine-wide keychain entries
// don't leak across projects.
func newUserStore(home string) (*Store, error) {
	path := filepath.Join(home, ".pushci", "keychain.enc")
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return nil, err
	}
	return &Store{path: path, key: deriveKey(home)}, nil
}

// isKeyringUnavailable distinguishes "the OS keystore can't serve us
// at all" from "the entry isn't there." Only the former should
// trigger fallback to the encrypted file. ErrNotFound from go-keyring
// is intentionally bucketed into "unavailable" so we transparently
// look in the fallback file for entries the user only ever stored
// there (e.g. a headless CI box that never had a Keychain).
func isKeyringUnavailable(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, errKeychainNotFound) || isExternalKeyringNotFound(err) {
		return true
	}
	msg := err.Error()
	for _, needle := range keyringUnavailableMarkers {
		if strings.Contains(msg, needle) {
			return true
		}
	}
	return false
}

// keyringUnavailableMarkers is the heuristic set of substrings that
// go-keyring surfaces when the OS keystore is missing or locked.
// macOS reports clean errors via Security.framework; Linux exposes
// the raw D-Bus error; Windows is similar. Kept here so the resolver
// stays focused on dispatch rather than error parsing.
var keyringUnavailableMarkers = []string{
	"secret-service",
	"dbus",
	"Cannot autolaunch",
	"not provided by any .service files",
	"service does not exist",
	"keyring not available",
	"no usable keyring",
}
