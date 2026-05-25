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

// setupRouterWithRoutes creates a gin engine using RegisterRoutes.
func setupRouterWithRoutes() (*gin.Engine, *OnboardingHandler) {
	repo := NewInMemoryOnboardingRepository()
	sandbox := NewInMemorySandboxService(30)
	handler := NewOnboardingHandler(repo, sandbox)

	r := gin.New()
	group := r.Group("/onboarding")
	RegisterRoutes(group, handler)
	return r, handler
}

func TestRegisterRoutes_AllRoutesRegistered(t *testing.T) {
	r, _ := setupRouterWithRoutes()
	routes := r.Routes()

	expected := map[string]string{
		"POST /onboarding/start":              "start",
		"GET /onboarding/:id":                 "get session",
		"POST /onboarding/:id/step/:step":     "complete step",
		"POST /onboarding/:id/sandbox":        "provision sandbox",
		"GET /onboarding/:id/checklist":       "get checklist",
		"POST /onboarding/:id/checklist/:item": "complete checklist item",
		"GET /onboarding/analytics":           "analytics",
	}

	registered := make(map[string]bool, len(routes))
	for _, route := range routes {
		key := route.Method + " " + route.Path
		registered[key] = true
	}

	for key, label := range expected {
		assert.True(t, registered[key],
			"route %q (%s) should be registered", key, label)
	}

	assert.Equal(t, len(expected), len(routes),
		"total registered routes should match expected count")
}

func TestRegisterRoutes_IntegrationFlow(t *testing.T) {

	r, _ := setupRouterWithRoutes()

	// Step 1: POST /onboarding/start -> create session.
	body := `{"org_name":"FlowOrg","admin_email":"flow@test.com"}`
	req := httptest.NewRequest(http.MethodPost, "/onboarding/start",
		bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusCreated, w.Code)
	var session map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &session))

	id, ok := session["id"].(string)
	require.True(t, ok, "session must contain an id")
	assert.Equal(t, "FlowOrg", session["org_name"])
	assert.Equal(t, "ORG_SETUP", session["current_step"])

	// Step 2: GET /onboarding/:id -> retrieve session.
	req = httptest.NewRequest(http.MethodGet, "/onboarding/"+id, nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var fetched map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &fetched))
	assert.Equal(t, id, fetched["id"])

	// Step 3: POST /onboarding/:id/step/TENANT_CONFIG -> advance step.
	req = httptest.NewRequest(http.MethodPost,
		"/onboarding/"+id+"/step/TENANT_CONFIG", nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var stepped map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &stepped))
	assert.Equal(t, "TENANT_CONFIG", stepped["current_step"])
}

func TestRegisterRoutes_AnalyticsReturns200(t *testing.T) {
	r, _ := setupRouterWithRoutes()

	req := httptest.NewRequest(http.MethodGet, "/onboarding/analytics", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var analytics map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &analytics))
	assert.Contains(t, analytics, "total_sessions")
	assert.Contains(t, analytics, "completed_sessions")
}

func TestRegisterRoutes_SandboxViaRoutes(t *testing.T) {
	r, _ := setupRouterWithRoutes()

	// Create a session first.
	body := `{"org_name":"SandboxOrg","admin_email":"sb@test.com"}`
	req := httptest.NewRequest(http.MethodPost, "/onboarding/start",
		bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusCreated, w.Code)

	var session map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &session))
	id := session["id"].(string)

	// Provision sandbox.
	req = httptest.NewRequest(http.MethodPost,
		"/onboarding/"+id+"/sandbox", nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)
	var cfg map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &cfg))
	assert.NotEmpty(t, cfg["api_key"])
}

func TestRegisterRoutes_ChecklistViaRoutes(t *testing.T) {

	r, _ := setupRouterWithRoutes()

	// Create a session.
	body := `{"org_name":"CLOrg","admin_email":"cl@test.com"}`
	req := httptest.NewRequest(http.MethodPost, "/onboarding/start",
		bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusCreated, w.Code)

	var session map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &session))
	id := session["id"].(string)

	// GET checklist.
	req = httptest.NewRequest(http.MethodGet,
		"/onboarding/"+id+"/checklist", nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var checklist map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &checklist))
	assert.Contains(t, checklist, "items")

	// POST complete checklist item (URL-encode the space).
	req = httptest.NewRequest(http.MethodPost,
		"/onboarding/"+id+"/checklist/API%20Authentication", nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}
