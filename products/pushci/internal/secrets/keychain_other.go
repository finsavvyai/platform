//go:build !darwin

package secrets

import "github.com/zalando/go-keyring"

// osKeyringGet wraps go-keyring on non-darwin platforms. The lib
// handles Windows Credential Manager (wincred) and Linux libsecret
// transparently. macOS uses keychain_darwin.go's raw `security`
// CLI instead so values round-trip without the `go-keyring-base64:`
// prefix the lib adds on darwin.
func osKeyringGet(svc, acct string) (string, error) {
	return keyring.Get(svc, acct)
}

func osKeyringSet(svc, acct, val string) error {
	return keyring.Set(svc, acct, val)
}

func osKeyringDelete(svc, acct string) error {
	return keyring.Delete(svc, acct)
}
