package audit

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func seedStore(t *testing.T) *MemoryStore {
	t.Helper()
	store := NewMemoryStore()
	ctx := context.Background()
	base := time.Date(2026, 3, 1, 10, 0, 0, 0, time.UTC)

	entries := []AuditEntry{
		{TenantID: "t1", ActorID: "u1", ActorRole: "admin", Action: ActionLogin, Resource: "session", Details: map[string]string{"browser": "Chrome"}, IPAddress: "10.0.0.1", Timestamp: base},
		{TenantID: "t1", ActorID: "u1", ActorRole: "admin", Action: ActionRuleCreate, Resource: "rules", Details: map[string]string{"rule_name": "velocity_check"}, IPAddress: "10.0.0.1", Timestamp: base.Add(time.Minute)},
		{TenantID: "t1", ActorID: "u2", ActorRole: "viewer", Action: ActionTransactionScan, Resource: "transactions", Details: map[string]string{"txn_id": "tx-100"}, IPAddress: "10.0.0.2", Timestamp: base.Add(2 * time.Minute)},
		{TenantID: "t1", ActorID: "u1", ActorRole: "admin", Action: ActionConfigUpdate, Resource: "config", Details: map[string]string{"key": "threshold"}, IPAddress: "10.0.0.1", Timestamp: base.Add(3 * time.Minute)},
		{TenantID: "t2", ActorID: "u3", ActorRole: "admin", Action: ActionLogin, Resource: "session", Details: map[string]string{"browser": "Firefox"}, IPAddress: "10.0.1.1", Timestamp: base.Add(4 * time.Minute)},
	}
	for i := range entries {
		require.NoError(t, store.Insert(ctx, &entries[i]))
	}
	return store
}

func TestMemoryStore_Insert(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()
	e := AuditEntry{TenantID: "t1", ActorID: "u1", Action: ActionLogin, Resource: "session"}
	require.NoError(t, store.Insert(ctx, &e))
	assert.NotEmpty(t, e.ID)
	assert.False(t, e.Timestamp.IsZero())
}

func TestMemoryStore_GetByID(t *testing.T) {
	store := seedStore(t)
	ctx := context.Background()

	t.Run("found", func(t *testing.T) {
		got, err := store.GetByID(ctx, "t1", "audit-1")
		require.NoError(t, err)
		assert.Equal(t, ActionLogin, got.Action)
	})

	t.Run("wrong tenant", func(t *testing.T) {
		_, err := store.GetByID(ctx, "t2", "audit-1")
		assert.ErrorIs(t, err, ErrEntryNotFound)
	})

	t.Run("missing", func(t *testing.T) {
		_, err := store.GetByID(ctx, "t1", "audit-999")
		assert.ErrorIs(t, err, ErrEntryNotFound)
	})
}

func TestMemoryStore_TenantIsolation(t *testing.T) {
	store := seedStore(t)
	ctx := context.Background()

	q := AuditQuery{TenantID: "t1", Limit: 100, SortOrder: SortDesc}
	entries, _, err := store.List(ctx, q)
	require.NoError(t, err)
	assert.Len(t, entries, 4)

	for _, e := range entries {
		assert.Equal(t, "t1", e.TenantID)
	}

	q2 := AuditQuery{TenantID: "t2", Limit: 100, SortOrder: SortDesc}
	entries2, _, err := store.List(ctx, q2)
	require.NoError(t, err)
	assert.Len(t, entries2, 1)
}

func TestMemoryStore_Pagination(t *testing.T) {
	store := seedStore(t)
	ctx := context.Background()

	q := AuditQuery{TenantID: "t1", Limit: 2, SortOrder: SortDesc}
	page1, cursor1, err := store.List(ctx, q)
	require.NoError(t, err)
	assert.Len(t, page1, 2)
	assert.NotEmpty(t, cursor1)

	q.Cursor = cursor1
	page2, cursor2, err := store.List(ctx, q)
	require.NoError(t, err)
	assert.Len(t, page2, 2)
	assert.Empty(t, cursor2, "last page should have empty cursor")
}

func TestMemoryStore_FilterByActor(t *testing.T) {
	store := seedStore(t)
	ctx := context.Background()

	q := AuditQuery{
		TenantID:  "t1",
		Filters:   AuditFilter{Actor: "u2"},
		Limit:     50,
		SortOrder: SortDesc,
	}
	entries, _, err := store.List(ctx, q)
	require.NoError(t, err)
	assert.Len(t, entries, 1)
	assert.Equal(t, "u2", entries[0].ActorID)
}

func TestMemoryStore_FilterByAction(t *testing.T) {
	store := seedStore(t)
	ctx := context.Background()

	q := AuditQuery{
		TenantID:  "t1",
		Filters:   AuditFilter{Action: ActionLogin},
		Limit:     50,
		SortOrder: SortDesc,
	}
	entries, _, err := store.List(ctx, q)
	require.NoError(t, err)
	assert.Len(t, entries, 1)
}

func TestMemoryStore_FilterByDateRange(t *testing.T) {
	store := seedStore(t)
	ctx := context.Background()

	base := time.Date(2026, 3, 1, 10, 0, 0, 0, time.UTC)
	from := base.Add(90 * time.Second)
	to := base.Add(5 * time.Minute)

	q := AuditQuery{
		TenantID:  "t1",
		Filters:   AuditFilter{From: &from, To: &to},
		Limit:     50,
		SortOrder: SortDesc,
	}
	entries, _, err := store.List(ctx, q)
	require.NoError(t, err)
	assert.Len(t, entries, 2, "entries between 1.5 and 5 minutes")
}

func TestMemoryStore_KeywordSearch(t *testing.T) {
	store := seedStore(t)
	ctx := context.Background()

	q := AuditQuery{
		TenantID:  "t1",
		Filters:   AuditFilter{Keyword: "velocity"},
		Limit:     50,
		SortOrder: SortDesc,
	}
	entries, _, err := store.List(ctx, q)
	require.NoError(t, err)
	assert.Len(t, entries, 1)
	assert.Equal(t, ActionRuleCreate, entries[0].Action)
}

func TestMemoryStore_CombinedFilters(t *testing.T) {
	store := seedStore(t)
	ctx := context.Background()

	base := time.Date(2026, 3, 1, 10, 0, 0, 0, time.UTC)
	to := base.Add(2 * time.Minute)

	q := AuditQuery{
		TenantID: "t1",
		Filters: AuditFilter{
			Actor: "u1",
			To:    &to,
		},
		Limit:     50,
		SortOrder: SortAsc,
	}
	entries, _, err := store.List(ctx, q)
	require.NoError(t, err)
	assert.Len(t, entries, 2)
	assert.True(t, entries[0].Timestamp.Before(entries[1].Timestamp))
}

func TestMemoryStore_GetStats(t *testing.T) {
	store := seedStore(t)
	ctx := context.Background()

	stats, err := store.GetStats(ctx, "t1", AuditFilter{})
	require.NoError(t, err)
	assert.Equal(t, 4, stats.TotalEvents)
	assert.Equal(t, 2, stats.UniqueActors)
	assert.NotEmpty(t, string(stats.TopAction))
	assert.NotEmpty(t, stats.TopResource)
}

func TestMemoryStore_GetStats_TimeFilter(t *testing.T) {
	store := seedStore(t)
	ctx := context.Background()

	base := time.Date(2026, 3, 1, 10, 0, 0, 0, time.UTC)
	from := base.Add(90 * time.Second)

	stats, err := store.GetStats(ctx, "t1", AuditFilter{From: &from})
	require.NoError(t, err)
	assert.Equal(t, 2, stats.TotalEvents)
}
