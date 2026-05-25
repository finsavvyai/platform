package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/logging"
	"github.com/finsavvyai/pipewarden/internal/storage"
)

func newScheduleTestHandler(t *testing.T) *Handlers {
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

func TestSetScheduleValid(t *testing.T) {
	h := newScheduleTestHandler(t)

	body, _ := json.Marshal(ScheduleRequest{
		CronExpr: "0 */6 * * *",
		Enabled:  true,
		NotifyOn: "all",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/connections/myconn/schedule", bytes.NewReader(body))
	w := httptest.NewRecorder()

	h.SetSchedule(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp["cron_expr"] != "0 */6 * * *" {
		t.Errorf("unexpected cron_expr: %v", resp["cron_expr"])
	}
}

func TestSetScheduleInvalidCron(t *testing.T) {
	h := newScheduleTestHandler(t)

	body, _ := json.Marshal(ScheduleRequest{
		CronExpr: "not a cron",
		Enabled:  true,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/connections/myconn/schedule", bytes.NewReader(body))
	w := httptest.NewRecorder()

	h.SetSchedule(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid cron, got %d: %s", w.Code, w.Body.String())
	}
}

func TestDeleteSchedule(t *testing.T) {
	h := newScheduleTestHandler(t)

	// First create a schedule
	body, _ := json.Marshal(ScheduleRequest{CronExpr: "0 0 * * *", Enabled: true, NotifyOn: "all"})
	setReq := httptest.NewRequest(http.MethodPost, "/api/v1/connections/myconn/schedule", bytes.NewReader(body))
	setW := httptest.NewRecorder()
	h.SetSchedule(setW, setReq)
	if setW.Code != http.StatusOK {
		t.Fatalf("setup failed: %d %s", setW.Code, setW.Body.String())
	}

	// Now delete it
	delReq := httptest.NewRequest(http.MethodDelete, "/api/v1/connections/myconn/schedule", nil)
	delW := httptest.NewRecorder()
	h.DeleteSchedule(delW, delReq)

	if delW.Code != http.StatusOK {
		t.Fatalf("expected 200 on delete, got %d: %s", delW.Code, delW.Body.String())
	}
}
