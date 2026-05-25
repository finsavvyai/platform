package fraud

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

func setupModelRouter(t *testing.T) (*gin.Engine, *InMemoryModelRepository, *InMemoryABTestService) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	repo := NewInMemoryModelRepository()
	abSvc := NewInMemoryABTestService(repo)
	handler := NewModelHandler(repo, abSvc)

	r := gin.New()
	g := r.Group("/v1/models")
	g.GET("", handler.ListModels)
	g.GET("/compare", handler.CompareModels)
	g.GET("/:id", handler.GetModel)
	g.POST("", handler.CreateModel)
	g.PUT("/:id/status", handler.UpdateModelStatus)
	g.POST("/abtest", handler.CreateABTest)
	g.GET("/abtest/active", handler.GetActiveABTest)
	g.POST("/abtest/stop", handler.StopABTest)

	return r, repo, abSvc
}

func TestModelHandlers_ListModels(t *testing.T) {
	r, repo, _ := setupModelRouter(t)
	_, _ = repo.CreateModel(ModelVersion{Name: "M1", Algorithm: "a", Version: "1"})
	_, _ = repo.CreateModel(ModelVersion{Name: "M2", Algorithm: "b", Version: "2"})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/v1/models?limit=10", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	assert.Equal(t, float64(2), resp["total"])
	assert.NotEmpty(t, resp["request_id"])
}

func TestModelHandlers_GetModel(t *testing.T) {
	r, repo, _ := setupModelRouter(t)
	m, _ := repo.CreateModel(ModelVersion{Name: "M1", Algorithm: "a", Version: "1"})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/v1/models/"+m.ID, nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestModelHandlers_GetModelNotFound(t *testing.T) {
	r, _, _ := setupModelRouter(t)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/v1/models/nonexistent", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestModelHandlers_CreateModel(t *testing.T) {
	r, _, _ := setupModelRouter(t)

	body := map[string]interface{}{
		"name": "New Model", "algorithm": "xgboost", "version": "3.0",
		"metrics": map[string]interface{}{
			"accuracy": 0.95, "precision": 0.92, "recall": 0.88,
			"f1_score": 0.90, "auc_roc": 0.97, "processing_time_ms": 30,
		},
	}
	data, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/v1/models", bytes.NewBuffer(data))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)
}

func TestModelHandlers_CreateModelInvalidMetrics(t *testing.T) {
	r, _, _ := setupModelRouter(t)

	body := map[string]interface{}{
		"name": "Bad", "algorithm": "a", "version": "1",
		"metrics": map[string]interface{}{"accuracy": 1.5},
	}
	data, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/v1/models", bytes.NewBuffer(data))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestModelHandlers_UpdateStatus(t *testing.T) {
	r, repo, _ := setupModelRouter(t)
	m, _ := repo.CreateModel(ModelVersion{Name: "M", Algorithm: "a", Version: "1"})

	body, _ := json.Marshal(map[string]string{"status": "active"})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("PUT", "/v1/models/"+m.ID+"/status", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestModelHandlers_CompareModels(t *testing.T) {
	r, repo, _ := setupModelRouter(t)
	mA, _ := repo.CreateModel(ModelVersion{
		Name: "A", Algorithm: "a", Version: "1",
		Metrics: ModelMetrics{F1Score: 0.9},
	})
	mB, _ := repo.CreateModel(ModelVersion{
		Name: "B", Algorithm: "b", Version: "2",
		Metrics: ModelMetrics{F1Score: 0.8},
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/v1/models/compare?model_a="+mA.ID+"&model_b="+mB.ID, nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestModelHandlers_CompareMissingParams(t *testing.T) {
	r, _, _ := setupModelRouter(t)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/v1/models/compare", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestModelHandlers_ABTestLifecycle(t *testing.T) {
	r, repo, _ := setupModelRouter(t)
	mA, _ := repo.CreateModel(ModelVersion{
		Name: "A", Algorithm: "a", Version: "1",
		Metrics: ModelMetrics{F1Score: 0.9},
	})
	mB, _ := repo.CreateModel(ModelVersion{
		Name: "B", Algorithm: "b", Version: "2",
		Metrics: ModelMetrics{F1Score: 0.8},
	})

	// Create test
	createBody, _ := json.Marshal(map[string]interface{}{
		"name": "Test", "model_a_id": mA.ID, "model_b_id": mB.ID, "traffic_split": 70,
	})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/v1/models/abtest", bytes.NewBuffer(createBody))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusCreated, w.Code)

	var createResp map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &createResp)
	testData := createResp["test"].(map[string]interface{})
	testID := testData["id"].(string)

	// Get active test
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/v1/models/abtest/active", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	// Stop test
	stopBody, _ := json.Marshal(map[string]string{"test_id": testID})
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/v1/models/abtest/stop", bytes.NewBuffer(stopBody))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestModelHandlers_GetActiveABTestNone(t *testing.T) {
	r, _, _ := setupModelRouter(t)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/v1/models/abtest/active", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}
