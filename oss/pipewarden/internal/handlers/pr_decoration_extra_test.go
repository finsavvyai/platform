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

func TestPostPRComment_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/webhooks/github/pr-comment", nil)
	w := httptest.NewRecorder()
	h.PostPRComment(w, req)

	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestPostPRComment_InvalidJSON(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/github/pr-comment", bytes.NewBufferString("{bad"))
	w := httptest.NewRecorder()
	h.PostPRComment(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestPostPRComment_NoToken_ReturnsCommentBody(t *testing.T) {
	// Without a GitHubToken, the handler still returns 200 with the body.
	h := newTestHandlers(t)

	body, _ := json.Marshal(prCommentRequest{
		Owner:    "org",
		Repo:     "repo",
		PRNumber: 42,
		// No GitHubToken — skip posting to GitHub, return body directly.
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/github/pr-comment", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.PostPRComment(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Contains(t, resp, "comment_body")
}

func TestLoadFindingsForConnection_EmptyDB(t *testing.T) {
	h := newTestHandlers(t)
	findings, risk, err := h.loadFindingsForConnection("")
	require.NoError(t, err)
	assert.Empty(t, findings)
	assert.Equal(t, 0, risk)
}
