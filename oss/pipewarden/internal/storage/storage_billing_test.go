package storage

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSaveAndConsumeOAuthState(t *testing.T) {
	db := newTestDB(t)

	expiresAt := time.Now().UTC().Add(5 * time.Minute)
	require.NoError(t, db.SaveOAuthState("state-abc", "github", expiresAt))

	// Valid consume
	require.NoError(t, db.ConsumeOAuthState("state-abc", "github"))

	// Second consume must fail (state deleted)
	err := db.ConsumeOAuthState("state-abc", "github")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "invalid or expired state")
}

func TestConsumeOAuthState_WrongProvider(t *testing.T) {
	db := newTestDB(t)

	expiresAt := time.Now().UTC().Add(5 * time.Minute)
	require.NoError(t, db.SaveOAuthState("state-xyz", "github", expiresAt))

	err := db.ConsumeOAuthState("state-xyz", "gitlab")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "invalid or expired state")
}

func TestConsumeOAuthState_Expired(t *testing.T) {
	db := newTestDB(t)

	expiresAt := time.Now().UTC().Add(-1 * time.Minute) // already expired
	require.NoError(t, db.SaveOAuthState("state-old", "github", expiresAt))

	err := db.ConsumeOAuthState("state-old", "github")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "invalid or expired state")
}

func TestSaveOAuthState_Upsert(t *testing.T) {
	db := newTestDB(t)

	exp1 := time.Now().UTC().Add(5 * time.Minute)
	exp2 := time.Now().UTC().Add(10 * time.Minute)
	require.NoError(t, db.SaveOAuthState("state-dup", "github", exp1))
	require.NoError(t, db.SaveOAuthState("state-dup", "github", exp2)) // upsert

	// Must still be consumable once
	require.NoError(t, db.ConsumeOAuthState("state-dup", "github"))
}

func TestUpsertAndGetSubscription(t *testing.T) {
	db := newTestDB(t)

	renewsAt := time.Now().UTC().Add(30 * 24 * time.Hour)
	rec := &SubscriptionRecord{
		TenantID:       "tenant-1",
		Tier:           "pro",
		Status:         "active",
		SubscriptionID: "sub_abc",
		CustomerID:     "cus_xyz",
		RenewsAt:       &renewsAt,
	}
	require.NoError(t, db.UpsertSubscription(rec))
	assert.False(t, rec.CreatedAt.IsZero())

	got, err := db.GetSubscription("tenant-1")
	require.NoError(t, err)
	assert.Equal(t, "tenant-1", got.TenantID)
	assert.Equal(t, "pro", got.Tier)
	assert.Equal(t, "active", got.Status)
	assert.Equal(t, "sub_abc", got.SubscriptionID)
	assert.NotNil(t, got.RenewsAt)
}

func TestUpsertSubscription_Update(t *testing.T) {
	db := newTestDB(t)

	rec := &SubscriptionRecord{TenantID: "tenant-2", Tier: "free", Status: "active"}
	require.NoError(t, db.UpsertSubscription(rec))

	rec.Tier = "enterprise"
	rec.Status = "cancelled"
	require.NoError(t, db.UpsertSubscription(rec))

	got, err := db.GetSubscription("tenant-2")
	require.NoError(t, err)
	assert.Equal(t, "enterprise", got.Tier)
	assert.Equal(t, "cancelled", got.Status)
}

func TestGetSubscription_NotFound(t *testing.T) {
	db := newTestDB(t)

	_, err := db.GetSubscription("nonexistent-tenant")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "subscription not found")
}

func TestSubscription_NullableTimestamps(t *testing.T) {
	db := newTestDB(t)

	// No RenewsAt / CancelledAt
	rec := &SubscriptionRecord{TenantID: "tenant-3", Tier: "free", Status: "active"}
	require.NoError(t, db.UpsertSubscription(rec))

	got, err := db.GetSubscription("tenant-3")
	require.NoError(t, err)
	assert.Nil(t, got.RenewsAt)
	assert.Nil(t, got.CancelledAt)
}

func TestSubscription_WithCancelledAt(t *testing.T) {
	db := newTestDB(t)

	cancelledAt := time.Now().UTC().Add(-24 * time.Hour)
	rec := &SubscriptionRecord{
		TenantID:    "tenant-cancelled",
		Tier:        "pro",
		Status:      "cancelled",
		CancelledAt: &cancelledAt,
	}
	require.NoError(t, db.UpsertSubscription(rec))

	got, err := db.GetSubscription("tenant-cancelled")
	require.NoError(t, err)
	require.NotNil(t, got.CancelledAt) // covers cancelledAt.Valid branch
	assert.Equal(t, "cancelled", got.Status)
}
