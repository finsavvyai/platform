package storage

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLastAnalysisTime_Empty(t *testing.T) {
	db := newTestDB(t)

	ts, err := db.LastAnalysisTime()
	require.NoError(t, err)
	assert.Nil(t, ts)
}

func TestLastAnalysisTime_WithRecords(t *testing.T) {
	db := newTestDB(t)

	before := time.Now().UTC().Add(-time.Second)

	require.NoError(t, db.CreateAnalysisRecord(&AnalysisRecord{
		ConnectionName: "gh-main",
		RunID:          "r1",
		Summary:        "scan",
		RiskScore:      10,
	}))

	ts, err := db.LastAnalysisTime()
	require.NoError(t, err)
	require.NotNil(t, ts)
	assert.True(t, ts.After(before))
}

func TestLastAnalysisTime_ReturnsLatest(t *testing.T) {
	db := newTestDB(t)

	earlier := time.Now().UTC().Add(-2 * time.Hour)
	later := time.Now().UTC().Add(-1 * time.Hour)

	require.NoError(t, db.CreateAnalysisRecord(&AnalysisRecord{
		ConnectionName: "conn",
		RunID:          "r1",
		AnalyzedAt:     earlier,
	}))
	require.NoError(t, db.CreateAnalysisRecord(&AnalysisRecord{
		ConnectionName: "conn",
		RunID:          "r2",
		AnalyzedAt:     later,
	}))

	ts, err := db.LastAnalysisTime()
	require.NoError(t, err)
	require.NotNil(t, ts)
	// Should be the later timestamp
	assert.True(t, ts.After(earlier))
}

func TestLastAnalysisTimeForConnection_Empty(t *testing.T) {
	db := newTestDB(t)

	ts, err := db.LastAnalysisTimeForConnection("gh-main")
	require.NoError(t, err)
	assert.Nil(t, ts)
}

func TestLastAnalysisTimeForConnection_WithRecords(t *testing.T) {
	db := newTestDB(t)

	before := time.Now().UTC().Add(-time.Second)
	require.NoError(t, db.CreateAnalysisRecord(&AnalysisRecord{
		ConnectionName: "gh-main",
		RunID:          "r1",
		Summary:        "scan",
		RiskScore:      50,
	}))

	ts, err := db.LastAnalysisTimeForConnection("gh-main")
	require.NoError(t, err)
	require.NotNil(t, ts)
	assert.True(t, ts.After(before))
}

func TestLastAnalysisTimeForConnection_IsolatedByConnection(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.CreateAnalysisRecord(&AnalysisRecord{
		ConnectionName: "gh-main",
		RunID:          "r1",
		Summary:        "scan",
	}))

	// gl-prod has no analysis
	ts, err := db.LastAnalysisTimeForConnection("gl-prod")
	require.NoError(t, err)
	assert.Nil(t, ts)
}

func TestLastAnalysisTimeForConnection_ReturnsLatestForThatConnection(t *testing.T) {
	db := newTestDB(t)

	earlier := time.Now().UTC().Add(-2 * time.Hour)
	later := time.Now().UTC().Add(-1 * time.Hour)

	require.NoError(t, db.CreateAnalysisRecord(&AnalysisRecord{
		ConnectionName: "gh-main", RunID: "r1", AnalyzedAt: earlier,
	}))
	require.NoError(t, db.CreateAnalysisRecord(&AnalysisRecord{
		ConnectionName: "gh-main", RunID: "r2", AnalyzedAt: later,
	}))
	require.NoError(t, db.CreateAnalysisRecord(&AnalysisRecord{
		ConnectionName: "gl-prod", RunID: "r3", AnalyzedAt: time.Now().UTC(),
	}))

	ts, err := db.LastAnalysisTimeForConnection("gh-main")
	require.NoError(t, err)
	require.NotNil(t, ts)
	assert.True(t, ts.After(earlier))
}
