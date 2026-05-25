package fraud

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

// newIntegrationPatternRouter creates a Gin engine with real pattern routes.
func newIntegrationPatternRouter() (*gin.Engine, *InMemoryPatternStore) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	store := NewInMemoryPatternStore()
	v1 := router.Group("/v1")
	RegisterPatternRoutes(v1, store)
	return router, store
}

// seedPatterns opts-in N tenants and contributes shared patterns.
func seedPatterns(store *InMemoryPatternStore, tenantCount int) {
	for i := range tenantCount {
		tid := fmt.Sprintf("tenant-%d", i)
		_ = store.UpdateTenantConfig(&PatternSharingConfig{
			TenantID: tid, OptIn: true, AnonymizationThreshold: 3,
			SharingScope: "industry_wide",
		})
		_ = store.ContributePatterns(&PatternContribution{
			TenantID: tid,
			Patterns: []SharedPattern{
				{PatternType: "velocity_attack", Frequency: 10 + i},
				{PatternType: "card_testing", Frequency: 5 + i},
			},
		})
	}
}

// TestIntegration_Pattern_ContributeAndAggregate verifies full cycle.
func TestIntegration_Pattern_ContributeAndAggregate(t *testing.T) {
	r, store := newIntegrationPatternRouter()
	seedPatterns(store, 5) // meets default k-anonymity of 5

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/patterns/aggregate?tenant_id=tenant-0", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var body map[string]interface{}
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	patterns := body["patterns"].([]interface{})
	assert.GreaterOrEqual(t, len(patterns), 2)
}

// TestIntegration_Pattern_KAnonymityEnforced verifies threshold filtering.
func TestIntegration_Pattern_KAnonymityEnforced(t *testing.T) {
	r, store := newIntegrationPatternRouter()
	seedPatterns(store, 2) // below default threshold of 5

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/patterns/aggregate?tenant_id=tenant-0", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var body map[string]interface{}
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	patterns := body["patterns"].([]interface{})
	assert.Len(t, patterns, 0, "patterns below k-anonymity excluded")
}

// TestIntegration_Pattern_OptOutBlocked verifies opt-out tenants blocked.
func TestIntegration_Pattern_OptOutBlocked(t *testing.T) {
	r, store := newIntegrationPatternRouter()
	_ = store.UpdateTenantConfig(&PatternSharingConfig{
		TenantID: "blocked", OptIn: false, AnonymizationThreshold: 5,
		SharingScope: "industry_wide",
	})

	payload, _ := json.Marshal(PatternContribution{
		TenantID: "blocked",
		Patterns: []SharedPattern{{PatternType: "velocity_attack", Frequency: 1}},
	})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/patterns/contribute", bytes.NewBuffer(payload))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusForbidden, w.Code)
}

// TestIntegration_Pattern_ConfigGetAndUpdate verifies config CRUD.
func TestIntegration_Pattern_ConfigGetAndUpdate(t *testing.T) {
	r, _ := newIntegrationPatternRouter()

	// GET default
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/patterns/config?tenant_id=new-t", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var body map[string]interface{}
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	config := body["config"].(map[string]interface{})
	assert.False(t, config["opt_in"].(bool))

	// PUT update
	update, _ := json.Marshal(PatternSharingConfig{
		TenantID: "new-t", OptIn: true, AnonymizationThreshold: 5,
		SharingScope: "industry_wide",
	})
	w2 := httptest.NewRecorder()
	req2, _ := http.NewRequest(http.MethodPut, "/v1/patterns/config", bytes.NewBuffer(update))
	req2.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w2, req2)
	assert.Equal(t, http.StatusOK, w2.Code)
}

// TestIntegration_Pattern_StatsEndpoint verifies aggregate stats.
func TestIntegration_Pattern_StatsEndpoint(t *testing.T) {
	r, store := newIntegrationPatternRouter()
	seedPatterns(store, 3)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/patterns/stats", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var body map[string]interface{}
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	stats := body["stats"].(map[string]interface{})
	assert.Equal(t, float64(3), stats["contributing_tenants"])
}

// TestIntegration_Pattern_MissingTenantBadReq verifies validation.
func TestIntegration_Pattern_MissingTenantBadReq(t *testing.T) {
	r, _ := newIntegrationPatternRouter()
	for _, path := range []string{"/v1/patterns/aggregate", "/v1/patterns/config"} {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, path, nil)
		r.ServeHTTP(w, req)
		assert.Equal(t, http.StatusBadRequest, w.Code)
	}
}

// TestIntegration_Pattern_InvalidBody verifies body validation.
func TestIntegration_Pattern_InvalidBody(t *testing.T) {
	r, _ := newIntegrationPatternRouter()

	// Malformed JSON triggers 400 from binding
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/patterns/contribute",
		bytes.NewBufferString(`not-json`))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}
