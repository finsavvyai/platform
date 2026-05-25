package onboarding

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setupIntegrationRouter creates a gin router with real repo and sandbox.
func setupIntegrationRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	repo := NewInMemoryOnboardingRepository()
	sandbox := NewInMemorySandboxService(30)
	handler := NewOnboardingHandler(repo, sandbox)

	r := gin.New()
	group := r.Group("/onboarding")
	RegisterRoutes(group, handler)
	return r
}

// startSession is a helper that POSTs to /onboarding/start and returns the session.
func startSession(t *testing.T, router *gin.Engine) OnboardingSession {
	t.Helper()
	body, _ := json.Marshal(StartOnboardingRequest{
		OrgName:    "TestOrg",
		AdminEmail: "admin@testorg.com",
	})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/onboarding/start", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusCreated, w.Code)

	var session OnboardingSession
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &session))
	return session
}

func TestIntegration_FullOnboardingFlow(t *testing.T) {

	router := setupIntegrationRouter()

	// Step 1: Start onboarding
	session := startSession(t, router)
	assert.NotEmpty(t, session.ID)
	assert.Equal(t, StepOrgSetup, session.CurrentStep)
	assert.Equal(t, StatusInProgress, session.Status)

	// Step 2: GET session by ID
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/onboarding/"+session.ID, nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	// Step 3: Advance to TENANT_CONFIG
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/onboarding/"+session.ID+"/step/TENANT_CONFIG", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	var updated OnboardingSession
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &updated))
	assert.Equal(t, StepTenantConfig, updated.CurrentStep)

	// Step 4: Provision sandbox
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/onboarding/"+session.ID+"/sandbox", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)

	var sandboxCfg SandboxConfig
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &sandboxCfg))
	assert.Contains(t, sandboxCfg.APIKey, "sk_sandbox_")
	assert.True(t, sandboxCfg.SyntheticDataLoaded)

	// Step 5: Get integration checklist
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/onboarding/"+session.ID+"/checklist", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	var checklist IntegrationChecklist
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &checklist))
	assert.Equal(t, session.ID, checklist.SessionID)
	assert.Len(t, checklist.Items, 5)
}

func TestIntegration_StepOrderingEnforced(t *testing.T) {

	router := setupIntegrationRouter()
	session := startSession(t, router)

	// Try to skip directly to SANDBOX (should fail)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/onboarding/"+session.ID+"/step/SANDBOX", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)

	var errResp map[string]string
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &errResp))
	assert.Contains(t, errResp["error"], "cannot advance")

	// Try to skip to INTEGRATION_CHECK (should also fail)
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/onboarding/"+session.ID+"/step/INTEGRATION_CHECK", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestIntegration_SandboxHasCorrectPrefix(t *testing.T) {

	router := setupIntegrationRouter()
	session := startSession(t, router)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/onboarding/"+session.ID+"/sandbox", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)

	var cfg SandboxConfig
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &cfg))
	assert.True(t, len(cfg.APIKey) > len("sk_sandbox_"))
	assert.Equal(t, "sk_sandbox_", cfg.APIKey[:11])
	assert.Equal(t, 100, cfg.TransactionCount)
}

func TestIntegration_DuplicateSandboxRejected(t *testing.T) {

	router := setupIntegrationRouter()
	session := startSession(t, router)

	// First provision succeeds
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/onboarding/"+session.ID+"/sandbox", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)

	// Second provision returns 409 Conflict
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/onboarding/"+session.ID+"/sandbox", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusConflict, w.Code)
}

func TestIntegration_AnalyticsAfterMultipleSessions(t *testing.T) {

	router := setupIntegrationRouter()

	// Create 3 sessions
	for i := 0; i < 3; i++ {
		startSession(t, router)
	}

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/onboarding/analytics", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	var analytics OnboardingAnalytics
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &analytics))
	assert.Equal(t, 3, analytics.TotalSessions)
}

func TestIntegration_GetNonexistentSession(t *testing.T) {

	router := setupIntegrationRouter()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/onboarding/nonexistent-id", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}
