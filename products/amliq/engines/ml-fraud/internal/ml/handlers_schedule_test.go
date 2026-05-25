package ml

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetJobStatusSuccess(t *testing.T) {
	job := &TrainingJob{ID: "j-99", TenantID: "default", Status: JobStatusCompleted}
	h := NewRetrainingHandler(nil, &handlerMockOrchestrator{jobs: []*TrainingJob{job}}, nil)
	r := setupRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/jobs/j-99", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp TrainingJob
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "j-99", resp.ID)
}

func TestGetJobStatusNotFound(t *testing.T) {
	h := NewRetrainingHandler(nil, &handlerMockOrchestrator{jobs: []*TrainingJob{}}, nil)
	r := setupRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/jobs/nonexistent", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestGetScheduleReturnsConfig(t *testing.T) {
	cfg := RetrainScheduleConfig{
		Frequency: ScheduleFrequencyDaily, DriftThreshold: 0.3,
		CooldownHours: 6, Enabled: true, ModelType: "fraud_v2",
	}
	sched := NewRetrainScheduler(&handlerMockDetector{}, &handlerMockOrchestrator{}, cfg)
	h := NewRetrainingHandler(nil, nil, sched)
	r := setupRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/schedule", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp RetrainScheduleConfig
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, ScheduleFrequencyDaily, resp.Frequency)
	assert.Equal(t, 0.3, resp.DriftThreshold)
}

func TestUpdateScheduleSuccess(t *testing.T) {
	cfg := RetrainScheduleConfig{
		Frequency: ScheduleFrequencyDaily, DriftThreshold: 0.3,
		CooldownHours: 6, Enabled: true, ModelType: "fraud_v2",
	}
	sched := NewRetrainScheduler(&handlerMockDetector{}, &handlerMockOrchestrator{}, cfg)
	h := NewRetrainingHandler(nil, nil, sched)
	r := setupRouter(h)

	newCfg := RetrainScheduleConfig{
		Frequency: ScheduleFrequencyWeekly, DriftThreshold: 0.5,
		CooldownHours: 12, Enabled: false, ModelType: "fraud_v3",
	}
	body, _ := json.Marshal(newCfg)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("PUT", "/schedule", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp RetrainScheduleConfig
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, ScheduleFrequencyWeekly, resp.Frequency)
	assert.Equal(t, 0.5, resp.DriftThreshold)
	assert.Equal(t, "fraud_v3", resp.ModelType)
}
