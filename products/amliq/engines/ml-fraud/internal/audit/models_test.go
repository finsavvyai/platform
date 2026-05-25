package audit

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAuditEntry_Validate(t *testing.T) {
	valid := AuditEntry{
		TenantID: "t-1", ActorID: "u-1",
		Action: ActionLogin, Resource: "session",
	}
	require.NoError(t, valid.Validate())

	tests := []struct {
		name    string
		modify  func(e *AuditEntry)
		wantErr error
	}{
		{"empty tenant", func(e *AuditEntry) { e.TenantID = "" }, ErrEmptyTenantID},
		{"empty actor", func(e *AuditEntry) { e.ActorID = "" }, ErrEmptyActorID},
		{"empty action", func(e *AuditEntry) { e.Action = "" }, ErrEmptyAction},
		{"empty resource", func(e *AuditEntry) { e.Resource = "" }, ErrEmptyResource},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			e := valid
			tc.modify(&e)
			assert.ErrorIs(t, e.Validate(), tc.wantErr)
		})
	}
}

func TestAuditFilter_Validate(t *testing.T) {
	now := time.Now()
	past := now.Add(-time.Hour)

	t.Run("valid range", func(t *testing.T) {
		f := AuditFilter{From: &past, To: &now}
		assert.NoError(t, f.Validate())
	})

	t.Run("invalid range", func(t *testing.T) {
		f := AuditFilter{From: &now, To: &past}
		assert.ErrorIs(t, f.Validate(), ErrInvalidDateRange)
	})

	t.Run("nil bounds", func(t *testing.T) {
		f := AuditFilter{}
		assert.NoError(t, f.Validate())
	})
}

func TestAuditQuery_Validate(t *testing.T) {
	t.Run("defaults applied", func(t *testing.T) {
		q := AuditQuery{TenantID: "t-1"}
		require.NoError(t, q.Validate())
		assert.Equal(t, DefaultLimit, q.Limit)
		assert.Equal(t, SortDesc, q.SortOrder)
	})

	t.Run("limit capped", func(t *testing.T) {
		q := AuditQuery{TenantID: "t-1", Limit: 999}
		require.NoError(t, q.Validate())
		assert.Equal(t, MaxLimit, q.Limit)
	})

	t.Run("empty tenant", func(t *testing.T) {
		q := AuditQuery{}
		assert.ErrorIs(t, q.Validate(), ErrEmptyTenantID)
	})

	t.Run("invalid sort order", func(t *testing.T) {
		q := AuditQuery{TenantID: "t-1", SortOrder: "bad"}
		assert.ErrorIs(t, q.Validate(), ErrInvalidSortOrder)
	})

	t.Run("propagates filter error", func(t *testing.T) {
		now := time.Now()
		past := now.Add(-time.Hour)
		q := AuditQuery{
			TenantID: "t-1",
			Filters:  AuditFilter{From: &now, To: &past},
		}
		assert.ErrorIs(t, q.Validate(), ErrInvalidDateRange)
	})
}

func TestAuditStats_Initialization(t *testing.T) {
	s := AuditStats{
		TotalEvents:  100,
		UniqueActors: 5,
		TopAction:    ActionLogin,
		TopResource:  "session",
		ActionCounts: map[ActionType]int{ActionLogin: 50},
	}
	assert.Equal(t, 100, s.TotalEvents)
	assert.Equal(t, 50, s.ActionCounts[ActionLogin])
}
