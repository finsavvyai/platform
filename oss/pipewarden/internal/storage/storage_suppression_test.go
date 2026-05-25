package storage

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func createOpenFinding(t *testing.T, db *DB) int64 {
	t.Helper()
	f := &FindingRecord{
		ConnectionName: "gh-main",
		RunID:          "run-1",
		Severity:       "high",
		Category:       "secrets",
		Title:          "Exposed token",
		Description:    "Token found in logs",
		Status:         "open",
	}
	require.NoError(t, db.CreateFinding(f))
	return f.ID
}

func TestSuppressFinding_Success(t *testing.T) {
	db := newTestDB(t)
	id := createOpenFinding(t, db)

	require.NoError(t, db.SuppressFinding(id, "false-positive", "reviewed by security team"))

	findings, err := db.ListFindings("")
	require.NoError(t, err)
	require.Len(t, findings, 1)

	f := findings[0]
	assert.Equal(t, "suppressed", f.Status)
	assert.Equal(t, "false-positive", f.SuppressionReason)
	assert.Equal(t, "reviewed by security team", f.SuppressionNote)
}

func TestSuppressFinding_NotFound(t *testing.T) {
	db := newTestDB(t)

	err := db.SuppressFinding(9999, "false-positive", "note")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestReopenFinding_Success(t *testing.T) {
	db := newTestDB(t)
	id := createOpenFinding(t, db)

	// Suppress first
	require.NoError(t, db.SuppressFinding(id, "accepted-risk", "risk accepted"))

	// Then reopen
	require.NoError(t, db.ReopenFinding(id))

	findings, err := db.ListFindings("")
	require.NoError(t, err)
	require.Len(t, findings, 1)

	f := findings[0]
	assert.Equal(t, "open", f.Status)
	assert.Equal(t, "", f.SuppressionReason)
	assert.Equal(t, "", f.SuppressionNote)
}

func TestReopenFinding_NotFound(t *testing.T) {
	db := newTestDB(t)

	err := db.ReopenFinding(9999)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestSuppressionRoundTrip(t *testing.T) {
	db := newTestDB(t)
	id := createOpenFinding(t, db)

	// Suppress → reopen → suppress again
	require.NoError(t, db.SuppressFinding(id, "r1", "n1"))
	require.NoError(t, db.ReopenFinding(id))
	require.NoError(t, db.SuppressFinding(id, "r2", "n2"))

	findings, err := db.ListFindings("")
	require.NoError(t, err)
	require.Len(t, findings, 1)

	assert.Equal(t, "suppressed", findings[0].Status)
	assert.Equal(t, "r2", findings[0].SuppressionReason)
	assert.Equal(t, "n2", findings[0].SuppressionNote)
}

func TestFindDuplicate(t *testing.T) {
	db := newTestDB(t)

	f := &FindingRecord{
		ConnectionName: "gh-main",
		RunID:          "run-1",
		Severity:       "high",
		Category:       "secrets",
		Title:          "Duplicate Finding",
		Description:    "AWS key found",
		Status:         "open",
	}
	require.NoError(t, db.CreateFinding(f))

	// Same connection + title + category + severity — must find it
	id, err := db.FindDuplicate("gh-main", "Duplicate Finding", "secrets", "high")
	require.NoError(t, err)
	assert.Equal(t, f.ID, id)
}

func TestFindDuplicate_NotFound(t *testing.T) {
	db := newTestDB(t)

	id, err := db.FindDuplicate("gh-main", "Nonexistent Finding", "secrets", "high")
	require.NoError(t, err)
	assert.Equal(t, int64(0), id)
}

func TestFindDuplicate_WrongSeverityMissed(t *testing.T) {
	db := newTestDB(t)

	f := &FindingRecord{
		ConnectionName: "gh-main",
		RunID:          "r",
		Severity:       "high",
		Category:       "secrets",
		Title:          "Token",
		Description:    "d",
		Status:         "open",
	}
	require.NoError(t, db.CreateFinding(f))

	// Different severity — should NOT find it
	id, err := db.FindDuplicate("gh-main", "Token", "secrets", "critical")
	require.NoError(t, err)
	assert.Equal(t, int64(0), id)
}
