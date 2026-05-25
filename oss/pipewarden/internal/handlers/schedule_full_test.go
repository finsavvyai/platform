package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// GetSchedule
// ---------------------------------------------------------------------------

func TestGetSchedule_NotFound(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/connections/myconn/schedule", nil)
	w := httptest.NewRecorder()
	h.GetSchedule(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestGetSchedule_MissingName(t *testing.T) {
	h := newTestHandlers(t)

	// Path that strips to empty string.
	req := httptest.NewRequest(http.MethodGet, "/api/v1/connections/schedule", nil)
	req.URL.Path = "/api/v1/connections//schedule"
	w := httptest.NewRecorder()
	h.GetSchedule(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestGetSchedule_AfterSet(t *testing.T) {
	h := newTestHandlers(t)

	// Set a schedule first.
	body, _ := json.Marshal(ScheduleRequest{
		CronExpr: "0 */4 * * *",
		Enabled:  true,
		NotifyOn: "findings_only",
	})
	setReq := httptest.NewRequest(http.MethodPost, "/api/v1/connections/myconn/schedule", bytes.NewReader(body))
	setW := httptest.NewRecorder()
	h.SetSchedule(setW, setReq)
	require.Equal(t, http.StatusOK, setW.Code)

	// Now get it.
	getReq := httptest.NewRequest(http.MethodGet, "/api/v1/connections/myconn/schedule", nil)
	getW := httptest.NewRecorder()
	h.GetSchedule(getW, getReq)

	require.Equal(t, http.StatusOK, getW.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(getW.Body).Decode(&resp))
	assert.Equal(t, "0 */4 * * *", resp["cron_expr"])
}

// ---------------------------------------------------------------------------
// SetSchedule — additional edge cases
// ---------------------------------------------------------------------------

func TestSetSchedule_MissingConnectionName(t *testing.T) {
	h := newTestHandlers(t)

	body, _ := json.Marshal(ScheduleRequest{CronExpr: "* * * * *", Enabled: true})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/connections//schedule", bytes.NewReader(body))
	req.URL.Path = "/api/v1/connections//schedule"
	w := httptest.NewRecorder()
	h.SetSchedule(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestSetSchedule_InvalidNotifyOn(t *testing.T) {
	h := newTestHandlers(t)

	body, _ := json.Marshal(ScheduleRequest{
		CronExpr: "* * * * *",
		Enabled:  true,
		NotifyOn: "invalid_value",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/connections/myconn/schedule", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.SetSchedule(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestSetSchedule_InvalidJSON(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/connections/myconn/schedule", bytes.NewBufferString("{bad"))
	w := httptest.NewRecorder()
	h.SetSchedule(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestSetSchedule_DefaultNotifyOn(t *testing.T) {
	h := newTestHandlers(t)

	// notify_on left empty — should default to "all".
	body, _ := json.Marshal(ScheduleRequest{CronExpr: "0 0 * * *", Enabled: true})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/connections/myconn2/schedule", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.SetSchedule(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "all", resp["notify_on"])
}

// ---------------------------------------------------------------------------
// DeleteSchedule — edge cases
// ---------------------------------------------------------------------------

func TestDeleteSchedule_MissingName(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/connections//schedule", nil)
	req.URL.Path = "/api/v1/connections//schedule"
	w := httptest.NewRecorder()
	h.DeleteSchedule(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}
