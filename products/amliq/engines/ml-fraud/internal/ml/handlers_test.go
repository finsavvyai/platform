package ml

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// handlerMockDetector implements DriftDetector for handler tests.
type handlerMockDetector struct {
	report *DriftReport
	err    error
}

func (m *handlerMockDetector) Detect(_ context.Context, _ string, _ int) (*DriftReport, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.report, nil
}

// handlerMockOrchestrator implements TrainingOrchestrator for handler tests.
type handlerMockOrchestrator struct {
	job    *TrainingJob
	jobs   []*TrainingJob
	total  int
	err    error
	getErr error
}

func (m *handlerMockOrchestrator) TriggerRetrain(_ context.Context, _, _ string) (*TrainingJob, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.job, nil
}

func (m *handlerMockOrchestrator) GetJobStatus(_ context.Context, _, jobID string) (*TrainingJob, error) {
	if m.getErr != nil {
		return nil, m.getErr
	}
	for _, j := range m.jobs {
		if j.ID == jobID {
			return j, nil
		}
	}
	return nil, ErrJobNotFound
}

func (m *handlerMockOrchestrator) ListJobs(_ context.Context, _ string, limit, offset int) ([]*TrainingJob, int, error) {
	if m.err != nil {
		return nil, 0, m.err
	}
	end := offset + limit
	if end > len(m.jobs) {
		end = len(m.jobs)
	}
	if offset >= len(m.jobs) {
		return []*TrainingJob{}, m.total, nil
	}
	return m.jobs[offset:end], m.total, nil
}

func setupRouter(h *RetrainingHandler) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/drift", h.GetDriftReport)
	r.POST("/retrain", h.TriggerRetrain)
	r.GET("/jobs", h.ListJobs)
	r.GET("/jobs/:job_id", h.GetJobStatus)
	r.GET("/schedule", h.GetSchedule)
	r.PUT("/schedule", h.UpdateSchedule)
	return r
}

func TestGetDriftReportSuccess(t *testing.T) {
	report := &DriftReport{
		ID: "dr-1", TenantID: "t1", Timestamp: time.Now(),
		OverallDriftScore: 0.05, Recommendation: DriftRecommendationStable, WindowHours: 24,
	}
	h := NewRetrainingHandler(&handlerMockDetector{report: report}, &handlerMockOrchestrator{}, nil)
	r := setupRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/drift?window_hours=12", nil)
	req.Header.Set("X-Tenant-ID", "t1")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp DriftReport
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "dr-1", resp.ID)
}

func TestTriggerRetrainSuccess(t *testing.T) {
	now := time.Now().UTC()
	job := &TrainingJob{
		ID: "j-1", TenantID: "default", ModelType: "fraud_v2",
		Status: JobStatusQueued, CreatedAt: now,
	}
	h := NewRetrainingHandler(nil, &handlerMockOrchestrator{job: job}, nil)
	r := setupRouter(h)

	body, _ := json.Marshal(triggerRetrainRequest{ModelType: "fraud_v2"})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/retrain", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)
	var resp TrainingJob
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "j-1", resp.ID)
	assert.Equal(t, JobStatusQueued, resp.Status)
}

func TestTriggerRetrainConflict(t *testing.T) {
	h := NewRetrainingHandler(nil, &handlerMockOrchestrator{err: ErrActiveJobExists}, nil)
	r := setupRouter(h)

	body, _ := json.Marshal(triggerRetrainRequest{ModelType: "fraud_v2"})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/retrain", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusConflict, w.Code)
}

func TestListJobsWithPagination(t *testing.T) {
	jobs := make([]*TrainingJob, 5)
	for i := range jobs {
		jobs[i] = &TrainingJob{ID: "j-" + string(rune('a'+i)), TenantID: "default"}
	}
	h := NewRetrainingHandler(nil, &handlerMockOrchestrator{jobs: jobs, total: 5}, nil)
	r := setupRouter(h)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/jobs?limit=2&offset=1", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp listJobsResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Len(t, resp.Jobs, 2)
	assert.Equal(t, 5, resp.Total)
}
