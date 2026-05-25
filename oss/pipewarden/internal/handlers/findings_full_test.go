package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

// seedFinding inserts a FindingRecord directly into the DB and returns its ID.
func seedFinding(t *testing.T, db *storage.DB, connName, severity string) int64 {
	t.Helper()
	rec := &storage.FindingRecord{
		ConnectionName: connName,
		RunID:          "run-001",
		Severity:       severity,
		Category:       "secrets",
		Title:          "Test finding",
		Description:    "Description",
		Remediation:    "Fix it",
		Status:         "open",
		Confidence:     0.9,
		CreatedAt:      time.Now().UTC(),
	}
	require.NoError(t, db.CreateFinding(rec))
	return rec.ID
}

// ---------------------------------------------------------------------------
// ListFindings
// ---------------------------------------------------------------------------

func TestListFindings_Empty(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/findings", nil)
	w := httptest.NewRecorder()
	h.ListFindings(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, float64(0), resp["count"])
}

func TestListFindings_WithData(t *testing.T) {
	h, db := newTestHandlersDB(t)
	seedFinding(t, db, "gh-conn", "high")
	seedFinding(t, db, "gh-conn", "critical")

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/findings", nil)
	w := httptest.NewRecorder()
	h.ListFindings(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	count, _ := resp["count"].(float64)
	assert.GreaterOrEqual(t, count, float64(2))
}

func TestListFindings_FilterByConnection(t *testing.T) {
	h, db := newTestHandlersDB(t)
	// Use highly unique connection names to avoid collisions with other tests.
	uniqueConn := "filter-conn-unique-abc123"
	seedFinding(t, db, uniqueConn, "high")

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/findings?connection="+uniqueConn, nil)
	w := httptest.NewRecorder()
	h.ListFindings(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	count, _ := resp["count"].(float64)
	assert.GreaterOrEqual(t, count, float64(1))
}

// ---------------------------------------------------------------------------
// UpdateFinding
// ---------------------------------------------------------------------------

func TestUpdateFinding_InvalidID(t *testing.T) {
	h := newTestHandlers(t)

	body, _ := json.Marshal(map[string]string{"status": "resolved"})
	req := httptest.NewRequest(http.MethodPatch, "/api/v1/analysis/findings/not-an-id", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.UpdateFinding(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestUpdateFinding_InvalidJSON(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodPatch, "/api/v1/analysis/findings/1", bytes.NewBufferString("{bad"))
	w := httptest.NewRecorder()
	h.UpdateFinding(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestUpdateFinding_InvalidStatus(t *testing.T) {
	h := newTestHandlers(t)

	body, _ := json.Marshal(map[string]string{"status": "banana"})
	req := httptest.NewRequest(http.MethodPatch, "/api/v1/analysis/findings/1", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.UpdateFinding(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestUpdateFinding_NotFound(t *testing.T) {
	h := newTestHandlers(t)

	body, _ := json.Marshal(map[string]string{"status": "resolved"})
	req := httptest.NewRequest(http.MethodPatch, "/api/v1/analysis/findings/9999", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.UpdateFinding(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestUpdateFinding_HappyPath(t *testing.T) {
	h, db := newTestHandlersDB(t)
	id := seedFinding(t, db, "conn-x", "high")

	body, _ := json.Marshal(map[string]string{"status": "acknowledged"})
	req := httptest.NewRequest(http.MethodPatch, "/api/v1/analysis/findings/1", bytes.NewReader(body))
	req.URL.Path = "/api/v1/analysis/findings/" + itoa(int(id))
	w := httptest.NewRecorder()
	h.UpdateFinding(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "acknowledged", resp["status"])
}

func TestUpdateFinding_AllValidStatuses(t *testing.T) {
	statuses := []string{"open", "acknowledged", "resolved", "false_positive"}
	for _, st := range statuses {
		t.Run(st, func(t *testing.T) {
			h, db := newTestHandlersDB(t)
			id := seedFinding(t, db, "conn-y", "medium")

			body, _ := json.Marshal(map[string]string{"status": st})
			req := httptest.NewRequest(http.MethodPatch, "/api/v1/analysis/findings/"+itoa(int(id)), bytes.NewReader(body))
			w := httptest.NewRecorder()
			h.UpdateFinding(w, req)

			assert.Equal(t, http.StatusOK, w.Code, "status %q should be accepted", st)
		})
	}
}

// ---------------------------------------------------------------------------
// DeleteFinding
// ---------------------------------------------------------------------------

func TestDeleteFinding_InvalidID(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/analysis/findings/xyz", nil)
	w := httptest.NewRecorder()
	h.DeleteFinding(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestDeleteFinding_NotFound(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/analysis/findings/9999", nil)
	w := httptest.NewRecorder()
	h.DeleteFinding(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestDeleteFinding_HappyPath(t *testing.T) {
	h, db := newTestHandlersDB(t)
	id := seedFinding(t, db, "conn-z", "low")

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/analysis/findings/"+itoa(int(id)), nil)
	w := httptest.NewRecorder()
	h.DeleteFinding(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]string
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "deleted", resp["status"])
}

// ---------------------------------------------------------------------------
// ExportFindings
// ---------------------------------------------------------------------------

func TestExportFindings_CSV_Empty(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/findings/export", nil)
	w := httptest.NewRecorder()
	h.ExportFindings(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Header().Get("Content-Type"), "text/csv")
	assert.Contains(t, w.Body.String(), "ID,Connection")
}

func TestExportFindings_JSON(t *testing.T) {
	h, db := newTestHandlersDB(t)
	seedFinding(t, db, "conn-export-json-xyz", "critical")

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/findings/export?format=json", nil)
	w := httptest.NewRecorder()
	h.ExportFindings(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Header().Get("Content-Type"), "application/json")
	assert.Contains(t, w.Header().Get("Content-Disposition"), "pipewarden-findings.json")

	var findings []interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&findings))
	assert.GreaterOrEqual(t, len(findings), 1)
}

func TestExportFindings_SARIF(t *testing.T) {
	h, db := newTestHandlersDB(t)
	seedFinding(t, db, "conn-sarif", "high")

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/findings/export?format=sarif", nil)
	w := httptest.NewRecorder()
	h.ExportFindings(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Header().Get("Content-Type"), "sarif")
}

func TestExportFindings_CSV_WithData(t *testing.T) {
	h, db := newTestHandlersDB(t)
	// Seed a finding with a comma in the title to exercise csvEscape.
	rec := &storage.FindingRecord{
		ConnectionName: "conn",
		RunID:          "r1",
		Severity:       "high",
		Category:       "secrets",
		Title:          "Title, with, commas",
		Description:    `Description "quoted"`,
		Status:         "open",
		Confidence:     0.8,
		CreatedAt:      time.Now().UTC(),
	}
	require.NoError(t, db.CreateFinding(rec))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/analysis/findings/export?format=csv", nil)
	w := httptest.NewRecorder()
	h.ExportFindings(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	body := w.Body.String()
	// The title has commas so it must be quoted in the CSV.
	assert.Contains(t, body, `"Title, with, commas"`)
}
