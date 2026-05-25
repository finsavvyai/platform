package ml

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

// setupRegisteredRouter creates a gin engine with routes registered
// via RegisterRoutes and returns the engine and handler dependencies.
func setupRegisteredRouter() (*gin.Engine, *handlerMockOrchestrator) {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	detector := &handlerMockDetector{
		report: &DriftReport{
			ID:                "dr-1",
			TenantID:          "default",
			OverallDriftScore: 0.02,
			Recommendation:    DriftRecommendationStable,
			WindowHours:       24,
		},
	}
	orch := &handlerMockOrchestrator{
		jobs:  make([]*TrainingJob, 0),
		total: 0,
	}
	sched := NewRetrainScheduler(detector, orch, RetrainScheduleConfig{
		Frequency:      ScheduleFrequencyDaily,
		DriftThreshold: 0.1,
		CooldownHours:  6,
		Enabled:        true,
		ModelType:      "fraud_v2",
	})

	handler := NewRetrainingHandler(detector, orch, sched)
	group := r.Group("/api/v1/ml")
	RegisterRoutes(group, handler)

	return r, orch
}

func TestRegisterRoutes_AllRoutesExist(t *testing.T) {
	r, _ := setupRegisteredRouter()
	routes := r.Routes()

	expected := map[string]string{
		"GET:/api/v1/ml/drift/report":           "",
		"POST:/api/v1/ml/retrain/trigger":       "",
		"GET:/api/v1/ml/retrain/jobs":           "",
		"GET:/api/v1/ml/retrain/jobs/:job_id":   "",
		"GET:/api/v1/ml/retrain/schedule":       "",
		"PUT:/api/v1/ml/retrain/schedule":       "",
	}

	registered := make(map[string]bool)
	for _, ri := range routes {
		key := ri.Method + ":" + ri.Path
		registered[key] = true
	}

	for key := range expected {
		assert.True(t, registered[key], "route %s should be registered", key)
	}
	assert.Equal(t, len(expected), len(routes),
		"should have exactly %d routes", len(expected))
}

func TestRegisterRoutes_DriftReportEndpoint(t *testing.T) {
	r, _ := setupRegisteredRouter()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/ml/drift/report", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp DriftReport
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "dr-1", resp.ID)
}

func TestRegisterRoutes_ScheduleEndpoints(t *testing.T) {
	r, _ := setupRegisteredRouter()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/ml/retrain/schedule", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var cfg RetrainScheduleConfig
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &cfg))
	assert.Equal(t, ScheduleFrequencyDaily, cfg.Frequency)
	assert.Equal(t, "fraud_v2", cfg.ModelType)
}

// TestIntegration_TriggerListGetFlow exercises the full lifecycle:
// trigger a retrain job, list jobs, then retrieve the job by ID.
func TestIntegration_TriggerListGetFlow(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	orch := NewInMemoryOrchestrator()
	detector := &handlerMockDetector{report: &DriftReport{}}
	sched := NewRetrainScheduler(detector, orch, RetrainScheduleConfig{
		Frequency: ScheduleFrequencyDaily, DriftThreshold: 0.1,
		CooldownHours: 6, Enabled: true, ModelType: "fraud_v2",
	})
	handler := NewRetrainingHandler(detector, orch, sched)

	group := r.Group("/api/v1/ml")
	RegisterRoutes(group, handler)

	// Step 1: trigger retrain
	body, _ := json.Marshal(triggerRetrainRequest{ModelType: "fraud_v2"})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/v1/ml/retrain/trigger",
		bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", "tenant-1")
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusCreated, w.Code)
	var createdJob TrainingJob
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &createdJob))
	assert.Equal(t, JobStatusQueued, createdJob.Status)
	assert.NotEmpty(t, createdJob.ID)

	// Step 2: list jobs
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/api/v1/ml/retrain/jobs", nil)
	req.Header.Set("X-Tenant-ID", "tenant-1")
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var listResp listJobsResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &listResp))
	assert.Equal(t, 1, listResp.Total)
	require.Len(t, listResp.Jobs, 1)
	assert.Equal(t, createdJob.ID, listResp.Jobs[0].ID)

	// Step 3: get job by ID
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET",
		"/api/v1/ml/retrain/jobs/"+createdJob.ID, nil)
	req.Header.Set("X-Tenant-ID", "tenant-1")
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var fetchedJob TrainingJob
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &fetchedJob))
	assert.Equal(t, createdJob.ID, fetchedJob.ID)
	assert.Equal(t, "tenant-1", fetchedJob.TenantID)
}

func TestIntegration_GetJobNotFound(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	orch := NewInMemoryOrchestrator()
	detector := &handlerMockDetector{report: &DriftReport{}}
	sched := NewRetrainScheduler(detector, orch, RetrainScheduleConfig{
		Frequency: ScheduleFrequencyDaily, DriftThreshold: 0.1,
		CooldownHours: 6, Enabled: true, ModelType: "fraud_v2",
	})
	handler := NewRetrainingHandler(detector, orch, sched)

	group := r.Group("/api/v1/ml")
	RegisterRoutes(group, handler)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET",
		"/api/v1/ml/retrain/jobs/nonexistent", nil)
	req.Header.Set("X-Tenant-ID", "tenant-1")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}
