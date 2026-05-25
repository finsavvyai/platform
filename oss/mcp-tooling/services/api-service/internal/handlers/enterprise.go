package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/mcpoverflow/api-service/internal/config"
	"github.com/mcpoverflow/api-service/internal/services"
)

type EnterpriseHandler struct {
	paymentService *services.PaymentService
	cfg            *config.Config
}

func NewEnterpriseHandler(cfg *config.Config) *EnterpriseHandler {
	return &EnterpriseHandler{
		paymentService: services.NewPaymentService(),
		cfg:            cfg,
	}
}

// RequestDemo handles enterprise demo requests
func (h *EnterpriseHandler) RequestDemo(c *gin.Context) {
	var req struct {
		FirstName   string `json:"first_name" binding:"required"`
		LastName    string `json:"last_name" binding:"required"`
		Email       string `json:"email" binding:"required,email"`
		Company     string `json:"company" binding:"required"`
		Description string `json:"description"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// In reality: Trigger CRM workflow, email sales team, etc.
	c.JSON(http.StatusOK, gin.H{
		"message": "Demo request received",
		"id":      "demo_req_12345",
	})
}

// CreatePaymentIntent handles payment intent creation
func (h *EnterpriseHandler) CreatePaymentIntent(c *gin.Context) {
	var req services.CreatePaymentParams
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.paymentService.CreatePayment(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// GetDedicatedConfig returns configuration for dedicated deployments
func (h *EnterpriseHandler) GetDedicatedConfig(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"regions": []string{
			"us-east-1-dedicated",
			"eu-west-1-dedicated",
		},
		"instance_types": []string{
			"m5.large",
			"m5.xlarge",
			"c5.xlarge",
		},
		"isolation_levels": []string{
			"pod",
			"node",
			"cluster",
		},
	})
}
