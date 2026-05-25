package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/logging"
	"github.com/finsavvyai/pipewarden/internal/storage"
)

func newNotifTestHandler(t *testing.T) *Handlers {
	t.Helper()
	db, err := storage.NewInMemory()
	if err != nil {
		t.Fatalf("failed to create db: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	logger, err := logging.New(&logging.Config{Level: "error"})
	if err != nil {
		t.Fatalf("failed to create logger: %v", err)
	}
	return New(db, integrations.NewManager(logger), nil, nil, logger, nil)
}

func TestCreateAndListNotifications(t *testing.T) {
	h := newNotifTestHandler(t)

	for i := 0; i < 3; i++ {
		if err := h.db.CreateNotification("finding_critical", fmt.Sprintf("Alert %d", i), "body", "conn1"); err != nil {
			t.Fatalf("CreateNotification failed: %v", err)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/notifications", nil)
	w := httptest.NewRecorder()
	h.ListNotifications(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode: %v", err)
	}

	notifications, ok := resp["notifications"].([]interface{})
	if !ok {
		t.Fatalf("notifications missing from response")
	}
	if len(notifications) != 3 {
		t.Errorf("expected 3 notifications, got %d", len(notifications))
	}
}

func TestMarkNotificationRead(t *testing.T) {
	h := newNotifTestHandler(t)

	if err := h.db.CreateNotification("scan_failed", "Scan failed", "body", "conn1"); err != nil {
		t.Fatalf("CreateNotification failed: %v", err)
	}

	// List to get the ID
	notifs, err := h.db.ListNotifications(false, 10)
	if err != nil || len(notifs) == 0 {
		t.Fatalf("expected notifications, got: %v", err)
	}
	id := notifs[0].ID

	countBefore, _ := h.db.UnreadCount()
	if countBefore != 1 {
		t.Fatalf("expected 1 unread before, got %d", countBefore)
	}

	req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/v1/notifications/%d/read", id), nil)
	w := httptest.NewRecorder()
	h.MarkNotificationRead(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	countAfter, _ := h.db.UnreadCount()
	if countAfter != 0 {
		t.Errorf("expected 0 unread after mark-read, got %d", countAfter)
	}
}

func TestMarkAllRead(t *testing.T) {
	h := newNotifTestHandler(t)

	for i := 0; i < 5; i++ {
		_ = h.db.CreateNotification("connection_offline", fmt.Sprintf("Conn %d offline", i), "body", "conn1")
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/notifications/read-all", nil)
	w := httptest.NewRecorder()
	h.MarkAllNotificationsRead(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	count, err := h.db.UnreadCount()
	if err != nil {
		t.Fatalf("UnreadCount failed: %v", err)
	}
	if count != 0 {
		t.Errorf("expected 0 unread after mark-all-read, got %d", count)
	}
}

func TestNotificationCount(t *testing.T) {
	h := newNotifTestHandler(t)

	_ = h.db.CreateNotification("finding_high", "High severity finding", "body", "conn1")
	_ = h.db.CreateNotification("finding_high", "Another high finding", "body", "conn2")

	req := httptest.NewRequest(http.MethodGet, "/api/v1/notifications/count", nil)
	w := httptest.NewRecorder()
	h.NotificationCount(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode: %v", err)
	}

	unread, ok := resp["unread"].(float64)
	if !ok {
		t.Fatalf("unread field missing or wrong type")
	}
	if unread != 2 {
		t.Errorf("expected unread=2, got %v", unread)
	}
}
