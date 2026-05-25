package fraud

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// CreateABTest handles POST /v1/models/abtest -- creates a new A/B test.
func (h *ModelHandler) CreateABTest(c *gin.Context) {
	requestID := generateRequestID()
	c.Header("X-Request-ID", requestID)

	var input ABTestConfig
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body", "request_id": requestID,
		})
		return
	}

	test, err := h.abTests.CreateABTest(input)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(), "request_id": requestID,
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"test": test, "request_id": requestID, "timestamp": time.Now(),
	})
}

// GetActiveABTest handles GET /v1/models/abtest/active.
func (h *ModelHandler) GetActiveABTest(c *gin.Context) {
	requestID := generateRequestID()
	c.Header("X-Request-ID", requestID)

	test, err := h.abTests.GetActiveABTest()
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": err.Error(), "request_id": requestID,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"test": test, "request_id": requestID, "timestamp": time.Now(),
	})
}

// StopABTest handles POST /v1/models/abtest/stop.
func (h *ModelHandler) StopABTest(c *gin.Context) {
	requestID := generateRequestID()
	c.Header("X-Request-ID", requestID)

	var body struct {
		TestID string `json:"test_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "test_id is required", "request_id": requestID,
		})
		return
	}

	result, err := h.abTests.StopABTest(body.TestID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(), "request_id": requestID,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"result": result, "request_id": requestID, "timestamp": time.Now(),
	})
}
