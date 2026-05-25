package fraud

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// ModelHandler handles ML model management API requests.
type ModelHandler struct {
	repo    ModelRepository
	abTests ABTestService
}

// NewModelHandler creates a new model management handler.
func NewModelHandler(repo ModelRepository, abTests ABTestService) *ModelHandler {
	return &ModelHandler{repo: repo, abTests: abTests}
}

// ListModels handles GET /v1/models -- returns paginated model versions.
func (h *ModelHandler) ListModels(c *gin.Context) {
	requestID := generateRequestID()
	c.Header("X-Request-ID", requestID)

	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	statusFilter := c.Query("status")

	if limit <= 0 || limit > 100 {
		limit = 20
	}

	models, total, err := h.repo.ListModels(offset, limit, statusFilter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to list models", "request_id": requestID,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"models": models, "total": total,
		"offset": offset, "limit": limit,
		"request_id": requestID, "timestamp": time.Now(),
	})
}

// GetModel handles GET /v1/models/:id -- returns a single model version.
func (h *ModelHandler) GetModel(c *gin.Context) {
	requestID := generateRequestID()
	c.Header("X-Request-ID", requestID)

	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "model id is required", "request_id": requestID,
		})
		return
	}

	model, err := h.repo.GetModel(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": err.Error(), "request_id": requestID,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"model": model, "request_id": requestID, "timestamp": time.Now(),
	})
}

// CreateModel handles POST /v1/models -- registers a new model version.
func (h *ModelHandler) CreateModel(c *gin.Context) {
	requestID := generateRequestID()
	c.Header("X-Request-ID", requestID)

	var input ModelVersion
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body", "request_id": requestID,
		})
		return
	}

	if err := ValidateModelMetrics(input.Metrics); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(), "request_id": requestID,
		})
		return
	}

	model, err := h.repo.CreateModel(input)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(), "request_id": requestID,
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"model": model, "request_id": requestID, "timestamp": time.Now(),
	})
}

// UpdateModelStatus handles PUT /v1/models/:id/status.
func (h *ModelHandler) UpdateModelStatus(c *gin.Context) {
	requestID := generateRequestID()
	c.Header("X-Request-ID", requestID)

	id := c.Param("id")
	var body struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "status is required", "request_id": requestID,
		})
		return
	}

	status := ModelStatus(body.Status)
	if err := h.repo.UpdateModelStatus(id, status); err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": err.Error(), "request_id": requestID,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "status updated", "request_id": requestID,
		"timestamp": time.Now(),
	})
}

// CompareModels handles GET /v1/models/compare?model_a=X&model_b=Y.
func (h *ModelHandler) CompareModels(c *gin.Context) {
	requestID := generateRequestID()
	c.Header("X-Request-ID", requestID)

	idA := c.Query("model_a")
	idB := c.Query("model_b")
	if idA == "" || idB == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "model_a and model_b query params required", "request_id": requestID,
		})
		return
	}

	cmp, err := h.repo.CompareModels(idA, idB)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": err.Error(), "request_id": requestID,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"comparison": cmp, "request_id": requestID, "timestamp": time.Now(),
	})
}
