package crypto

import (
	"bytes"
	"context"
	"errors"
	"testing"
)

// memKMS is the in-memory KMS used in tests. Each KEK ARN maps to a
// 32-byte secret; revoked ARNs return ErrRevoked from Unwrap so the
// destructive test can simulate a customer pulling their grant.
type memKMS struct {
	keks    map[string][]byte
	revoked map[string]bool
}

func newMemKMS() *memKMS {
	return &memKMS{
		keks:    map[string][]byte{},
		revoked: map[string]bool{},
	}
}

func (m *memKMS) addKEK(arn string) {
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i + 1)
	}
	m.keks[arn] = key
}

func (m *memKMS) revoke(arn string) { m.revoked[arn] = true }

func (m *memKMS) Wrap(_ Ctx, arn string, dek []byte) ([]byte, error) {
	if m.revoked[arn] {
		return nil, ErrRevoked
	}
	kek, ok := m.keks[arn]
	if !ok {
		return nil, errors.New("memkms: unknown kek")
	}
	out := make([]byte, len(dek))
	for i := range dek {
		out[i] = dek[i] ^ kek[i%len(kek)]
	}
	return out, nil
}

func (m *memKMS) Unwrap(_ Ctx, arn string, wrapped []byte) ([]byte, error) {
	if m.revoked[arn] {
		return nil, ErrRevoked
	}
	return m.Wrap(nil, arn, wrapped)
}

func TestEncryptDecryptRoundtrip(t *testing.T) {
	kms := newMemKMS()
	kms.addKEK("arn:aws:kms:us-east-1:111:key/abc")
	enc := NewEncryptor(kms)

	plaintext := []byte("super secret tenant document body")
	env, err := enc.Encrypt(context.Background(), "arn:aws:kms:us-east-1:111:key/abc", plaintext)
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}
	if bytes.Equal(env.Ciphertext, plaintext) {
		t.Fatal("ciphertext equals plaintext")
	}
	if len(env.Nonce) == 0 || len(env.WrappedDEK) == 0 {
		t.Fatal("envelope missing fields")
	}

	got, err := enc.Decrypt(context.Background(), env)
	if err != nil {
		t.Fatalf("Decrypt: %v", err)
	}
	if !bytes.Equal(got, plaintext) {
		t.Fatalf("roundtrip mismatch: got=%q want=%q", got, plaintext)
	}
}

// TestRevokedKEKReturnsErrRevoked is the destructive contract test
// BEAT-PLAN S3.1 calls out: revoking the IAM grant on the KEK must
// make stored documents undecryptable on next read.
func TestRevokedKEKReturnsErrRevoked(t *testing.T) {
	kms := newMemKMS()
	kms.addKEK("arn:revoke-me")
	enc := NewEncryptor(kms)

	env, err := enc.Encrypt(context.Background(), "arn:revoke-me", []byte("payload"))
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}

	kms.revoke("arn:revoke-me")

	_, err = enc.Decrypt(context.Background(), env)
	if !errors.Is(err, ErrRevoked) {
		t.Fatalf("expected ErrRevoked, got %v", err)
	}
}

func TestEncryptRequiresKEKARN(t *testing.T) {
	enc := NewEncryptor(newMemKMS())
	if _, err := enc.Encrypt(context.Background(), "", []byte("x")); err == nil {
		t.Fatal("expected error for empty kekARN")
	}
}

func TestNewEncryptorPanicsOnNilKMS(t *testing.T) {
	defer func() {
		if r := recover(); r == nil {
			t.Fatal("expected panic")
		}
	}()
	NewEncryptor(nil)
}

func TestDecryptNilEnvelope(t *testing.T) {
	enc := NewEncryptor(newMemKMS())
	if _, err := enc.Decrypt(context.Background(), nil); err == nil {
		t.Fatal("expected error for nil envelope")
	}
}
