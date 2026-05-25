package scim

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBulk_CreateAndGetUser(t *testing.T) {
	_, _, mux := newHandler(t, staticTenant("t1"))

	body := map[string]any{
		"schemas": []string{BulkRequestSchema},
		"Operations": []map[string]any{
			{
				"bulkId": "qwerty",
				"method": "POST",
				"path":   "/Users",
				"data":   map[string]any{"userName": "bulk@x.com"},
			},
		},
	}
	raw, _ := json.Marshal(body)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, newReq(http.MethodPost, "/scim/v2/Bulk", string(raw)))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	var resp struct {
		Schemas    []string       `json:"schemas"`
		Operations []BulkResultOp `json:"Operations"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	require.Len(t, resp.Operations, 1)
	assert.Equal(t, "qwerty", resp.Operations[0].BulkID)
	assert.Equal(t, "201", resp.Operations[0].Status)
}

func TestBulk_RejectsMissingSchema(t *testing.T) {
	_, _, mux := newHandler(t, staticTenant("t1"))
	body := `{"Operations":[{"method":"POST","path":"/Users","data":{"userName":"u@x"}}]}`
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, newReq(http.MethodPost, "/scim/v2/Bulk", body))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestBulk_LimitEnforced(t *testing.T) {
	store := newMemStore()
	h := &Handler{Store: store, Tenant: staticTenant("t1"), BasePath: "/scim/v2", BulkLimit: 1}
	mux := http.NewServeMux()
	h.Register(mux)

	body := map[string]any{
		"schemas": []string{BulkRequestSchema},
		"Operations": []map[string]any{
			{"method": "POST", "path": "/Users", "data": map[string]any{"userName": "a@x"}},
			{"method": "POST", "path": "/Users", "data": map[string]any{"userName": "b@x"}},
		},
	}
	raw, _ := json.Marshal(body)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, newReq(http.MethodPost, "/scim/v2/Bulk", string(raw)))
	assert.Equal(t, http.StatusRequestEntityTooLarge, rec.Code)
}

func TestBulk_FailOnErrorsHonored(t *testing.T) {
	_, _, mux := newHandler(t, staticTenant("t1"))
	body := map[string]any{
		"schemas":      []string{BulkRequestSchema},
		"failOnErrors": 1,
		"Operations": []map[string]any{
			// First op fails (missing userName).
			{"method": "POST", "path": "/Users", "data": map[string]any{}},
			// Second op should be skipped.
			{"method": "POST", "path": "/Users", "data": map[string]any{"userName": "ok@x"}},
		},
	}
	raw, _ := json.Marshal(body)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, newReq(http.MethodPost, "/scim/v2/Bulk", string(raw)))
	require.Equal(t, http.StatusOK, rec.Code)

	require.True(t, strings.Contains(rec.Body.String(), `"Operations"`))
	var resp struct {
		Operations []BulkResultOp `json:"Operations"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	assert.Len(t, resp.Operations, 1, "failOnErrors=1 must abort after first failure")
	assert.Equal(t, "400", resp.Operations[0].Status)
}
