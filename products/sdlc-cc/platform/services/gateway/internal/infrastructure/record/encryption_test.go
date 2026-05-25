// Tests for envelope encryption: round-trip, wrong-KEK rejection,
// auth-tag check on tampering, and loud env-var validation.
package record

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestKEK(t *testing.T) *EnvKEK {
	t.Helper()
	kek := make([]byte, 32)
	_, err := rand.Read(kek)
	require.NoError(t, err)
	t.Setenv("RECORD_KEK_BASE64", base64.StdEncoding.EncodeToString(kek))
	k, err := NewEnvKEK()
	require.NoError(t, err)
	return k
}

func TestEnvKEK_RequiresEnvVar(t *testing.T) {
	t.Setenv("RECORD_KEK_BASE64", "")
	_, err := NewEnvKEK()
	assert.Error(t, err, "missing env var must error loudly")
}

func TestEnvKEK_RejectsBadBase64(t *testing.T) {
	t.Setenv("RECORD_KEK_BASE64", "!!! not base64 !!!")
	_, err := NewEnvKEK()
	assert.Error(t, err)
}

func TestEnvKEK_RejectsWrongLength(t *testing.T) {
	short := make([]byte, 16) // AES-128-sized key, not what we want
	_, _ = rand.Read(short)
	t.Setenv("RECORD_KEK_BASE64", base64.StdEncoding.EncodeToString(short))
	_, err := NewEnvKEK()
	assert.Error(t, err, "wrong length must error loudly")
}

func TestEnvelope_RoundTrip(t *testing.T) {
	kek := newTestKEK(t)
	env := NewEnvelope(kek)
	plaintext := []byte(`{"type":"request","payload":{"q":"hello"}}`)

	ct, err := env.Encrypt(context.Background(), plaintext)
	require.NoError(t, err)
	assert.NotEmpty(t, ct.WrappedDEK)
	assert.NotEmpty(t, ct.Nonce)
	assert.NotEmpty(t, ct.Sealed)
	assert.NotEqual(t, plaintext, ct.Sealed, "sealed bytes must not equal plaintext")

	got, err := env.Decrypt(context.Background(), ct)
	require.NoError(t, err)
	assert.Equal(t, plaintext, got)
}

func TestEnvelope_FreshDEKPerRecord(t *testing.T) {
	kek := newTestKEK(t)
	env := NewEnvelope(kek)
	a, err := env.Encrypt(context.Background(), []byte("same plaintext"))
	require.NoError(t, err)
	b, err := env.Encrypt(context.Background(), []byte("same plaintext"))
	require.NoError(t, err)
	assert.NotEqual(t, a.WrappedDEK, b.WrappedDEK, "DEK must be fresh per record")
	assert.NotEqual(t, a.Nonce, b.Nonce, "nonce must be fresh per record")
}

func TestEnvelope_WrongKEKFailsDecrypt(t *testing.T) {
	encKEK := newTestKEK(t)
	env := NewEnvelope(encKEK)
	ct, err := env.Encrypt(context.Background(), []byte("secret"))
	require.NoError(t, err)

	// Swap to a different KEK and try to decrypt.
	other := make([]byte, 32)
	_, _ = rand.Read(other)
	t.Setenv("RECORD_KEK_BASE64", base64.StdEncoding.EncodeToString(other))
	otherKEK, err := NewEnvKEK()
	require.NoError(t, err)
	otherEnv := NewEnvelope(otherKEK)

	_, err = otherEnv.Decrypt(context.Background(), ct)
	assert.Error(t, err, "wrong KEK must fail decryption")
}

func TestEnvelope_TamperedNonceFailsAuthTag(t *testing.T) {
	kek := newTestKEK(t)
	env := NewEnvelope(kek)
	ct, err := env.Encrypt(context.Background(), []byte("payload"))
	require.NoError(t, err)
	ct.Nonce[0] ^= 0xFF // flip first byte of nonce
	_, err = env.Decrypt(context.Background(), ct)
	assert.Error(t, err, "tampered nonce must fail AES-GCM auth tag")
}

func TestEnvelope_TamperedSealedFailsAuthTag(t *testing.T) {
	kek := newTestKEK(t)
	env := NewEnvelope(kek)
	ct, err := env.Encrypt(context.Background(), []byte("payload"))
	require.NoError(t, err)
	ct.Sealed[len(ct.Sealed)-1] ^= 0xFF
	_, err = env.Decrypt(context.Background(), ct)
	assert.Error(t, err, "tampered ciphertext must fail AES-GCM auth tag")
}

func TestEnvelope_NilKEKErrors(t *testing.T) {
	env := NewEnvelope(nil)
	_, err := env.Encrypt(context.Background(), []byte("x"))
	assert.Error(t, err)
	_, err = env.Decrypt(context.Background(), Ciphertext{})
	assert.Error(t, err)
}

func TestCiphertext_MarshalRoundTrip(t *testing.T) {
	kek := newTestKEK(t)
	env := NewEnvelope(kek)
	ct, err := env.Encrypt(context.Background(), []byte(`{"hello":"world"}`))
	require.NoError(t, err)

	blob, err := MarshalCiphertext(ct)
	require.NoError(t, err)
	got, err := UnmarshalCiphertext(blob)
	require.NoError(t, err)
	pt, err := env.Decrypt(context.Background(), got)
	require.NoError(t, err)
	assert.Equal(t, `{"hello":"world"}`, string(pt))
}
