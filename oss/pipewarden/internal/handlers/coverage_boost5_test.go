package handlers

// coverage_boost5_test.go targets remaining 55-75% functions:
// fix_pr.go (CreateFixPR error paths), fix_suggestions.go (GetFixSuggestion),
// helpers.go (LoadConnectionsFromDB), sbom.go (GenerateSBOM),
// analysis_persist.go (persistFindings, persistAnalysisRecord),
// connections_crud.go (CreateConnection success), notifications.go (NotificationCount),
// payment.go (subscriptionFromEvent branches), semgrep_rules.go.

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

// ---------------------------------------------------------------------------
// fix_pr.go — CreateFixPR error paths + extractFindingIDFromPRPath
// ---------------------------------------------------------------------------

func TestCreateFixPRB5_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/findings/1/fix/pr", nil)
	w := httptest.NewRecorder()
	h.CreateFixPR(w, req)
	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestCreateFixPRB5_InvalidID(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/findings/abc/fix/pr", strings.NewReader("{}"))
	w := httptest.NewRecorder()
	h.CreateFixPR(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateFixPRB5_InvalidJSON(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/findings/1/fix/pr", strings.NewReader("{bad"))
	w := httptest.NewRecorder()
	h.CreateFixPR(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateFixPRB5_MissingGitHubToken(t *testing.T) {
	h := newTestHandlers(t)
	body, _ := json.Marshal(FixPRRequest{Owner: "org", Repo: "r"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/findings/1/fix/pr", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateFixPR(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateFixPRB5_MissingOwnerRepo(t *testing.T) {
	h := newTestHandlers(t)
	body, _ := json.Marshal(FixPRRequest{GitHubToken: "tok"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/findings/1/fix/pr", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateFixPR(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateFixPRB5_FindingNotFound(t *testing.T) {
	h := newTestHandlers(t)
	body, _ := json.Marshal(FixPRRequest{Owner: "org", Repo: "r", GitHubToken: "tok"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/findings/9999/fix/pr", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateFixPR(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestExtractFindingIDFromPRPath_Valid(t *testing.T) {
	id, err := extractFindingIDFromPRPath("/api/v1/findings/42/fix/pr")
	require.NoError(t, err)
	assert.Equal(t, int64(42), id)
}

func TestExtractFindingIDFromPRPath_Invalid(t *testing.T) {
	_, err := extractFindingIDFromPRPath("/api/v1/findings/abc/fix/pr")
	require.Error(t, err)
}

func TestSanitizeBranchSegment_SpecialChars(t *testing.T) {
	result := sanitizeBranchSegment("Secret Exposure!")
	assert.Equal(t, "secret-exposure-", result)
}

func TestBuildPRBody_ContainsSteps(t *testing.T) {
	body := buildPRBody([]string{"Step 1", "Step 2"}, 42)
	assert.Contains(t, body, "Step 1")
	assert.Contains(t, body, "Step 2")
	assert.Contains(t, body, "#42")
}

// ---------------------------------------------------------------------------
// fix_suggestions.go — GetFixSuggestion + fixStepsForFinding branches
// ---------------------------------------------------------------------------

func TestGetFixSuggestionB5_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/findings/1/fix", nil)
	w := httptest.NewRecorder()
	h.GetFixSuggestion(w, req)
	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestGetFixSuggestionB5_InvalidID(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/findings/abc/fix", nil)
	w := httptest.NewRecorder()
	h.GetFixSuggestion(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestGetFixSuggestionB5_NotFound(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/findings/9999/fix", nil)
	w := httptest.NewRecorder()
	h.GetFixSuggestion(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestGetFixSuggestionB5_SupplyChain_ActionPin(t *testing.T) {
	h, db := newTestHandlersDB(t)
	require.NoError(t, db.CreateFinding(&storage.FindingRecord{
		ConnectionName: "c", RunID: "r", Severity: "high",
		Category: "supply-chain", Title: "Unpinned action detected",
		Status: "open", CreatedAt: time.Now(),
	}))
	findings, _ := db.ListFindings("c")
	id := findings[0].ID
	req := httptest.NewRequest(http.MethodGet, "/api/v1/findings/"+fmtID(id)+"/fix", nil)
	w := httptest.NewRecorder()
	h.GetFixSuggestion(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var resp FixSuggestion
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "supply-chain", resp.Category)
	assert.True(t, resp.AutoFixable)
}

func TestGetFixSuggestionB5_SecretExposure(t *testing.T) {
	h, db := newTestHandlersDB(t)
	require.NoError(t, db.CreateFinding(&storage.FindingRecord{
		ConnectionName: "c2", RunID: "r", Severity: "critical",
		Category: "secret-exposure", Title: "Hardcoded AWS key",
		Status: "open", CreatedAt: time.Now(),
	}))
	findings, _ := db.ListFindings("c2")
	id := findings[0].ID
	req := httptest.NewRequest(http.MethodGet, "/api/v1/findings/"+fmtID(id)+"/fix", nil)
	w := httptest.NewRecorder()
	h.GetFixSuggestion(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var resp FixSuggestion
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "secret-exposure", resp.Category)
	assert.False(t, resp.AutoFixable)
}

// fixStepsForFinding branches already covered by coverage_boost_test.go

// ---------------------------------------------------------------------------
// sbom.go — GenerateSBOM
// ---------------------------------------------------------------------------

func TestGenerateSBOMB5_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/connections/myconn/sbom", nil)
	w := httptest.NewRecorder()
	h.GenerateSBOM(w, req)
	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}

func TestGenerateSBOMB5_MissingName(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/connections//sbom", nil)
	w := httptest.NewRecorder()
	h.GenerateSBOM(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestGenerateSBOMB5_EmptyFindings(t *testing.T) {
	h := newTestHandlers(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/connections/myconn/sbom", nil)
	w := httptest.NewRecorder()
	h.GenerateSBOM(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var doc SBOMDocument
	require.NoError(t, json.NewDecoder(w.Body).Decode(&doc))
	assert.Equal(t, "CycloneDX", doc.BOMFormat)
	assert.Equal(t, "1.4", doc.SpecVersion)
}

func TestGenerateSBOMB5_WithFindings(t *testing.T) {
	h, db := newTestHandlersDB(t)
	require.NoError(t, db.CreateFinding(&storage.FindingRecord{
		ConnectionName: "sbom-conn", RunID: "r1", Severity: "critical",
		Category: "supply-chain", Title: "Unpinned action",
		Status: "open", CreatedAt: time.Now(),
	}))
	req := httptest.NewRequest(http.MethodGet, "/api/v1/connections/sbom-conn/sbom", nil)
	w := httptest.NewRecorder()
	h.GenerateSBOM(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var doc SBOMDocument
	require.NoError(t, json.NewDecoder(w.Body).Decode(&doc))
	assert.Len(t, doc.Components, 1)
	assert.Len(t, doc.Vulnerabilities, 1)
}

// ---------------------------------------------------------------------------
// notifications.go — NotificationCount additional branch
// ---------------------------------------------------------------------------

func TestNotificationCountB5_AfterCreate(t *testing.T) {
	h, db := newTestHandlersDB(t)
	// Create a notification via seeding a critical finding (which triggers notification)
	require.NoError(t, db.CreateFinding(&storage.FindingRecord{
		ConnectionName: "n-conn", RunID: "r", Severity: "critical",
		Category: "secrets", Title: "Count test finding",
		Status: "open", CreatedAt: time.Now(),
	}))
	req := httptest.NewRequest(http.MethodGet, "/api/v1/notifications/count", nil)
	w := httptest.NewRecorder()
	h.NotificationCount(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string]interface{}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	_, hasUnread := resp["unread"]
	assert.True(t, hasUnread)
}

// subscriptionFromEvent and tenantIDFromCustomData tested in payment_subscription_test.go

// LoadConnectionsFromDB tests already exist in helpers_full_test.go

// ---------------------------------------------------------------------------
// connections_crud.go — CreateConnection success path
// ---------------------------------------------------------------------------

func TestCreateConnectionB5_GitHubSuccess(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	body, _ := json.Marshal(map[string]string{
		"name": "gh-new", "platform": "github", "token": "tok123",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/connections", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateConnection(w, req)
	require.Equal(t, http.StatusCreated, w.Code)
	var resp map[string]string
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, "added", resp["status"])
}

func TestCreateConnectionB5_GitLabSuccess(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	body, _ := json.Marshal(map[string]string{
		"name": "gl-new", "platform": "gitlab", "token": "tok456",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/connections", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateConnection(w, req)
	require.Equal(t, http.StatusCreated, w.Code)
}

// analysis_persist.go persistFindings already tested via ScanDLP in coverage_boost3_test.go

// ---------------------------------------------------------------------------
// validateTemplate — missing/empty name branch
// ---------------------------------------------------------------------------

func TestValidateTemplateB5_MissingName(t *testing.T) {
	err := validateTemplate(storage.TemplateRow{ID: "t1", Destination: "slack", Template: "hi"})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "name")
}

func TestValidateTemplateB5_MissingTemplate(t *testing.T) {
	err := validateTemplate(storage.TemplateRow{ID: "t1", Name: "n", Destination: "slack"})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "template")
}
