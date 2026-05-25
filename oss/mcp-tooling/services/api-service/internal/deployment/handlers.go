package deployment

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/mcpoverflow/api-service/internal/models"
)

// DeployWorkerHandler handles worker deployment requests
func (s *CloudflareService) DeployWorkerHandler(c *gin.Context) {
	var req DeploymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
		return
	}

	// Validate request
	if req.ConnectorID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Connector ID is required",
			"code":  "MISSING_CONNECTOR_ID",
		})
		return
	}

	if req.Version == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Version is required",
			"code":  "MISSING_VERSION",
		})
		return
	}

	if req.Environment == "" {
		req.Environment = "production"
	}

	// Deploy worker
	response, err := s.DeployWorker(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to deploy worker",
			"details": err.Error(),
			"code":    "DEPLOYMENT_FAILED",
		})
		return
	}

	c.JSON(http.StatusOK, response)
}

// UpdateWorkerHandler handles worker update requests
func (s *CloudflareService) UpdateWorkerHandler(c *gin.Context) {
	connectorID := c.Param("connectorId")
	if connectorID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Connector ID is required",
			"code":  "MISSING_CONNECTOR_ID",
		})
		return
	}

	var req struct {
		Version string                 `json:"version"`
		Config  CloudflareWorkerConfig `json:"config"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
		return
	}

	if req.Version == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Version is required",
			"code":  "MISSING_VERSION",
		})
		return
	}

	response, err := s.UpdateWorker(c.Request.Context(), connectorID, req.Version, req.Config)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to update worker",
			"details": err.Error(),
			"code":    "UPDATE_FAILED",
		})
		return
	}

	c.JSON(http.StatusOK, response)
}

// DeleteWorkerHandler handles worker deletion requests
func (s *CloudflareService) DeleteWorkerHandler(c *gin.Context) {
	connectorID := c.Param("connectorId")
	if connectorID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Connector ID is required",
			"code":  "MISSING_CONNECTOR_ID",
		})
		return
	}

	err := s.DeleteWorker(c.Request.Context(), connectorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to delete worker",
			"details": err.Error(),
			"code":    "DELETION_FAILED",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Worker deleted successfully",
	})
}

// GetWorkerStatusHandler handles worker status requests
func (s *CloudflareService) GetWorkerStatusHandler(c *gin.Context) {
	connectorID := c.Param("connectorId")
	if connectorID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Connector ID is required",
			"code":  "MISSING_CONNECTOR_ID",
		})
		return
	}

	status, err := s.GetWorkerStatus(c.Request.Context(), connectorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get worker status",
			"details": err.Error(),
			"code":    "STATUS_CHECK_FAILED",
		})
		return
	}

	c.JSON(http.StatusOK, status)
}

// ListDeploymentsHandler handles listing deployments for a connector
func (s *CloudflareService) ListDeploymentsHandler(c *gin.Context) {
	connectorID := c.Query("connector_id")
	if connectorID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Connector ID is required",
			"code":  "MISSING_CONNECTOR_ID",
		})
		return
	}

	deployments, err := s.ListDeployments(c.Request.Context(), connectorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to list deployments",
			"details": err.Error(),
			"code":    "LIST_DEPLOYMENTS_FAILED",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"deployments": deployments,
		"count":       len(deployments),
	})
}

// RollbackDeploymentHandler handles rollback requests
func (s *CloudflareService) RollbackDeploymentHandler(c *gin.Context) {
	connectorID := c.Param("connectorId")
	if connectorID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Connector ID is required",
			"code":  "MISSING_CONNECTOR_ID",
		})
		return
	}

	var req struct {
		TargetVersion string `json:"target_version"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
		return
	}

	if req.TargetVersion == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Target version is required",
			"code":  "MISSING_TARGET_VERSION",
		})
		return
	}

	response, err := s.RollbackDeployment(c.Request.Context(), connectorID, req.TargetVersion)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to rollback deployment",
			"details": err.Error(),
			"code":    "ROLLBACK_FAILED",
		})
		return
	}

	c.JSON(http.StatusOK, response)
}

// GetDeploymentLogsHandler handles deployment log requests
func (s *CloudflareService) GetDeploymentLogsHandler(c *gin.Context) {
	connectorID := c.Param("connectorId")
	if connectorID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Connector ID is required",
			"code":  "MISSING_CONNECTOR_ID",
		})
		return
	}

	// Parse query parameters
	limitStr := c.DefaultQuery("limit", "100")
	offsetStr := c.DefaultQuery("offset", "0")
	level := c.DefaultQuery("level", "info")

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 || limit > 1000 {
		limit = 100
	}

	offset, err := strconv.Atoi(offsetStr)
	if err != nil || offset < 0 {
		offset = 0
	}

	// Get logs from database or external logging service
	logs, err := s.getDeploymentLogs(c.Request.Context(), connectorID, level, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get deployment logs",
			"details": err.Error(),
			"code":    "LOGS_FAILED",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"logs":   logs,
		"limit":  limit,
		"offset": offset,
		"level":  level,
	})
}

