package handlers

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/finsavvyai/pipewarden/internal/analysis"
	"github.com/finsavvyai/pipewarden/internal/storage"
)

// ---------------------------------------------------------------------------
// persistAnalysisRecord
// ---------------------------------------------------------------------------

func TestPersistAnalysisRecord_HappyPath(t *testing.T) {
	h, db := newTestHandlersDB(t)

	rec := &storage.AnalysisRecord{
		ConnectionName: "gh-conn",
		RunID:          "run-001",
		Summary:        "All good",
		RiskScore:      15,
		FindingsCount:  0,
		Model:          "heuristic-v1",
		DurationMS:     123,
		AnalyzedAt:     time.Now().UTC(),
	}

	// persistAnalysisRecord is a best-effort, non-returning method.
	require.NotPanics(t, func() {
		h.persistAnalysisRecord(rec)
	})

	history, err := db.ListAnalysisHistory("gh-conn")
	require.NoError(t, err)
	found := false
	for _, h := range history {
		if h.RunID == "run-001" {
			found = true
			assert.Equal(t, 15, h.RiskScore)
		}
	}
	assert.True(t, found, "analysis record should be persisted in DB")
}

// ---------------------------------------------------------------------------
// notifyCriticalFindings
// ---------------------------------------------------------------------------

func TestNotifyCriticalFindings_IgnoresLowSeverity(t *testing.T) {
	h, db := newTestHandlersDB(t)

	findings := []analysis.Finding{
		{ConnectionName: "conn", Severity: analysis.SeverityLow, Title: "Low issue"},
		{ConnectionName: "conn", Severity: analysis.SeverityMedium, Title: "Medium issue"},
	}

	require.NotPanics(t, func() {
		h.notifyCriticalFindings("conn", findings)
	})

	// No critical/high notifications should have been created.
	notifs, err := db.ListNotifications(false, 100)
	require.NoError(t, err)
	assert.Empty(t, notifs)
}

func TestNotifyCriticalFindings_CreatesCriticalNotification(t *testing.T) {
	h, db := newTestHandlersDB(t)

	findings := []analysis.Finding{
		{ConnectionName: "conn", Severity: analysis.SeverityCritical, Title: "Critical token leak"},
	}

	require.NotPanics(t, func() {
		h.notifyCriticalFindings("conn", findings)
	})

	notifs, err := db.ListNotifications(false, 100)
	require.NoError(t, err)
	assert.NotEmpty(t, notifs)
}

func TestNotifyCriticalFindings_CreatesHighNotification(t *testing.T) {
	h, db := newTestHandlersDB(t)

	findings := []analysis.Finding{
		{ConnectionName: "conn", Severity: analysis.SeverityHigh, Title: "High severity issue"},
	}

	require.NotPanics(t, func() {
		h.notifyCriticalFindings("conn", findings)
	})

	notifs, err := db.ListNotifications(false, 100)
	require.NoError(t, err)
	assert.NotEmpty(t, notifs)
}

func TestNotifyCriticalFindings_Empty(t *testing.T) {
	h := newTestHandlers(t)
	require.NotPanics(t, func() {
		h.notifyCriticalFindings("conn", nil)
	})
}

// ---------------------------------------------------------------------------
// persistFindings
// ---------------------------------------------------------------------------

func TestPersistFindings_StoresFindings(t *testing.T) {
	h, db := newTestHandlersDB(t)

	findings := []analysis.Finding{
		{
			ConnectionName: "conn",
			RunID:          "run-001",
			Severity:       analysis.SeverityHigh,
			Category:       analysis.CategorySecrets,
			Title:          "Secret exposed",
			Description:    "Token in workflow",
			Remediation:    "Rotate token",
			Status:         "open",
			Confidence:     0.9,
		},
	}

	require.NotPanics(t, func() {
		h.persistFindings(findings)
	})

	stored, err := db.ListFindings("conn")
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(stored), 1)
}

func TestPersistFindings_Empty(t *testing.T) {
	h := newTestHandlers(t)
	require.NotPanics(t, func() {
		h.persistFindings(nil)
	})
}
