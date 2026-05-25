//go:build !darwin

package secrets

import (
	"errors"

	"github.com/zalando/go-keyring"
)

// isExternalKeyringNotFound maps the go-keyring "no such entry"
// sentinel into our unified fallback-trigger predicate. On non-darwin
// platforms go-keyring is the only backend, so its ErrNotFound is
// the canonical signal.
func isExternalKeyringNotFound(err error) bool {
	return errors.Is(err, keyring.ErrNotFound)
}
