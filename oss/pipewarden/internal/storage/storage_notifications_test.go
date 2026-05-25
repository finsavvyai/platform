package storage

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCreateNotification_Basic(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.CreateNotification("alert", "High severity finding", "Found AWS key", "gh-main"))

	notifications, err := db.ListNotifications(false, 10)
	require.NoError(t, err)
	require.Len(t, notifications, 1)

	n := notifications[0]
	assert.Equal(t, "alert", n.Type)
	assert.Equal(t, "High severity finding", n.Title)
	assert.Equal(t, "Found AWS key", n.Body)
	assert.Equal(t, "gh-main", n.ConnectionName)
	assert.False(t, n.Read)
}

func TestListNotifications_UnreadOnly(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.CreateNotification("alert", "A", "body", "conn"))
	require.NoError(t, db.CreateNotification("info", "B", "body", "conn"))
	require.NoError(t, db.CreateNotification("warn", "C", "body", "conn"))

	all, err := db.ListNotifications(false, 20)
	require.NoError(t, err)
	assert.Len(t, all, 3)

	// Mark one read
	require.NoError(t, db.MarkRead(all[0].ID))

	unread, err := db.ListNotifications(true, 20)
	require.NoError(t, err)
	assert.Len(t, unread, 2)
}

func TestListNotifications_LimitCap(t *testing.T) {
	db := newTestDB(t)

	for i := 0; i < 5; i++ {
		require.NoError(t, db.CreateNotification("t", "title", "body", ""))
	}

	// 0 defaults to 20
	results, err := db.ListNotifications(false, 0)
	require.NoError(t, err)
	assert.Len(t, results, 5)

	// > 200 caps at 200 (only 5 exist)
	results, err = db.ListNotifications(false, 999)
	require.NoError(t, err)
	assert.Len(t, results, 5)
}

func TestMarkRead_Single(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.CreateNotification("alert", "title", "body", "conn"))
	notifications, err := db.ListNotifications(false, 10)
	require.NoError(t, err)
	require.Len(t, notifications, 1)

	id := notifications[0].ID
	require.NoError(t, db.MarkRead(id))

	updated, err := db.ListNotifications(false, 10)
	require.NoError(t, err)
	require.Len(t, updated, 1)
	assert.True(t, updated[0].Read)
}

func TestMarkRead_NotFound(t *testing.T) {
	db := newTestDB(t)

	err := db.MarkRead(999)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestMarkAllRead(t *testing.T) {
	db := newTestDB(t)

	require.NoError(t, db.CreateNotification("a", "t1", "b", ""))
	require.NoError(t, db.CreateNotification("a", "t2", "b", ""))
	require.NoError(t, db.CreateNotification("a", "t3", "b", ""))

	require.NoError(t, db.MarkAllRead())

	unread, err := db.ListNotifications(true, 20)
	require.NoError(t, err)
	assert.Empty(t, unread)
}

func TestUnreadCount(t *testing.T) {
	db := newTestDB(t)

	count, err := db.UnreadCount()
	require.NoError(t, err)
	assert.Equal(t, 0, count)

	require.NoError(t, db.CreateNotification("a", "t1", "b", ""))
	require.NoError(t, db.CreateNotification("a", "t2", "b", ""))

	count, err = db.UnreadCount()
	require.NoError(t, err)
	assert.Equal(t, 2, count)

	notifications, _ := db.ListNotifications(false, 10)
	require.NoError(t, db.MarkRead(notifications[0].ID))

	count, err = db.UnreadCount()
	require.NoError(t, err)
	assert.Equal(t, 1, count)
}

func TestMarkAllRead_OnEmpty(t *testing.T) {
	db := newTestDB(t)

	// Should not error on empty table
	require.NoError(t, db.MarkAllRead())

	count, err := db.UnreadCount()
	require.NoError(t, err)
	assert.Equal(t, 0, count)
}
