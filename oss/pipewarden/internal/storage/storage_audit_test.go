package storage

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAppendAuditLog_Basic(t *testing.T) {
	db := newTestDB(t)

	err := db.AppendAuditLog("connection.create", "user@example.com", "gh-main", "connection", map[string]string{"platform": "github"})
	require.NoError(t, err)

	entries, err := db.ListAuditLog("", "", 10, 0)
	require.NoError(t, err)
	require.Len(t, entries, 1)

	e := entries[0]
	assert.Equal(t, "connection.create", e.Action)
	assert.Equal(t, "user@example.com", e.Actor)
	assert.Equal(t, "gh-main", e.Resource)
	assert.Equal(t, "connection", e.ResourceType)
	assert.Equal(t, "github", e.Details["platform"])
}

func TestAppendAuditLog_NoDetails(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.AppendAuditLog("user.login", "alice", "/api/login", "auth", nil))

	entries, err := db.ListAuditLog("", "", 10, 0)
	require.NoError(t, err)
	require.Len(t, entries, 1)
	assert.Empty(t, entries[0].Details) // nil map for "{}" details
}

func TestListAuditLog_FilterByAction(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.AppendAuditLog("connection.create", "u1", "r1", "connection", nil))
	require.NoError(t, db.AppendAuditLog("connection.delete", "u1", "r1", "connection", nil))
	require.NoError(t, db.AppendAuditLog("scan.run", "u2", "r2", "scan", nil))

	creates, err := db.ListAuditLog("connection.create", "", 10, 0)
	require.NoError(t, err)
	assert.Len(t, creates, 1)
	assert.Equal(t, "connection.create", creates[0].Action)
}

func TestListAuditLog_FilterByResource(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.AppendAuditLog("act1", "u1", "res-a", "t", nil))
	require.NoError(t, db.AppendAuditLog("act2", "u1", "res-b", "t", nil))

	filtered, err := db.ListAuditLog("", "res-a", 10, 0)
	require.NoError(t, err)
	require.Len(t, filtered, 1)
	assert.Equal(t, "res-a", filtered[0].Resource)
}

func TestListAuditLog_Pagination(t *testing.T) {
	db := newTestDB(t)

	for i := 0; i < 10; i++ {
		require.NoError(t, db.AppendAuditLog("action", "actor", "resource", "type", nil))
	}

	page1, err := db.ListAuditLog("", "", 3, 0)
	require.NoError(t, err)
	assert.Len(t, page1, 3)

	page2, err := db.ListAuditLog("", "", 3, 3)
	require.NoError(t, err)
	assert.Len(t, page2, 3)
}

func TestListAuditLog_LimitCap(t *testing.T) {
	db := newTestDB(t)

	for i := 0; i < 5; i++ {
		require.NoError(t, db.AppendAuditLog("a", "b", "c", "d", nil))
	}

	// limit of 0 defaults to 50, negative defaults to 50
	results, err := db.ListAuditLog("", "", 0, 0)
	require.NoError(t, err)
	assert.Len(t, results, 5) // only 5 inserted

	// limit > 200 is capped to 200
	results, err = db.ListAuditLog("", "", 999, 0)
	require.NoError(t, err)
	assert.Len(t, results, 5)
}

func TestCountAuditLog_NoFilter(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.AppendAuditLog("a1", "u", "r1", "t", nil))
	require.NoError(t, db.AppendAuditLog("a2", "u", "r2", "t", nil))
	require.NoError(t, db.AppendAuditLog("a3", "u", "r1", "t", nil))

	count, err := db.CountAuditLog("", "")
	require.NoError(t, err)
	assert.Equal(t, 3, count)
}

func TestCountAuditLog_FilterByAction(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.AppendAuditLog("connection.create", "u", "r", "t", nil))
	require.NoError(t, db.AppendAuditLog("connection.create", "u", "r", "t", nil))
	require.NoError(t, db.AppendAuditLog("scan.run", "u", "r", "t", nil))

	count, err := db.CountAuditLog("connection.create", "")
	require.NoError(t, err)
	assert.Equal(t, 2, count)
}

func TestCountAuditLog_FilterByResource(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.AppendAuditLog("act", "u", "gh-main", "t", nil))
	require.NoError(t, db.AppendAuditLog("act", "u", "gl-prod", "t", nil))

	count, err := db.CountAuditLog("", "gh-main")
	require.NoError(t, err)
	assert.Equal(t, 1, count)
}

func TestCountAuditLog_Empty(t *testing.T) {
	db := newTestDB(t)

	count, err := db.CountAuditLog("", "")
	require.NoError(t, err)
	assert.Equal(t, 0, count)
}
