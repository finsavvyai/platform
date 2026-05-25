package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// HelloHandler handles hello world requests
type HelloHandler struct{}

// NewHelloHandler creates a new HelloHandler
func NewHelloHandler() *HelloHandler {
	return &HelloHandler{}
}

// Hello responds with a hello world message
func (h *HelloHandler) Hello(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"message": "Hello, World! Welcome to QuantumBeam API!",
		"status":  "success",
		"service": "quantumbeam-api",
	})
}

// Health responds with health status
func (h *HelloHandler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "healthy",
		"message": "QuantumBeam API is running",
	})
}
