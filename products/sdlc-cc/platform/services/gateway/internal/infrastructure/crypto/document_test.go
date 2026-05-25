package crypto

import (
	"context"
	"testing"

	"github.com/google/uuid"
)

// We can't unit-test EncryptForTenant against a real pgx pool here.
// The Encrypt + Decrypt roundtrip and the ErrRevoked path are already
// covered by envelope_test.go. This file exercises the boundary cases
// the document path will trip first — nil tenant, panic-on-misconfig.

func TestNewDocumentEncryptor_PanicsOnNilEnc(t *testing.T) {
	defer func() {
		if r := recover(); r == nil {
			t.Fatal("expected panic on nil Encryptor")
		}
	}()
	NewDocumentEncryptor(nil, nil)
}

func TestEncryptForTenant_NilTenantSkipsCMEK(t *testing.T) {
	// We can construct a DocumentEncryptor with a real Encryptor but
	// can't easily mock the pgxpool.Pool. The early-return for
	// uuid.Nil is covered without touching the pool.
	d := &DocumentEncryptor{enc: NewEncryptor(newMemKMS())}
	env, err := d.EncryptForTenant(context.Background(), uuid.Nil, []byte("body"))
	if err != nil {
		t.Fatalf("Nil tenant: %v", err)
	}
	if env != nil {
		t.Fatal("Nil tenant must return (nil, nil)")
	}
}
