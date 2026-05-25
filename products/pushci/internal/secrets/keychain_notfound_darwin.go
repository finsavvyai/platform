//go:build darwin

package secrets

// isExternalKeyringNotFound is a no-op on darwin — the only
// not-found path here is the local errKeychainNotFound sentinel
// returned by osKeyringGet. Kept as a separate function so the
// non-darwin file can map go-keyring's ErrNotFound onto our
// unified fallback path.
func isExternalKeyringNotFound(_ error) bool { return false }
