package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

// ---------------------------------------------------------------------------
// ListPipelineRuns
// ---------------------------------------------------------------------------

func TestListPipelineRuns_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/pipelines/runs", nil)
	w := httptest.NewRecorder()
	h.ListPipelineRuns(w, req)

	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestListPipelineRuns_MissingParams(t *testing.T) {
	h := newTestHandlers(t)

	tests := []struct {
		name  string
		query string
	}{
		{"missing all", ""},
		{"missing owner and repo", "?connection=myconn"},
		{"missing connection and repo", "?owner=org"},
		{"missing connection and owner", "?repo=myrepo"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/pipelines/runs"+tc.query, nil)
			w := httptest.NewRecorder()
			h.ListPipelineRuns(w, req)
			assert.Equal(t, http.StatusBadRequest, w.Code)
		})
	}
}

func TestListPipelineRuns_ConnectionNotFound(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/pipelines/runs?connection=nope&owner=o&repo=r", nil)
	w := httptest.NewRecorder()
	h.ListPipelineRuns(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

// ---------------------------------------------------------------------------
// ListPipelines
// ---------------------------------------------------------------------------

func TestListPipelines_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/pipelines", nil)
	w := httptest.NewRecorder()
	h.ListPipelines(w, req)

	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestListPipelines_MissingParams(t *testing.T) {
	h := newTestHandlers(t)

	tests := []struct {
		name  string
		query string
	}{
		{"missing all", ""},
		{"missing owner and repo", "?connection=myconn"},
		{"missing connection", "?owner=o&repo=r"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/pipelines"+tc.query, nil)
			w := httptest.NewRecorder()
			h.ListPipelines(w, req)
			assert.Equal(t, http.StatusBadRequest, w.Code)
		})
	}
}

func TestListPipelines_ConnectionNotFound(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/pipelines?connection=nope&owner=o&repo=r", nil)
	w := httptest.NewRecorder()
	h.ListPipelines(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}
