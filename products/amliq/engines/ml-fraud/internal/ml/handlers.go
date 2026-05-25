package ml

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// RetrainingHandler exposes HTTP endpoints for ML retraining management.
type RetrainingHandler struct {
	detector     DriftDetector
	orchestrator TrainingOrchestrator
	scheduler    *RetrainScheduler
}

// NewRetrainingHandler creates a handler with the given dependencies.
func NewRetrainingHandler(
	detector DriftDetector,
	orchestrator TrainingOrchestrator,
	scheduler *RetrainScheduler,
) *RetrainingHandler {
	return &RetrainingHandler{
		detector:     detector,
		orchestrator: orchestrator,
		scheduler:    scheduler,
	}
}

// getTenantID extracts the tenant identifier from the request header.
func getTenantID(c *gin.Context) string {
	tid := c.GetHeader("X-Tenant-ID")
	if tid == "" {
		return "default"
	}
	return tid
}

// GetDriftReport returns the current drift analysis for a tenant.
func (h *RetrainingHandler) GetDriftReport(c *gin.Context) {
	tenantID := getTenantID(c)
	windowHours := 24
	if wh := c.Query("window_hours"); wh != "" {
		parsed, err := strconv.Atoi(wh)
		if err != nil || parsed < 1 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "window_hours must be a positive integer"})
			return
		}
		windowHours = parsed
	}

	report, err := h.detector.Detect(c.Request.Context(), tenantID, windowHours)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, report)
}

// triggerRetrainRequest is the JSON body for TriggerRetrain.
type triggerRetrainRequest struct {
	ModelType string `json:"model_type"`
}

// TriggerRetrain starts a new model retraining job.
func (h *RetrainingHandler) TriggerRetrain(c *gin.Context) {
	var req triggerRetrainRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if req.ModelType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "model_type is required"})
		return
	}

	tenantID := getTenantID(c)
	job, err := h.orchestrator.TriggerRetrain(c.Request.Context(), tenantID, req.ModelType)
	if err != nil {
		if errors.Is(err, ErrActiveJobExists) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, job)
}

// listJobsResponse wraps paginated job results.
type listJobsResponse struct {
	Jobs  []*TrainingJob `json:"jobs"`
	Total int            `json:"total"`
}

// ListJobs returns paginated training jobs for the tenant.
func (h *RetrainingHandler) ListJobs(c *gin.Context) {
	tenantID := getTenantID(c)
	limit, offset := 20, 0

	if l := c.Query("limit"); l != "" {
		parsed, err := strconv.Atoi(l)
		if err != nil || parsed < 1 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "limit must be a positive integer"})
			return
		}
		limit = parsed
	}
	if o := c.Query("offset"); o != "" {
		parsed, err := strconv.Atoi(o)
		if err != nil || parsed < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "offset must be a non-negative integer"})
			return
		}
		offset = parsed
	}

	jobs, total, err := h.orchestrator.ListJobs(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, listJobsResponse{Jobs: jobs, Total: total})
}

// GetJobStatus returns a single training job by ID.
func (h *RetrainingHandler) GetJobStatus(c *gin.Context) {
	tenantID := getTenantID(c)
	jobID := c.Param("job_id")

	job, err := h.orchestrator.GetJobStatus(c.Request.Context(), tenantID, jobID)
	if err != nil {
		if errors.Is(err, ErrJobNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "job not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, job)
}

// GetSchedule returns the current retrain schedule configuration.
func (h *RetrainingHandler) GetSchedule(c *gin.Context) {
	cfg := h.scheduler.GetConfig()
	c.JSON(http.StatusOK, cfg)
}

// UpdateSchedule replaces the retrain schedule configuration.
func (h *RetrainingHandler) UpdateSchedule(c *gin.Context) {
	var cfg RetrainScheduleConfig
	if err := c.ShouldBindJSON(&cfg); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if err := ValidateScheduleConfig(cfg); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.scheduler.UpdateConfig(cfg)
	c.JSON(http.StatusOK, h.scheduler.GetConfig())
}