// getDeploymentLogs retrieves deployment logs from storage
func (s *CloudflareService) getDeploymentLogs(ctx context.Context, connectorID, level string, limit, offset int) ([]models.DeploymentLog, error) {
	var logs []models.DeploymentLog

	// Query logs with filters
	query := s.db.Where("connector_id = ?", connectorID)

	if level != "all" {
		query = query.Where("level = ?", level)
	}

	err := query.Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&logs).Error

	if err != nil {
		return nil, err
	}

	return logs, nil
}

// BatchDeployHandler handles batch deployment of multiple connectors
func (s *CloudflareService) BatchDeployHandler(c *gin.Context) {
	var req struct {
		Deployments []DeploymentRequest `json:"deployments"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request body",
			"details": err.Error(),
		})
		return
	}

	if len(req.Deployments) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "At least one deployment is required",
			"code":  "NO_DEPLOYMENTS",
		})
		return
	}

	if len(req.Deployments) > 10 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Maximum 10 deployments allowed per batch",
			"code":  "TOO_MANY_DEPLOYMENTS",
		})
		return
	}

	results := make([]BatchDeploymentResult, len(req.Deployments))

	// Process deployments in parallel (in production, use goroutines with proper error handling)
	for i, deployment := range req.Deployments {
		response, err := s.DeployWorker(c.Request.Context(), &deployment)
		if err != nil {
			results[i] = BatchDeploymentResult{
				ConnectorID: deployment.ConnectorID,
				Success:     false,
				Error:       err.Error(),
			}
		} else {
			results[i] = BatchDeploymentResult{
				ConnectorID: deployment.ConnectorID,
				Success:     true,
				Response:    response,
			}
		}
	}

	successCount := 0
	for _, result := range results {
		if result.Success {
			successCount++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"results":       results,
		"total":         len(req.Deployments),
		"success_count": successCount,
		"failure_count": len(req.Deployments) - successCount,
	})
}

// BatchDeploymentResult represents the result of a batch deployment
type BatchDeploymentResult struct {
	ConnectorID string              `json:"connector_id"`
	Success     bool                `json:"success"`
	Response    *DeploymentResponse `json:"response,omitempty"`
	Error       string              `json:"error,omitempty"`
}

// ValidateDeploymentHandler handles deployment validation requests
func (s *CloudflareService) ValidateDeploymentHandler(c *gin.Context) {
	connectorID := c.Param("connectorId")
	if connectorID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Connector ID is required",
			"code":  "MISSING_CONNECTOR_ID",
		})
		return
	}

	validation, err := s.validateDeployment(c.Request.Context(), connectorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to validate deployment",
			"details": err.Error(),
			"code":    "VALIDATION_FAILED",
		})
		return
	}

	c.JSON(http.StatusOK, validation)
}

// validateDeployment performs pre-deployment validation
func (s *CloudflareService) validateDeployment(ctx context.Context, connectorID string) (*DeploymentValidation, error) {
	// Get connector
	var connector models.Connector
	if err := s.db.First(&connector, "id = ?", connectorID).Error; err != nil {
		return nil, err
	}

	validation := &DeploymentValidation{
		ConnectorID: connectorID,
		Valid:       true,
		Issues:      []string{},
		Warnings:    []string{},
	}

	// Check if generated code exists
	if connector.GeneratedCode == "" {
		validation.Valid = false
		validation.Issues = append(validation.Issues, "No generated code found")
	}

	// Check if authentication is properly configured
	if connector.Config.Auth.Type == "api_key" {
		if _, ok := connector.Config.Auth.Settings["api_key"]; !ok {
			validation.Valid = false
			validation.Issues = append(validation.Issues, "API key authentication configured but no API key provided")
		}
	}

	// Check for required environment variables
	requiredVars := map[string]bool{
		"CLOUDFLARE_API_TOKEN":  false,
		"CLOUDFLARE_ACCOUNT_ID": false,
	}

	for varName := range requiredVars {
		if os.Getenv(varName) != "" {
			requiredVars[varName] = true
		}
	}

	for varName, exists := range requiredVars {
		if !exists {
			validation.Warnings = append(validation.Warnings, fmt.Sprintf("Environment variable %s not set", varName))
		}
	}

	return validation, nil
}

// DeploymentValidation represents the result of deployment validation
type DeploymentValidation struct {
	ConnectorID string   `json:"connector_id"`
	Valid       bool     `json:"valid"`
	Issues      []string `json:"issues"`
	Warnings    []string `json:"warnings"`
}
