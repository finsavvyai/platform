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

func init() {
	gin.SetMode(gin.TestMode)
}

func setupRouter() (*gin.Engine, *OnboardingHandler) {
	repo := NewInMemoryOnboardingRepository()
	sandbox := NewInMemorySandboxService(30)
	handler := NewOnboardingHandler(repo, sandbox)

	r := gin.New()
	r.POST("/onboarding", handler.StartOnboarding)
	r.GET("/onboarding/analytics", handler.GetAnalytics)
	r.GET("/onboarding/:id", handler.GetSession)
	r.POST("/onboarding/:id/step/:step", handler.CompleteStep)
	r.POST("/onboarding/:id/sandbox", handler.ProvisionSandbox)
	r.GET("/onboarding/:id/checklist", handler.GetChecklist)
	r.POST("/onboarding/:id/checklist/:item", handler.CompleteChecklistItem)
	return r, handler
}

func createSession(t *testing.T, r *gin.Engine) map[string]interface{} {
	t.Helper()
	body := `{"org_name":"TestOrg","admin_email":"admin@test.com"}`
	req := httptest.NewRequest(http.MethodPost, "/onboarding",
		bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusCreated, w.Code)

	var result map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &result))
	return result
}

func TestStartOnboarding_Success(t *testing.T) {
	r, _ := setupRouter()
	result := createSession(t, r)

	assert.Equal(t, "TestOrg", result["org_name"])
	assert.Equal(t, "admin@test.com", result["admin_email"])
	assert.Equal(t, "ORG_SETUP", result["current_step"])
	assert.Equal(t, "IN_PROGRESS", result["status"])
	assert.NotEmpty(t, result["id"])
	assert.NotEmpty(t, result["tenant_id"])
}

func TestStartOnboarding_InvalidInput(t *testing.T) {
	r, _ := setupRouter()

	tests := []struct {
		name string
		body string
	}{
		{"missing org_name", `{"admin_email":"a@b.com"}`},
		{"missing email", `{"org_name":"Org"}`},
		{"invalid email", `{"org_name":"Org","admin_email":"bad"}`},
		{"empty body", `{}`},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/onboarding",
				bytes.NewBufferString(tc.body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			assert.Equal(t, http.StatusBadRequest, w.Code)
		})
	}
}

func TestGetSession_Success(t *testing.T) {
	r, _ := setupRouter()
	created := createSession(t, r)
	id := created["id"].(string)

	req := httptest.NewRequest(http.MethodGet, "/onboarding/"+id, nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var result map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &result))
	assert.Equal(t, id, result["id"])
}

func TestGetSession_NotFound(t *testing.T) {
	r, _ := setupRouter()

	req := httptest.NewRequest(http.MethodGet, "/onboarding/nonexistent", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestCompleteStep_Success(t *testing.T) {
	r, _ := setupRouter()
	created := createSession(t, r)
	id := created["id"].(string)

	// Advance from ORG_SETUP to TENANT_CONFIG.
	req := httptest.NewRequest(http.MethodPost,
		"/onboarding/"+id+"/step/TENANT_CONFIG", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var result map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &result))
	assert.Equal(t, "TENANT_CONFIG", result["current_step"])
}

func TestCompleteStep_InvalidOrder(t *testing.T) {
	r, _ := setupRouter()
	created := createSession(t, r)
	id := created["id"].(string)

	// Try to skip from ORG_SETUP to SANDBOX (skipping steps).
	req := httptest.NewRequest(http.MethodPost,
		"/onboarding/"+id+"/step/SANDBOX", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestProvisionSandbox_Success(t *testing.T) {
	r, _ := setupRouter()
	created := createSession(t, r)
	id := created["id"].(string)

	req := httptest.NewRequest(http.MethodPost,
		"/onboarding/"+id+"/sandbox", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)
	var cfg map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &cfg))
	assert.NotEmpty(t, cfg["api_key"])
	assert.NotEmpty(t, cfg["api_endpoint"])
	assert.Equal(t, true, cfg["synthetic_data_loaded"])
}
