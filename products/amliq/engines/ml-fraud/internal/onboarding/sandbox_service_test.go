package onboarding

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestProvision_CreatesSandbox(t *testing.T) {
	svc := NewInMemorySandboxService(30)
	cfg, err := svc.Provision(context.Background(), "tenant-1")

	require.NoError(t, err)
	assert.Equal(t, "tenant-1", cfg.TenantID)
	assert.Equal(t, "https://sandbox.finsavvy.ai/api/v1", cfg.APIEndpoint)
	assert.True(t, cfg.SyntheticDataLoaded)
	assert.Equal(t, 100, cfg.TransactionCount)
	assert.WithinDuration(t, time.Now().AddDate(0, 0, 30), cfg.ExpiresAt, 5*time.Second)
}

func TestProvision_APIKeyHasPrefix(t *testing.T) {
	svc := NewInMemorySandboxService(7)
	cfg, err := svc.Provision(context.Background(), "tenant-prefix")

	require.NoError(t, err)
	assert.True(t, strings.HasPrefix(cfg.APIKey, "sk_sandbox_"))
	// sk_sandbox_ (11 chars) + 16 hex chars = 27 total
	assert.Len(t, cfg.APIKey, 27)
}

func TestProvision_RejectsDuplicate(t *testing.T) {
	svc := NewInMemorySandboxService(7)
	_, err := svc.Provision(context.Background(), "tenant-dup")
	require.NoError(t, err)

	_, err = svc.Provision(context.Background(), "tenant-dup")
	assert.ErrorIs(t, err, ErrSandboxAlreadyExists)
}

func TestGetStatus_ReturnsSandbox(t *testing.T) {
	svc := NewInMemorySandboxService(14)
	ctx := context.Background()
	provisioned, _ := svc.Provision(ctx, "tenant-get")

	cfg, err := svc.GetStatus(ctx, "tenant-get")
	require.NoError(t, err)
	assert.Equal(t, provisioned.TenantID, cfg.TenantID)
	// Stored key is hashed; it should not match the plaintext returned on creation.
	assert.NotEqual(t, provisioned.APIKey, cfg.APIKey)
	assert.Equal(t, hashAPIKey(provisioned.APIKey), cfg.APIKey)
}

func TestGetStatus_ErrorForUnknownTenant(t *testing.T) {
	svc := NewInMemorySandboxService(7)

	_, err := svc.GetStatus(context.Background(), "nonexistent")
	assert.ErrorIs(t, err, ErrSandboxNotFound)
}

func TestCleanup_RemovesSandbox(t *testing.T) {
	svc := NewInMemorySandboxService(7)
	ctx := context.Background()
	_, _ = svc.Provision(ctx, "tenant-clean")

	err := svc.Cleanup(ctx, "tenant-clean")
	require.NoError(t, err)

	_, err = svc.GetStatus(ctx, "tenant-clean")
	assert.ErrorIs(t, err, ErrSandboxNotFound)
}

func TestCleanup_ErrorForUnknownTenant(t *testing.T) {
	svc := NewInMemorySandboxService(7)

	err := svc.Cleanup(context.Background(), "ghost")
	assert.ErrorIs(t, err, ErrSandboxNotFound)
}

func TestIsExpired_FutureDate(t *testing.T) {
	svc := NewInMemorySandboxService(30)
	ctx := context.Background()
	_, _ = svc.Provision(ctx, "tenant-future")

	expired, err := svc.IsExpired(ctx, "tenant-future")
	require.NoError(t, err)
	assert.False(t, expired)
}

func TestIsExpired_PastDate(t *testing.T) {
	svc := NewInMemorySandboxService(1)
	ctx := context.Background()
	_, _ = svc.Provision(ctx, "tenant-past")

	// Manually set expiry to the past.
	svc.mu.Lock()
	svc.sandboxes["tenant-past"].ExpiresAt = time.Now().Add(-1 * time.Hour)
	svc.mu.Unlock()

	expired, err := svc.IsExpired(ctx, "tenant-past")
	require.NoError(t, err)
	assert.True(t, expired)
}

func TestIsExpired_ErrorForUnknownTenant(t *testing.T) {
	svc := NewInMemorySandboxService(7)

	_, err := svc.IsExpired(context.Background(), "missing")
	assert.ErrorIs(t, err, ErrSandboxNotFound)
}

func TestGenerateSandboxAPIKey_Format(t *testing.T) {
	key, err := generateSandboxAPIKey()
	require.NoError(t, err)

	assert.True(t, strings.HasPrefix(key, "sk_sandbox_"))
	assert.Len(t, key, 27)

	// Verify hex portion is valid hex.
	hexPart := key[len("sk_sandbox_"):]
	assert.Len(t, hexPart, 16)
	for _, c := range hexPart {
		assert.True(t, (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'),
			"expected hex char, got %c", c)
	}
}

func TestGenerateSandboxAPIKey_Uniqueness(t *testing.T) {
	key1, err := generateSandboxAPIKey()
	require.NoError(t, err)

	key2, err := generateSandboxAPIKey()
	require.NoError(t, err)

	assert.NotEqual(t, key1, key2)
}

// Verify InMemorySandboxService satisfies the SandboxService interface.
var _ SandboxService = (*InMemorySandboxService)(nil)
