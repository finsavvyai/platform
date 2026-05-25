package handlers

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/finsavvyai/pipewarden/internal/storage"
	"github.com/finsavvyai/pipewarden/internal/vault"
)

// ---------------------------------------------------------------------------
// EncryptCredentials
// ---------------------------------------------------------------------------

func TestEncryptCredentials_NoVault_NoSecrets_OK(t *testing.T) {
	h := newTestHandlersNoVault(t)

	rec := &storage.ConnectionRecord{
		Name:     "myconn",
		Platform: "github",
		// No Token/Username/AppPassword — vault not required.
	}

	err := h.EncryptCredentials(rec)
	assert.NoError(t, err)
}

func TestEncryptCredentials_NoVault_WithToken_Fails(t *testing.T) {
	h := newTestHandlersNoVault(t)

	rec := &storage.ConnectionRecord{
		Name:     "myconn",
		Platform: "github",
		Token:    "ghp_secret",
	}

	err := h.EncryptCredentials(rec)
	require.Error(t, err)
	assert.ErrorIs(t, err, errVaultRequired)
}

func TestEncryptCredentials_WithVault_EncryptsToken(t *testing.T) {
	h, v := newTestHandlersWithVault(t)

	original := "ghp_plaintext_token"
	rec := &storage.ConnectionRecord{
		Name:     "myconn",
		Platform: "github",
		Token:    original,
	}

	require.NoError(t, h.EncryptCredentials(rec))
	// Token must be different from the original (it is now ciphertext).
	assert.NotEqual(t, original, rec.Token)
	// Vault must be able to decrypt it back.
	decrypted, err := v.Decrypt(rec.Token)
	require.NoError(t, err)
	assert.Equal(t, original, decrypted)
}

func TestEncryptCredentials_WithVault_EncryptsAll(t *testing.T) {
	h, v := newTestHandlersWithVault(t)

	rec := &storage.ConnectionRecord{
		Name:        "bb-conn",
		Platform:    "bitbucket",
		Token:       "tok",
		Username:    "user@example.com",
		AppPassword: "secret-app-pw",
	}

	require.NoError(t, h.EncryptCredentials(rec))

	// All three fields should be ciphertext.
	for _, field := range []struct {
		name  string
		value string
		plain string
	}{
		{"token", rec.Token, "tok"},
		{"username", rec.Username, "user@example.com"},
		{"app_password", rec.AppPassword, "secret-app-pw"},
	} {
		assert.NotEqual(t, field.plain, field.value, "%s should be encrypted", field.name)
		got, err := v.Decrypt(field.value)
		require.NoError(t, err, "decrypt %s", field.name)
		assert.Equal(t, field.plain, got, "%s round-trip", field.name)
	}
}

// ---------------------------------------------------------------------------
// DecryptCredentials
// ---------------------------------------------------------------------------

func TestDecryptCredentials_NoVault_NoSecrets_OK(t *testing.T) {
	h := newTestHandlersNoVault(t)

	rec := &storage.ConnectionRecord{Name: "myconn"}
	assert.NoError(t, h.DecryptCredentials(rec))
}

func TestDecryptCredentials_WithVault_RoundTrip(t *testing.T) {
	h, v := newTestHandlersWithVault(t)

	plainToken := "ghp_round_trip"
	cipherToken, err := v.Encrypt(plainToken)
	require.NoError(t, err)

	rec := &storage.ConnectionRecord{
		Name:  "conn",
		Token: cipherToken,
	}

	require.NoError(t, h.DecryptCredentials(rec))
	assert.Equal(t, plainToken, rec.Token)
}

func TestDecryptCredentials_InvalidCiphertext_Fails(t *testing.T) {
	h, _ := newTestHandlersWithVault(t) //nolint:dogsled

	rec := &storage.ConnectionRecord{
		Name:  "conn",
		Token: "this-is-not-valid-base64-ciphertext!!!",
	}

	err := h.DecryptCredentials(rec)
	require.Error(t, err)
}

// ---------------------------------------------------------------------------
// vaultErrorStatus
// ---------------------------------------------------------------------------

func TestVaultErrorStatus_VaultRequired(t *testing.T) {
	assert.Equal(t, 503, vaultErrorStatus(errVaultRequired))
}

func TestVaultErrorStatus_WrappedVaultRequired(t *testing.T) {
	// requireVaultForConnection wraps errVaultRequired.
	rec := &storage.ConnectionRecord{Token: "tok"}
	err := requireVaultForConnection(rec, false)
	assert.Equal(t, 503, vaultErrorStatus(err))
}

func TestVaultErrorStatus_OtherError(t *testing.T) {
	h, _ := newTestHandlersWithVault(t)
	rec := &storage.ConnectionRecord{Token: "bad-ciphertext"}
	err := h.DecryptCredentials(rec)
	require.Error(t, err)
	// A generic decrypt error should map to 500.
	assert.Equal(t, 500, vaultErrorStatus(err))
}

// ---------------------------------------------------------------------------
// connectionHasPersistedSecrets / requireVaultForConnection
// ---------------------------------------------------------------------------

func TestConnectionHasPersistedSecrets_Empty(t *testing.T) {
	assert.False(t, connectionHasPersistedSecrets(&storage.ConnectionRecord{}))
	assert.False(t, connectionHasPersistedSecrets(nil))
}

func TestConnectionHasPersistedSecrets_TokenPresent(t *testing.T) {
	assert.True(t, connectionHasPersistedSecrets(&storage.ConnectionRecord{Token: "tok"}))
}

func TestConnectionHasPersistedSecrets_UsernamePresent(t *testing.T) {
	assert.True(t, connectionHasPersistedSecrets(&storage.ConnectionRecord{Username: "u"}))
}

func TestConnectionHasPersistedSecrets_AppPasswordPresent(t *testing.T) {
	assert.True(t, connectionHasPersistedSecrets(&storage.ConnectionRecord{AppPassword: "p"}))
}

func TestRequireVaultForConnection_SecretAndVaultDisabled(t *testing.T) {
	err := requireVaultForConnection(&storage.ConnectionRecord{Token: "tok"}, false)
	require.Error(t, err)
	assert.ErrorIs(t, err, errVaultRequired)
}

func TestRequireVaultForConnection_SecretAndVaultEnabled(t *testing.T) {
	err := requireVaultForConnection(&storage.ConnectionRecord{Token: "tok"}, true)
	assert.NoError(t, err)
}

func TestRequireVaultForConnection_NoSecretVaultDisabled(t *testing.T) {
	err := requireVaultForConnection(&storage.ConnectionRecord{}, false)
	assert.NoError(t, err)
}

// ---------------------------------------------------------------------------
// decryptRecord (package-level helper)
// ---------------------------------------------------------------------------

func TestDecryptRecord_VaultDisabled(t *testing.T) {
	v, _ := vault.New("") // disabled vault
	rec := &storage.ConnectionRecord{Token: "plaintext"}
	require.NoError(t, decryptRecord(rec, v))
	// Pass-through: value unchanged.
	assert.Equal(t, "plaintext", rec.Token)
}

func TestDecryptRecord_VaultEnabled_RoundTrip(t *testing.T) {
	v, err := vault.New("testkey-123")
	require.NoError(t, err)

	cipher, err := v.Encrypt("super-secret")
	require.NoError(t, err)

	rec := &storage.ConnectionRecord{Token: cipher}
	require.NoError(t, decryptRecord(rec, v))
	assert.Equal(t, "super-secret", rec.Token)
}
