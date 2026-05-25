package fraud

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

// newIntegrationModelRouter creates a Gin engine with real model routes.
func newIntegrationModelRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	repo := NewInMemoryModelRepository()
	abSvc := NewInMemoryABTestService(repo)
	v1 := router.Group("/v1")
	RegisterModelRoutes(v1, repo, abSvc)
	return router
}

func createIntegrationModel(t *testing.T, r *gin.Engine, name, algo, ver string) string {
	t.Helper()
	m := ModelVersion{
		Name: name, Algorithm: algo, Version: ver,
		Metrics: ModelMetrics{
			Accuracy: 0.9, Precision: 0.88, Recall: 0.85,
			F1Score: 0.86, AUCROC: 0.92,
		},
	}
	body, _ := json.Marshal(m)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/models", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)
	var resp map[string]interface{}
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	model := resp["model"].(map[string]interface{})
	return model["id"].(string)
}

// TestIntegration_Model_CRUDLifecycle tests create, list, get, activate.
func TestIntegration_Model_CRUDLifecycle(t *testing.T) {
	r := newIntegrationModelRouter()
	id := createIntegrationModel(t, r, "XGBoost v1", "xgboost", "1.0.0")
	assert.NotEmpty(t, id)

	// List
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/models", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var list map[string]interface{}
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &list))
	assert.Equal(t, float64(1), list["total"])

	// Get
	w2 := httptest.NewRecorder()
	req2, _ := http.NewRequest(http.MethodGet, "/v1/models/"+id, nil)
	r.ServeHTTP(w2, req2)
	assert.Equal(t, http.StatusOK, w2.Code)

	// Activate
	statusBody, _ := json.Marshal(map[string]string{"status": "active"})
	w3 := httptest.NewRecorder()
	req3, _ := http.NewRequest(http.MethodPut, "/v1/models/"+id+"/status",
		bytes.NewBuffer(statusBody))
	req3.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w3, req3)
	assert.Equal(t, http.StatusOK, w3.Code)

	// Verify active
	w4 := httptest.NewRecorder()
	req4, _ := http.NewRequest(http.MethodGet, "/v1/models/"+id, nil)
	r.ServeHTTP(w4, req4)
	var detail map[string]interface{}
	assert.NoError(t, json.Unmarshal(w4.Body.Bytes(), &detail))
	model := detail["model"].(map[string]interface{})
	assert.Equal(t, "active", model["status"])
}

// TestIntegration_Model_ABTestLifecycle tests create, get active, stop.
func TestIntegration_Model_ABTestLifecycle(t *testing.T) {
	r := newIntegrationModelRouter()
	idA := createIntegrationModel(t, r, "Model A", "xgboost", "1.0.0")
	idB := createIntegrationModel(t, r, "Model B", "rf", "1.0.0")

	// Create A/B test
	cfg, _ := json.Marshal(ABTestConfig{
		Name: "F1 comparison", ModelAID: idA, ModelBID: idB, TrafficSplit: 70,
	})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/models/abtest", bytes.NewBuffer(cfg))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)

	var createResp map[string]interface{}
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &createResp))
	test := createResp["test"].(map[string]interface{})
	testID := test["id"].(string)
	assert.Equal(t, "running", test["status"])

	// Get active
	w2 := httptest.NewRecorder()
	req2, _ := http.NewRequest(http.MethodGet, "/v1/models/abtest/active", nil)
	r.ServeHTTP(w2, req2)
	assert.Equal(t, http.StatusOK, w2.Code)

	// Stop test
	stopBody, _ := json.Marshal(map[string]string{"test_id": testID})
	w3 := httptest.NewRecorder()
	req3, _ := http.NewRequest(http.MethodPost, "/v1/models/abtest/stop",
		bytes.NewBuffer(stopBody))
	req3.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w3, req3)
	assert.Equal(t, http.StatusOK, w3.Code)

	var stopResp map[string]interface{}
	assert.NoError(t, json.Unmarshal(w3.Body.Bytes(), &stopResp))
	result := stopResp["result"].(map[string]interface{})
	assert.NotEmpty(t, result["winner"])
}

// TestIntegration_Model_CompareModels tests side-by-side comparison.
func TestIntegration_Model_CompareModels(t *testing.T) {
	r := newIntegrationModelRouter()
	idA := createIntegrationModel(t, r, "Model A", "xgboost", "1.0.0")
	idB := createIntegrationModel(t, r, "Model B", "rf", "1.0.0")

	w := httptest.NewRecorder()
	url := "/v1/models/compare?model_a=" + idA + "&model_b=" + idB
	req, _ := http.NewRequest(http.MethodGet, url, nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	var body map[string]interface{}
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Contains(t, body, "comparison")
}

// TestIntegration_Model_NotFoundReturns404 verifies missing model.
func TestIntegration_Model_NotFoundReturns404(t *testing.T) {
	r := newIntegrationModelRouter()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/models/nonexistent", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

// TestIntegration_Model_NoActiveTestReturns404 tests absent test.
func TestIntegration_Model_NoActiveTestReturns404(t *testing.T) {
	r := newIntegrationModelRouter()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/models/abtest/active", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

// TestIntegration_Model_DuplicateABTestBlocked tests concurrency guard.
func TestIntegration_Model_DuplicateABTestBlocked(t *testing.T) {
	r := newIntegrationModelRouter()
	idA := createIntegrationModel(t, r, "A", "xgboost", "1.0.0")
	idB := createIntegrationModel(t, r, "B", "rf", "1.0.0")
	idC := createIntegrationModel(t, r, "C", "lstm", "1.0.0")

	cfg, _ := json.Marshal(ABTestConfig{
		Name: "T1", ModelAID: idA, ModelBID: idB, TrafficSplit: 50,
	})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/models/abtest", bytes.NewBuffer(cfg))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)

	cfg2, _ := json.Marshal(ABTestConfig{
		Name: "T2", ModelAID: idA, ModelBID: idC, TrafficSplit: 50,
	})
	w2 := httptest.NewRecorder()
	req2, _ := http.NewRequest(http.MethodPost, "/v1/models/abtest", bytes.NewBuffer(cfg2))
	req2.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w2, req2)
	assert.Equal(t, http.StatusBadRequest, w2.Code)
}
