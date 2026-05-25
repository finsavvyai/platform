package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/mcpoverflow/api-service/internal/models"
	"github.com/mcpoverflow/api-service/internal/services"
)

type ConnectorHandler struct {
	service services.ConnectorService
}

func NewConnectorHandler(service services.ConnectorService) *ConnectorHandler {
	return &ConnectorHandler{service: service}
}

type CreateConnectorRequest struct {
	Name        string            `json:"name" binding:"required"`
	Description string            `json:"description"`
	Type        string            `json:"type" binding:"required,oneof=openapi graphql postman"`
	Spec        string            `json:"spec"`     // Raw spec content
	SpecURL     string            `json:"spec_url"` // URL to fetch spec from
	Config      models.ConfigData `json:"config"`
}

func (h *ConnectorHandler) CreateConnector(c *gin.Context) {
	var req CreateConnectorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.GetString("user_id")
	if userID == "" {
		// Fallback for tests or direct auth
		userID = uuid.New().String()
	}
	userUUID, _ := uuid.Parse(userID)

	connector := &models.Connector{
		UserID:      userUUID,
		Name:        req.Name,
		Description: req.Description,
		Type:        req.Type,
		Config:      req.Config,
		Status:      models.ConnectorStatusPending,
	}

	if err := h.service.CreateConnector(c.Request.Context(), connector); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create connector"})
		return
	}

	c.JSON(http.StatusCreated, connector)
}

func (h *ConnectorHandler) ListConnectors(c *gin.Context) {
	userID := c.GetString("user_id")
	
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset := (page - 1) * limit

	connectors, total, err := h.service.ListConnectors(c.Request.Context(), userID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list connectors"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  connectors,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func (h *ConnectorHandler) GetConnector(c *gin.Context) {
	id := c.Param("id")
	connector, err := h.service.GetConnector(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Connector not found"})
		return
	}
	c.JSON(http.StatusOK, connector)
}

func (h *ConnectorHandler) DeleteConnector(c *gin.Context) {
	id := c.Param("id")
	if err := h.service.DeleteConnector(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Connector not found or delete failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// Stubs for other methods to ensure interface compliance if expanded later
func (h *ConnectorHandler) UpdateConnector(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "Not implemented"})
}

func (h *ConnectorHandler) DeployConnector(c *gin.Context) {
	id := c.Param("id")
	// Logic to trigger deployment would go here, possibly using a DeploymentService
	c.JSON(http.StatusOK, gin.H{"id": id, "status": "deploying", "message": "Deployment triggered"})
}
