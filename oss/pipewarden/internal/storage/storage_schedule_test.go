package storage

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSetAndGetSchedule(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.SetSchedule("gh-main", "0 * * * *", true, "all"))

	row, err := db.GetSchedule("gh-main")
	require.NoError(t, err)
	assert.Equal(t, "gh-main", row.ConnectionName)
	assert.Equal(t, "0 * * * *", row.CronExpr)
	assert.True(t, row.Enabled)
	assert.Equal(t, "all", row.NotifyOn)
	assert.NotNil(t, row.NextRunAt) // nextRunFromNow() always sets this
}

func TestGetSchedule_NotFound(t *testing.T) {
	db := newTestDB(t)

	_, err := db.GetSchedule("nonexistent")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestSetSchedule_Upsert(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.SetSchedule("gh-main", "0 * * * *", true, "all"))
	require.NoError(t, db.SetSchedule("gh-main", "30 * * * *", false, "critical"))

	row, err := db.GetSchedule("gh-main")
	require.NoError(t, err)
	assert.Equal(t, "30 * * * *", row.CronExpr)
	assert.False(t, row.Enabled)
	assert.Equal(t, "critical", row.NotifyOn)
}

func TestDeleteSchedule(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.SetSchedule("gh-main", "0 * * * *", true, "all"))
	require.NoError(t, db.DeleteSchedule("gh-main"))

	_, err := db.GetSchedule("gh-main")
	require.Error(t, err)
}

func TestDeleteSchedule_Nonexistent(t *testing.T) {
	db := newTestDB(t)

	// DeleteSchedule does not error on missing row (no rows-affected check)
	require.NoError(t, db.DeleteSchedule("no-such-conn"))
}

func TestListDueSchedules_None(t *testing.T) {
	db := newTestDB(t)

	// Set schedule that runs one hour from now — not due yet
	require.NoError(t, db.SetSchedule("gh-main", "0 * * * *", true, "all"))

	due, err := db.ListDueSchedules()
	require.NoError(t, err)
	assert.Empty(t, due)
}

func TestListDueSchedules_WithDue(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.SetSchedule("conn-due", "0 * * * *", true, "all"))

	// Force next_run_at into the past so the schedule is due
	pastTime := time.Now().UTC().Add(-2 * time.Hour)
	_, err := db.db.Exec(
		`UPDATE scan_schedules SET next_run_at = ? WHERE connection_name = ?`,
		pastTime, "conn-due",
	)
	require.NoError(t, err)

	due, err := db.ListDueSchedules()
	require.NoError(t, err)
	require.Len(t, due, 1)
	assert.Equal(t, "conn-due", due[0].ConnectionName)
}

func TestListDueSchedules_DisabledNotReturned(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.SetSchedule("conn-dis", "0 * * * *", false, "all"))

	// Force next_run_at into the past
	pastTime := time.Now().UTC().Add(-2 * time.Hour)
	_, err := db.db.Exec(
		`UPDATE scan_schedules SET next_run_at = ? WHERE connection_name = ?`,
		pastTime, "conn-dis",
	)
	require.NoError(t, err)

	due, err := db.ListDueSchedules()
	require.NoError(t, err)
	assert.Empty(t, due) // disabled should not appear
}

func TestNextRunFromNow(t *testing.T) {
	before := time.Now().UTC()
	next := nextRunFromNow()
	after := time.Now().UTC()

	// nextRunFromNow should be approximately 1 hour in the future
	assert.True(t, next.After(before.Add(59*time.Minute)))
	assert.True(t, next.Before(after.Add(61*time.Minute)))
}
