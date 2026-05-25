package compliance

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGenerateReport_SOC2_Handler(t *testing.T) {
	router := setupTestRouter()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/compliance/report?framework=SOC2", nil)
	req.Header.Set("X-Tenant-ID", "tenant-1")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var report ComplianceReport
	err := json.Unmarshal(w.Body.Bytes(), &report)
	require.NoError(t, err)
	assert.Equal(t, SOC2, report.Framework)
	assert.Equal(t, "tenant-1", report.TenantID)
	assert.Greater(t, report.TotalControls, 0)
}

func TestGenerateReport_InvalidFramework_Handler(t *testing.T) {
	router := setupTestRouter()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/compliance/report?framework=BAD", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestGenerateReport_MissingFramework_Handler(t *testing.T) {
	router := setupTestRouter()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/compliance/report", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestGetDashboard_Handler(t *testing.T) {
	router := setupTestRouter()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/compliance/dashboard", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var stats ComplianceDashboardStats
	err := json.Unmarshal(w.Body.Bytes(), &stats)
	require.NoError(t, err)
	assert.Greater(t, stats.TotalControls, 0)
	assert.NotEmpty(t, stats.Frameworks)
}

func TestOverrideControlStatus_Handler(t *testing.T) {
	router := setupTestRouter()

	body := map[string]string{
		"status": string(NonCompliant),
		"reason": "manual audit finding",
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(
		http.MethodPost,
		"/compliance/controls/CC6.1/override",
		bytes.NewBuffer(jsonBody),
	)
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.Equal(t, "CC6.1", resp["control_id"])
	assert.Equal(t, string(NonCompliant), resp["new_status"])
	assert.Equal(t, "control status overridden", resp["message"])
}

func TestOverrideControlStatus_NotFound_Handler(t *testing.T) {
	router := setupTestRouter()

	body := map[string]string{"status": "COMPLIANT", "reason": "ok"}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(
		http.MethodPost,
		"/compliance/controls/NONEXISTENT/override",
		bytes.NewBuffer(jsonBody),
	)
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestOverrideControlStatus_InvalidStatus(t *testing.T) {
	router := setupTestRouter()

	body := map[string]string{"status": "BOGUS", "reason": "test"}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(
		http.MethodPost,
		"/compliance/controls/CC6.1/override",
		bytes.NewBuffer(jsonBody),
	)
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCollectEvidence_Handler(t *testing.T) {
	router := setupTestRouter()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/compliance/evidence/collect", nil)
	req.Header.Set("X-Tenant-ID", "tenant-2")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusAccepted, w.Code)

	var resp map[string]string
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.Equal(t, "accepted", resp["status"])
	assert.Contains(t, resp["message"], "tenant-2")
}
