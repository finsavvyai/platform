package secrets

import (
	"context"
	"fmt"
)

// Resolver fetches a secret value by reference. The local AES store
// implements this; the Vault adapter does too. Runtime picks one per tenant.
type Resolver interface {
	Resolve(ctx context.Context, ref string) (string, error)
	Close() error
}

// Resolve implements Resolver for the local AES store.
// Non-vault references are looked up by key in the encrypted file.
func (s *Store) Resolve(_ context.Context, ref string) (string, error) {
	v, ok := s.Get(ref)
	if !ok {
		return "", fmt.Errorf("secret not found: %s", ref)
	}
	return v, nil
}

// Close is a no-op for the local store (no leases to revoke).
func (s *Store) Close() error { return nil }
