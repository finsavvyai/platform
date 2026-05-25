package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestHelloHandler_Hello(t *testing.T) {
	// Set Gin to test mode
	gin.SetMode(gin.TestMode)

	// Create a new router
	router := gin.New()

	// Create handler
	handler := NewHelloHandler()

	// Register route
	router.GET("/hello", handler.Hello)

	// Create a request
	req, _ := http.NewRequest("GET", "/hello", nil)
	w := httptest.NewRecorder()

	// Perform request
	router.ServeHTTP(w, req)

	// Assert status code
	assert.Equal(t, http.StatusOK, w.Code)

	// Parse response
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	// Assert response content
	assert.Equal(t, "Hello, World! Welcome to QuantumBeam API!", response["message"])
	assert.Equal(t, "success", response["status"])
	assert.Equal(t, "quantumbeam-api", response["service"])
}

func TestHelloHandler_Health(t *testing.T) {
	// Set Gin to test mode
	gin.SetMode(gin.TestMode)

	// Create a new router
	router := gin.New()

	// Create handler
	handler := NewHelloHandler()

	// Register route
	router.GET("/health", handler.Health)

	// Create a request
	req, _ := http.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()

	// Perform request
	router.ServeHTTP(w, req)

	// Assert status code
	assert.Equal(t, http.StatusOK, w.Code)

	// Parse response
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	// Assert response content
	assert.Equal(t, "healthy", response["status"])
	assert.Equal(t, "QuantumBeam API is running", response["message"])
}

func TestHelloHandler_RootRoute(t *testing.T) {
	// Set Gin to test mode
	gin.SetMode(gin.TestMode)

	// Create a new router
	router := gin.New()

	// Create handler
	handler := NewHelloHandler()

	// Register route
	router.GET("/", handler.Hello)

	// Create a request
	req, _ := http.NewRequest("GET", "/", nil)
	w := httptest.NewRecorder()

	// Perform request
	router.ServeHTTP(w, req)

	// Assert status code
	assert.Equal(t, http.StatusOK, w.Code)

	// Parse response
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	// Assert response content
	assert.Equal(t, "Hello, World! Welcome to QuantumBeam API!", response["message"])
	assert.Equal(t, "success", response["status"])
}
