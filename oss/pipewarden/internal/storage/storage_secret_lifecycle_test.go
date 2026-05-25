package storage

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func makeTestFinding(db *DB, t *testing.T) int64 {
	t.Helper()
	f := &FindingRecord{
		ConnectionName: "gh-main",
		RunID:          "run-1",
		Severity:       "high",
		Category:       "secrets",
		Title:          "AWS key exposed",
		Description:    "Key found in logs",
		Status:         "open",
	}
	require.NoError(t, db.CreateFinding(f))
	return f.ID
}

func TestUpsertSecretLifecycle_Insert(t *testing.T) {
	db := newTestDB(t)
	fid := makeTestFinding(db, t)

	require.NoError(t, db.UpsertSecretLifecycle(fid, "aws-access-key", "AKIA***REDACTED***"))

	rows, err := db.ListSecretLifecycle("")
	require.NoError(t, err)
	require.Len(t, rows, 1)

	r := rows[0]
	assert.Equal(t, fid, r.FindingID)
	assert.Equal(t, "aws-access-key", r.PatternName)
	assert.Equal(t, "AKIA***REDACTED***", r.RedactedValue)
	assert.Equal(t, "active", r.Status)
	assert.Nil(t, r.RevokedAt)
}

func TestUpsertSecretLifecycle_UpdateLastSeen(t *testing.T) {
	db := newTestDB(t)
	fid := makeTestFinding(db, t)

	require.NoError(t, db.UpsertSecretLifecycle(fid, "aws-access-key", "AKIA***1"))
	require.NoError(t, db.UpsertSecretLifecycle(fid, "aws-access-key", "AKIA***2")) // second upsert

	rows, err := db.ListSecretLifecycle("")
	require.NoError(t, err)
	// Should still be one row (same finding_id)
	assert.Len(t, rows, 1)
}

func TestRevokeSecret_Success(t *testing.T) {
	db := newTestDB(t)
	fid := makeTestFinding(db, t)

	require.NoError(t, db.UpsertSecretLifecycle(fid, "github-token", "ghp_***"))
	require.NoError(t, db.RevokeSecret(fid, "key was rotated"))

	rows, err := db.ListSecretLifecycle("revoked")
	require.NoError(t, err)
	require.Len(t, rows, 1)
	assert.Equal(t, "revoked", rows[0].Status)
	assert.NotNil(t, rows[0].RevokedAt)
	assert.Equal(t, "key was rotated", rows[0].Notes)
}

func TestRevokeSecret_NotFound(t *testing.T) {
	db := newTestDB(t)

	err := db.RevokeSecret(9999, "no entry")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestListSecretLifecycle_FilterByStatus(t *testing.T) {
	db := newTestDB(t)

	fid1 := makeTestFinding(db, t)
	f2 := &FindingRecord{ConnectionName: "gl-prod", RunID: "run-2", Severity: "medium", Category: "secrets", Title: "GitLab token", Description: "d", Status: "open"}
	require.NoError(t, db.CreateFinding(f2))
	fid2 := f2.ID

	require.NoError(t, db.UpsertSecretLifecycle(fid1, "aws-key", "AKIA***"))
	require.NoError(t, db.UpsertSecretLifecycle(fid2, "gitlab-token", "glpat-***"))
	require.NoError(t, db.RevokeSecret(fid1, "rotated"))

	active, err := db.ListSecretLifecycle("active")
	require.NoError(t, err)
	assert.Len(t, active, 1)
	assert.Equal(t, "active", active[0].Status)

	revoked, err := db.ListSecretLifecycle("revoked")
	require.NoError(t, err)
	assert.Len(t, revoked, 1)
	assert.Equal(t, "revoked", revoked[0].Status)

	all, err := db.ListSecretLifecycle("")
	require.NoError(t, err)
	assert.Len(t, all, 2)
}

func TestListSecretLifecycle_Empty(t *testing.T) {
	db := newTestDB(t)

	rows, err := db.ListSecretLifecycle("")
	require.NoError(t, err)
	assert.Empty(t, rows)
}

func TestWrapErr(t *testing.T) {
	assert.Nil(t, wrapErr("ctx", nil))

	wrapped := wrapErr("my context", assert.AnError)
	require.Error(t, wrapped)
	assert.Contains(t, wrapped.Error(), "my context")
}
