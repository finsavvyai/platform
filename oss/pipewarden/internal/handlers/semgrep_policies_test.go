package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

// ---------------------------------------------------------------------------
// SemgrepRulesHandler — dispatch
// ---------------------------------------------------------------------------

func TestSemgrepRulesHandler_ListDispatch(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/semgrep/rules", nil)
	w := httptest.NewRecorder()
	h.SemgrepRulesHandler(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestSemgrepRulesHandler_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodPut, "/api/v1/semgrep/rules", nil)
	w := httptest.NewRecorder()
	h.SemgrepRulesHandler(w, req)
	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestSemgrepRulesHandler_DeleteDispatch(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/semgrep/rules/no-such-rule", nil)
	req.URL.Path = "/api/v1/semgrep/rules/no-such-rule"
	w := httptest.NewRecorder()
	h.SemgrepRulesHandler(w, req)
	// rule not found → 404
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestSemgrepRulesHandler_TestDispatch(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/semgrep/rules/no-rule/test", nil)
	req.URL.Path = "/api/v1/semgrep/rules/no-rule/test"
	w := httptest.NewRecorder()
	h.SemgrepRulesHandler(w, req)
	// rule not found → 404
	assert.Equal(t, http.StatusNotFound, w.Code)
}

// ---------------------------------------------------------------------------
// ListSemgrepRules
// ---------------------------------------------------------------------------

func TestListSemgrepRules_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/semgrep/rules", nil)
	w := httptest.NewRecorder()
	h.ListSemgrepRules(w, req)
	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestListSemgrepRules_Empty(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/semgrep/rules", nil)
	w := httptest.NewRecorder()
	h.ListSemgrepRules(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var resp []interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Empty(t, resp)
}

// ---------------------------------------------------------------------------
// CreateSemgrepRule
// ---------------------------------------------------------------------------

func TestCreateSemgrepRule_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/semgrep/rules", nil)
	w := httptest.NewRecorder()
	h.CreateSemgrepRule(w, req)
	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestCreateSemgrepRule_InvalidJSON(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/semgrep/rules", bytes.NewBufferString("{bad"))
	w := httptest.NewRecorder()
	h.CreateSemgrepRule(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateSemgrepRule_InvalidID(t *testing.T) {
	h := newTestHandlers(t)
	body, _ := json.Marshal(storage.SemgrepRuleRow{
		ID: "INVALID ID!", Pattern: `aws_key`, Message: "AWS key",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/semgrep/rules", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateSemgrepRule(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateSemgrepRule_MissingPattern(t *testing.T) {
	h := newTestHandlers(t)
	body, _ := json.Marshal(storage.SemgrepRuleRow{
		ID: "detect-secret", Message: "Secret found",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/semgrep/rules", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateSemgrepRule(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateSemgrepRule_MissingMessage(t *testing.T) {
	h := newTestHandlers(t)
	body, _ := json.Marshal(storage.SemgrepRuleRow{
		ID: "detect-secret", Pattern: `aws_key`,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/semgrep/rules", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateSemgrepRule(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateSemgrepRule_InvalidSeverity(t *testing.T) {
	h := newTestHandlers(t)
	body, _ := json.Marshal(storage.SemgrepRuleRow{
		ID: "detect-secret", Pattern: `aws_key`, Message: "AWS key", Severity: "CRITICAL",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/semgrep/rules", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateSemgrepRule(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateSemgrepRule_HappyPath(t *testing.T) {
	h := newTestHandlers(t)
	body, _ := json.Marshal(storage.SemgrepRuleRow{
		ID: "detect-aws-key", Pattern: `AKIA[0-9A-Z]{16}`, Message: "AWS key detected",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/semgrep/rules", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateSemgrepRule(w, req)
	require.Equal(t, http.StatusCreated, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "detect-aws-key", resp["id"])
	assert.Equal(t, "WARNING", resp["severity"]) // defaults to WARNING
}

// ---------------------------------------------------------------------------
// DeleteSemgrepRule
// ---------------------------------------------------------------------------

func TestDeleteSemgrepRule_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/semgrep/rules/some-rule", nil)
	req.URL.Path = "/api/v1/semgrep/rules/some-rule"
	w := httptest.NewRecorder()
	h.DeleteSemgrepRule(w, req)
	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestDeleteSemgrepRule_NotFound(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/semgrep/rules/no-such", nil)
	req.URL.Path = "/api/v1/semgrep/rules/no-such"
	w := httptest.NewRecorder()
	h.DeleteSemgrepRule(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestDeleteSemgrepRule_HappyPath(t *testing.T) {
	h := newTestHandlers(t)

	// Create first.
	body, _ := json.Marshal(storage.SemgrepRuleRow{
		ID: "delete-me", Pattern: `secret`, Message: "Secret",
	})
	createReq := httptest.NewRequest(http.MethodPost, "/api/v1/semgrep/rules", bytes.NewReader(body))
	createW := httptest.NewRecorder()
	h.CreateSemgrepRule(createW, createReq)
	require.Equal(t, http.StatusCreated, createW.Code)

	// Delete it.
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/semgrep/rules/delete-me", nil)
	req.URL.Path = "/api/v1/semgrep/rules/delete-me"
	w := httptest.NewRecorder()
	h.DeleteSemgrepRule(w, req)
	assert.Equal(t, http.StatusNoContent, w.Code)
}

// ---------------------------------------------------------------------------
// TestSemgrepRule
// ---------------------------------------------------------------------------

func TestTestSemgrepRule_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/semgrep/rules/some/test", nil)
	req.URL.Path = "/api/v1/semgrep/rules/some/test"
	w := httptest.NewRecorder()
	h.TestSemgrepRule(w, req)
	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestTestSemgrepRule_NotFound(t *testing.T) {
	h := newTestHandlers(t)
	body, _ := json.Marshal(map[string]string{"content": "some yaml content"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/semgrep/rules/no-rule/test", bytes.NewReader(body))
	req.URL.Path = "/api/v1/semgrep/rules/no-rule/test"
	w := httptest.NewRecorder()
	h.TestSemgrepRule(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestTestSemgrepRule_Matched(t *testing.T) {
	h := newTestHandlers(t)

	// Seed a rule.
	createBody, _ := json.Marshal(storage.SemgrepRuleRow{
		ID: "aws-key-rule", Pattern: `AKIA[0-9A-Z]{16}`, Message: "AWS key",
	})
	createReq := httptest.NewRequest(http.MethodPost, "/api/v1/semgrep/rules", bytes.NewReader(createBody))
	createW := httptest.NewRecorder()
	h.CreateSemgrepRule(createW, createReq)
	require.Equal(t, http.StatusCreated, createW.Code)

	// Test it against content containing a fake key.
	testBody, _ := json.Marshal(map[string]string{"content": "AKIAIOSFODNN7EXAMPLE"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/semgrep/rules/aws-key-rule/test", bytes.NewReader(testBody))
	req.URL.Path = "/api/v1/semgrep/rules/aws-key-rule/test"
	w := httptest.NewRecorder()
	h.TestSemgrepRule(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, true, resp["matched"])
}

func TestTestSemgrepRule_NotMatched(t *testing.T) {
	h := newTestHandlers(t)

	createBody, _ := json.Marshal(storage.SemgrepRuleRow{
		ID: "aws-key-rule2", Pattern: `AKIA[0-9A-Z]{16}`, Message: "AWS key",
	})
	createReq := httptest.NewRequest(http.MethodPost, "/api/v1/semgrep/rules", bytes.NewReader(createBody))
	createW := httptest.NewRecorder()
	h.CreateSemgrepRule(createW, createReq)
	require.Equal(t, http.StatusCreated, createW.Code)

	testBody, _ := json.Marshal(map[string]string{"content": "no keys here"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/semgrep/rules/aws-key-rule2/test", bytes.NewReader(testBody))
	req.URL.Path = "/api/v1/semgrep/rules/aws-key-rule2/test"
	w := httptest.NewRecorder()
	h.TestSemgrepRule(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, false, resp["matched"])
}

// ---------------------------------------------------------------------------
// validateSemgrepRule
// ---------------------------------------------------------------------------

func TestValidateSemgrepRule_AllValid(t *testing.T) {
	err := validateSemgrepRule(storage.SemgrepRuleRow{
		ID: "good-rule", Pattern: `secret`, Message: "Secret found", Severity: "ERROR",
	})
	assert.NoError(t, err)
}

func TestValidateSemgrepRule_EmptySeverityAllowed(t *testing.T) {
	err := validateSemgrepRule(storage.SemgrepRuleRow{
		ID: "good-rule", Pattern: `secret`, Message: "Secret found",
	})
	assert.NoError(t, err)
}

// ---------------------------------------------------------------------------
// Policies — ListPolicies
// ---------------------------------------------------------------------------

func TestListPolicies_Empty(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/policies", nil)
	w := httptest.NewRecorder()
	h.ListPolicies(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, float64(0), resp["count"])
}

// ---------------------------------------------------------------------------
// CreatePolicy
// ---------------------------------------------------------------------------

func TestCreatePolicy_InvalidJSON(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/policies", bytes.NewBufferString("{bad"))
	w := httptest.NewRecorder()
	h.CreatePolicy(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreatePolicy_MissingID(t *testing.T) {
	h := newTestHandlers(t)
	body, _ := json.Marshal(storage.PolicyRow{Name: "My Policy", Pattern: `.*`, Message: "Test"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/policies", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreatePolicy(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreatePolicy_InvalidIDSlug(t *testing.T) {
	h := newTestHandlers(t)
	body, _ := json.Marshal(storage.PolicyRow{ID: "INVALID ID", Name: "My Policy", Pattern: `.*`, Message: "Test"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/policies", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreatePolicy(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreatePolicy_InvalidSeverity(t *testing.T) {
	h := newTestHandlers(t)
	body, _ := json.Marshal(storage.PolicyRow{
		ID: "my-policy", Name: "My Policy", Pattern: `.*`, Message: "Test", Severity: "extreme",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/policies", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreatePolicy(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreatePolicy_InvalidRegex(t *testing.T) {
	h := newTestHandlers(t)
	body, _ := json.Marshal(storage.PolicyRow{
		ID: "my-policy", Name: "My Policy", Pattern: `[invalid`, Message: "Test",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/policies", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreatePolicy(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreatePolicy_HappyPath(t *testing.T) {
	h := newTestHandlers(t)
	body, _ := json.Marshal(storage.PolicyRow{
		ID: "require-pinned-actions", Name: "Require pinned actions",
		Pattern: `uses:.*@[0-9a-f]{40}`, Message: "Pin action", Severity: "high",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/policies", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreatePolicy(w, req)
	require.Equal(t, http.StatusCreated, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "require-pinned-actions", resp["id"])
}

// ---------------------------------------------------------------------------
// UpdatePolicy
// ---------------------------------------------------------------------------

func TestUpdatePolicy_MissingID(t *testing.T) {
	h := newTestHandlers(t)
	body, _ := json.Marshal(storage.PolicyRow{
		ID: "some-id", Name: "Policy", Pattern: `.*`, Message: "msg",
	})
	req := httptest.NewRequest(http.MethodPut, "/api/v1/policies/", bytes.NewReader(body))
	req.URL.Path = "/api/v1/policies/"
	w := httptest.NewRecorder()
	h.UpdatePolicy(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestUpdatePolicy_NotFound(t *testing.T) {
	h := newTestHandlers(t)
	body, _ := json.Marshal(storage.PolicyRow{
		ID: "no-such-id", Name: "Policy", Pattern: `.*`, Message: "msg",
	})
	req := httptest.NewRequest(http.MethodPut, "/api/v1/policies/no-such-id", bytes.NewReader(body))
	req.URL.Path = "/api/v1/policies/no-such-id"
	w := httptest.NewRecorder()
	h.UpdatePolicy(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestUpdatePolicy_HappyPath(t *testing.T) {
	h := newTestHandlers(t)

	// Create first.
	createBody, _ := json.Marshal(storage.PolicyRow{
		ID: "update-me", Name: "Original", Pattern: `.*`, Message: "orig msg",
	})
	createReq := httptest.NewRequest(http.MethodPost, "/api/v1/policies", bytes.NewReader(createBody))
	createW := httptest.NewRecorder()
	h.CreatePolicy(createW, createReq)
	require.Equal(t, http.StatusCreated, createW.Code)

	// Update it.
	updateBody, _ := json.Marshal(storage.PolicyRow{
		ID: "update-me", Name: "Updated Policy", Pattern: `.*`, Message: "new message",
	})
	req := httptest.NewRequest(http.MethodPut, "/api/v1/policies/update-me", bytes.NewReader(updateBody))
	req.URL.Path = "/api/v1/policies/update-me"
	w := httptest.NewRecorder()
	h.UpdatePolicy(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "Updated Policy", resp["name"])
}

// ---------------------------------------------------------------------------
// DeletePolicy
// ---------------------------------------------------------------------------

func TestDeletePolicy_MissingID(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/policies/", nil)
	req.URL.Path = "/api/v1/policies/"
	w := httptest.NewRecorder()
	h.DeletePolicy(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestDeletePolicy_NotFound(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/policies/no-such", nil)
	req.URL.Path = "/api/v1/policies/no-such"
	w := httptest.NewRecorder()
	h.DeletePolicy(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestDeletePolicy_HappyPath(t *testing.T) {
	h := newTestHandlers(t)

	// Create a policy to delete.
	createBody, _ := json.Marshal(storage.PolicyRow{
		ID: "disposable-policy", Name: "Temp", Pattern: `.*`, Message: "msg",
	})
	createReq := httptest.NewRequest(http.MethodPost, "/api/v1/policies", bytes.NewReader(createBody))
	createW := httptest.NewRecorder()
	h.CreatePolicy(createW, createReq)
	require.Equal(t, http.StatusCreated, createW.Code)

	// Delete it.
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/policies/disposable-policy", nil)
	req.URL.Path = "/api/v1/policies/disposable-policy"
	w := httptest.NewRecorder()
	h.DeletePolicy(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "deleted", resp["status"])
}

// ---------------------------------------------------------------------------
// TestPolicy
// ---------------------------------------------------------------------------

func TestTestPolicy_MissingID(t *testing.T) {
	h := newTestHandlers(t)
	body, _ := json.Marshal(map[string]string{"yaml_content": "test"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/policies//test", bytes.NewReader(body))
	req.URL.Path = "/api/v1/policies//test"
	w := httptest.NewRecorder()
	h.TestPolicy(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestTestPolicy_NotFound(t *testing.T) {
	h := newTestHandlers(t)
	body, _ := json.Marshal(map[string]string{"yaml_content": "test"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/policies/no-policy/test", bytes.NewReader(body))
	req.URL.Path = "/api/v1/policies/no-policy/test"
	w := httptest.NewRecorder()
	h.TestPolicy(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestTestPolicy_Matched(t *testing.T) {
	h := newTestHandlers(t)

	createBody, _ := json.Marshal(storage.PolicyRow{
		ID: "secret-detector", Name: "Secret Detector", Pattern: `AKIA`, Message: "AWS key", Severity: "high",
	})
	createReq := httptest.NewRequest(http.MethodPost, "/api/v1/policies", bytes.NewReader(createBody))
	createW := httptest.NewRecorder()
	h.CreatePolicy(createW, createReq)
	require.Equal(t, http.StatusCreated, createW.Code)

	testBody, _ := json.Marshal(map[string]string{"yaml_content": "AKIAIOSFODNN7EXAMPLE"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/policies/secret-detector/test", bytes.NewReader(testBody))
	req.URL.Path = "/api/v1/policies/secret-detector/test"
	w := httptest.NewRecorder()
	h.TestPolicy(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, true, resp["matched"])
	assert.NotNil(t, resp["finding"])
}

func TestTestPolicy_NotMatched(t *testing.T) {
	h := newTestHandlers(t)

	createBody, _ := json.Marshal(storage.PolicyRow{
		ID: "secret-detector2", Name: "Secret Detector", Pattern: `AKIA`, Message: "AWS key",
	})
	createReq := httptest.NewRequest(http.MethodPost, "/api/v1/policies", bytes.NewReader(createBody))
	createW := httptest.NewRecorder()
	h.CreatePolicy(createW, createReq)
	require.Equal(t, http.StatusCreated, createW.Code)

	testBody, _ := json.Marshal(map[string]string{"yaml_content": "no secrets here"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/policies/secret-detector2/test", bytes.NewReader(testBody))
	req.URL.Path = "/api/v1/policies/secret-detector2/test"
	w := httptest.NewRecorder()
	h.TestPolicy(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, false, resp["matched"])
	assert.Nil(t, resp["finding"])
}
