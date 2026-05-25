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

func setupABTestRouter(t *testing.T) (*gin.Engine, *InMemoryModelRepository) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	repo := NewInMemoryModelRepository()
	abSvc := NewInMemoryABTestService(repo)
	handler := NewModelHandler(repo, abSvc)

	r := gin.New()
	g := r.Group("/v1/models/abtest")
	g.POST("", handler.CreateABTest)
	g.GET("/active", handler.GetActiveABTest)
	g.POST("/stop", handler.StopABTest)

	return r, repo
}

func TestABTestHandlers_CreateABTest(t *testing.T) {
	r, repo := setupABTestRouter(t)
	mA, _ := repo.CreateModel(ModelVersion{
		Name: "A", Algorithm: "a", Version: "1",
		Metrics: ModelMetrics{F1Score: 0.9},
	})
	mB, _ := repo.CreateModel(ModelVersion{
		Name: "B", Algorithm: "b", Version: "2",
		Metrics: ModelMetrics{F1Score: 0.85},
	})

	body, _ := json.Marshal(map[string]interface{}{
		"name": "Test", "model_a_id": mA.ID, "model_b_id": mB.ID, "traffic_split": 60,
	})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/v1/models/abtest", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)
	assert.NotEmpty(t, w.Header().Get("X-Request-ID"))
}

func TestABTestHandlers_CreateInvalidBody(t *testing.T) {
	r, _ := setupABTestRouter(t)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/v1/models/abtest", bytes.NewBuffer([]byte("invalid")))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestABTestHandlers_GetActiveNone(t *testing.T) {
	r, _ := setupABTestRouter(t)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/v1/models/abtest/active", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestABTestHandlers_StopTest(t *testing.T) {
	r, repo := setupABTestRouter(t)
	mA, _ := repo.CreateModel(ModelVersion{
		Name: "A", Algorithm: "a", Version: "1",
		Metrics: ModelMetrics{F1Score: 0.9},
	})
	mB, _ := repo.CreateModel(ModelVersion{
		Name: "B", Algorithm: "b", Version: "2",
		Metrics: ModelMetrics{F1Score: 0.85},
	})

	// Create a test first
	createBody, _ := json.Marshal(map[string]interface{}{
		"name": "Test", "model_a_id": mA.ID, "model_b_id": mB.ID, "traffic_split": 50,
	})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/v1/models/abtest", bytes.NewBuffer(createBody))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusCreated, w.Code)

	var resp map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	testID := resp["test"].(map[string]interface{})["id"].(string)

	// Stop it
	stopBody, _ := json.Marshal(map[string]string{"test_id": testID})
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/v1/models/abtest/stop", bytes.NewBuffer(stopBody))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestABTestHandlers_StopMissingTestID(t *testing.T) {
	r, _ := setupABTestRouter(t)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/v1/models/abtest/stop", bytes.NewBuffer([]byte("{}")))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}
