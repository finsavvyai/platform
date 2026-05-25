package compliance

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
)

// ComplianceHandler exposes compliance management via HTTP endpoints.
type ComplianceHandler struct {
	registry  ControlRegistry
	generator *ReportGenerator
}

// NewComplianceHandler creates a handler with the given registry and generator.
func NewComplianceHandler(
	registry ControlRegistry,
	generator *ReportGenerator,
) *ComplianceHandler {
	return &ComplianceHandler{
		registry:  registry,
		generator: generator,
	}
}

// RegisterRoutes wires all compliance endpoints onto the given router group.
func (h *ComplianceHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/frameworks", h.ListFrameworks)
	rg.GET("/controls", h.ListControls)
	rg.GET("/controls/:id/evidence", h.GetControlEvidence)
	rg.POST("/evidence/collect", h.CollectEvidence)
	rg.GET("/report", h.GenerateReport)
	rg.GET("/dashboard", h.GetDashboard)
	rg.POST("/controls/:id/override", h.OverrideControlStatus)
}

// ListFrameworks returns the list of available compliance frameworks.
func (h *ComplianceHandler) ListFrameworks(c *gin.Context) {
	frameworks := h.registry.ListFrameworks()
	c.JSON(http.StatusOK, gin.H{"frameworks": frameworks})
}

// ListControls returns controls filtered by the framework query parameter.
func (h *ComplianceHandler) ListControls(c *gin.Context) {
	fw := c.Query("framework")
	if fw == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "framework query parameter is required"})
		return
	}

	framework := ComplianceFramework(fw)
	if !isValidFramework(framework) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid framework: " + fw})
		return
	}

	controls, err := h.registry.GetControls(framework)
	if err != nil {
		if errors.Is(err, ErrFrameworkNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "framework not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get controls"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"controls": controls})
}

// GetControlEvidence returns evidence items for a specific control.
func (h *ComplianceHandler) GetControlEvidence(c *gin.Context) {
	controlID := c.Param("id")

	_, err := h.registry.GetControl(controlID)
	if err != nil {
		if errors.Is(err, ErrControlNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "control not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get control"})
		return
	}

	// Return empty evidence list; real collection is via POST /evidence/collect.
	c.JSON(http.StatusOK, gin.H{"evidence": []EvidenceItem{}})
}

// getTenantID extracts the tenant identifier from the request header.
func getTenantID(c *gin.Context) string {
	tid := c.GetHeader("X-Tenant-ID")
	if tid == "" {
		return "default"
	}
	return tid
}
