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
// CreateFixPRBatch — validation path tests
// ---------------------------------------------------------------------------

func TestCreateFixPRBatch_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/findings/fix/pr/batch", nil)
	w := httptest.NewRecorder()
	h.CreateFixPRBatch(w, req)

	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestCreateFixPRBatch_InvalidJSON(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/findings/fix/pr/batch", bytes.NewBufferString("{bad"))
	w := httptest.NewRecorder()
	h.CreateFixPRBatch(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateFixPRBatch_EmptyFindingIDs(t *testing.T) {
	h := newTestHandlers(t)

	body, _ := json.Marshal(BatchFixPRRequest{
		Owner:       "org",
		Repo:        "repo",
		GitHubToken: "ghp_test",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/findings/fix/pr/batch", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateFixPRBatch(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateFixPRBatch_TooManyFindingIDs(t *testing.T) {
	h := newTestHandlers(t)

	ids := make([]int64, batchMaxFindings+1)
	for i := range ids {
		ids[i] = int64(i + 1)
	}

	body, _ := json.Marshal(BatchFixPRRequest{
		FindingIDs:  ids,
		Owner:       "org",
		Repo:        "repo",
		GitHubToken: "ghp_test",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/findings/fix/pr/batch", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateFixPRBatch(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateFixPRBatch_MissingToken(t *testing.T) {
	h := newTestHandlers(t)

	body, _ := json.Marshal(BatchFixPRRequest{
		FindingIDs: []int64{1},
		Owner:      "org",
		Repo:       "repo",
		// no GitHubToken
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/findings/fix/pr/batch", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateFixPRBatch(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateFixPRBatch_MissingOwnerOrRepo(t *testing.T) {
	h := newTestHandlers(t)

	body, _ := json.Marshal(BatchFixPRRequest{
		FindingIDs:  []int64{1},
		GitHubToken: "ghp_test",
		// no Owner, no Repo
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/findings/fix/pr/batch", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateFixPRBatch(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateFixPRBatch_ValidRequest_FindingsNotFound(t *testing.T) {
	// Valid request but finding IDs don't exist in DB → skipped in result.
	h := newTestHandlers(t)

	body, _ := json.Marshal(BatchFixPRRequest{
		FindingIDs:  []int64{9999},
		Owner:       "org",
		Repo:        "repo",
		GitHubToken: "ghp_test",
		BaseBranch:  "main",
		MaxParallel: 1,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/findings/fix/pr/batch", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateFixPRBatch(w, req)

	// Should respond 200 with results showing skipped finding.
	require.Equal(t, http.StatusOK, w.Code)
	var resp BatchFixPRResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, 1, resp.Requested)
	assert.Equal(t, 1, resp.Skipped)
}

// ---------------------------------------------------------------------------
// lookupFinding
// ---------------------------------------------------------------------------

func TestLookupFinding_Found(t *testing.T) {
	h, db := newTestHandlersDB(t)
	id := seedFinding(t, db, "conn", "high")

	result := lookupFinding(h, id)
	require.NotNil(t, result)
	assert.Equal(t, id, result.ID)
}

func TestLookupFinding_NotFound(t *testing.T) {
	h := newTestHandlers(t)
	result := lookupFinding(h, 99999)
	assert.Nil(t, result)
}

// ---------------------------------------------------------------------------
// validateBatchRequest
// ---------------------------------------------------------------------------

func TestValidateBatchRequest_DefaultsBaseBranch(t *testing.T) {
	req := &BatchFixPRRequest{
		FindingIDs:  []int64{1},
		Owner:       "org",
		Repo:        "repo",
		GitHubToken: "tok",
	}
	err := validateBatchRequest(req)
	require.NoError(t, err)
	assert.Equal(t, "main", req.BaseBranch)
}
