package adapter

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/queryflux/backend/internal/domain"
	"github.com/queryflux/backend/internal/service"
)

type ConnectionHandler struct {
	connService *service.ConnectionService
}

func NewConnectionHandler(connService *service.ConnectionService) *ConnectionHandler {
	return &ConnectionHandler{connService: connService}
}

func (h *ConnectionHandler) RegisterRoutes(group *gin.RouterGroup) {
	conns := group.Group("/connections")
	{
		conns.POST("", h.createConnection)
		conns.GET("", h.listConnections)
		conns.GET("/:id", h.getConnection)
		conns.PUT("/:id", h.updateConnection)
		conns.DELETE("/:id", h.deleteConnection)
		conns.POST("/:id/test", h.testConnection)
	}
}

func (h *ConnectionHandler) createConnection(c *gin.Context) {
	userID, ok := GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, domain.ErrorResponse("user not authenticated"))
		return
	}

	var req domain.CreateConnectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse(err.Error()))
		return
	}

	conn, err := h.connService.Create(c.Request.Context(), userID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse(err.Error()))
		return
	}

	c.JSON(http.StatusCreated, domain.SuccessResponse(conn))
}

func (h *ConnectionHandler) listConnections(c *gin.Context) {
	userID, ok := GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, domain.ErrorResponse("user not authenticated"))
		return
	}

	connections, err := h.connService.ListByUser(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse(err.Error()))
		return
	}

	if connections == nil {
		connections = []domain.Connection{}
	}

	c.JSON(http.StatusOK, domain.SuccessResponse(connections))
}

func (h *ConnectionHandler) getConnection(c *gin.Context) {
	userID, ok := GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, domain.ErrorResponse("user not authenticated"))
		return
	}

	conn, err := h.connService.GetByID(c.Request.Context(), userID, c.Param("id"))
	if err != nil {
		status := http.StatusNotFound
		if err == service.ErrUnauthorized {
			status = http.StatusForbidden
		}
		c.JSON(status, domain.ErrorResponse(err.Error()))
		return
	}

	c.JSON(http.StatusOK, domain.SuccessResponse(conn))
}

func (h *ConnectionHandler) updateConnection(c *gin.Context) {
	userID, ok := GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, domain.ErrorResponse("user not authenticated"))
		return
	}

	var req domain.UpdateConnectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse(err.Error()))
		return
	}

	conn, err := h.connService.Update(c.Request.Context(), userID, c.Param("id"), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse(err.Error()))
		return
	}

	c.JSON(http.StatusOK, domain.SuccessResponse(conn))
}

func (h *ConnectionHandler) deleteConnection(c *gin.Context) {
	userID, ok := GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, domain.ErrorResponse("user not authenticated"))
		return
	}

	if err := h.connService.Delete(c.Request.Context(), userID, c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse(err.Error()))
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

func (h *ConnectionHandler) testConnection(c *gin.Context) {
	userID, ok := GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, domain.ErrorResponse("user not authenticated"))
		return
	}

	conn, err := h.connService.GetByID(c.Request.Context(), userID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, domain.ErrorResponse(err.Error()))
		return
	}

	password, err := h.connService.DecryptPassword(conn.EncryptedPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse("failed to decrypt credentials"))
		return
	}

	dsn := fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=%s",
		conn.Username, password, conn.Host, conn.Port, conn.Database, conn.SSLMode,
	)

	start := time.Now()
	testAdapter, adapterErr := NewPostgresAdapter(dsn)
	latency := time.Since(start).Seconds() * 1000

	if adapterErr != nil {
		c.JSON(http.StatusOK, domain.SuccessResponse(domain.TestConnectionResponse{
			Success: false, Message: adapterErr.Error(),
		}))
		return
	}
	defer testAdapter.Close()

	c.JSON(http.StatusOK, domain.SuccessResponse(domain.TestConnectionResponse{
		Success: true, Message: "connection successful", LatencyMs: latency,
	}))
}
