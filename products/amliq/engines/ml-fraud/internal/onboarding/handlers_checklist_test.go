package onboarding

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetChecklist_ReturnsDefaultItems(t *testing.T) {

	r, _ := setupRouter()
	created := createSession(t, r)
	id := created["id"].(string)

	req := httptest.NewRequest(http.MethodGet,
		"/onboarding/"+id+"/checklist", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var cl IntegrationChecklist
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &cl))
	assert.Equal(t, id, cl.SessionID)
	assert.Len(t, cl.Items, 5)
	assert.Equal(t, float64(0), cl.CompletionPercent)

	// Verify first item fields.
	assert.Equal(t, "API Authentication", cl.Items[0].Name)
	assert.True(t, cl.Items[0].Required)
	assert.False(t, cl.Items[0].Completed)
}

func TestCompleteChecklistItem_MarksItemDone(t *testing.T) {

	r, _ := setupRouter()
	created := createSession(t, r)
	id := created["id"].(string)

	itemPath := "/onboarding/" + id + "/checklist/" +
		url.PathEscape("API Authentication")
	req := httptest.NewRequest(http.MethodPost, itemPath, nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var cl IntegrationChecklist
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &cl))

	// The first item should now be complete.
	assert.True(t, cl.Items[0].Completed)
	assert.NotNil(t, cl.Items[0].VerifiedAt)
	assert.Equal(t, float64(20), cl.CompletionPercent)
}

func TestCompleteChecklistItem_NotFound(t *testing.T) {

	r, _ := setupRouter()
	created := createSession(t, r)
	id := created["id"].(string)

	notFoundPath := "/onboarding/" + id + "/checklist/" +
		url.PathEscape("NonExistentItem")
	req := httptest.NewRequest(http.MethodPost, notFoundPath, nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestGetChecklist_SessionNotFound(t *testing.T) {

	r, _ := setupRouter()

	req := httptest.NewRequest(http.MethodGet,
		"/onboarding/nonexistent/checklist", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestGetAnalytics_ReturnsStats(t *testing.T) {
	r, _ := setupRouter()

	// Create a session so analytics has data.
	createSession(t, r)

	req := httptest.NewRequest(http.MethodGet,
		"/onboarding/analytics", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var analytics OnboardingAnalytics
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &analytics))
	assert.Equal(t, 1, analytics.TotalSessions)
	assert.Equal(t, 0, analytics.CompletedSessions)
}
