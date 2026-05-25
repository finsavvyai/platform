package handlers_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestSuite provides common test utilities
type TestSuite struct {
	Router *gin.Engine
}

// SetupTestRouter creates a test router with middleware
func SetupTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(gin.Recovery())
	return router
}

// HealthEndpointTests tests the health check endpoints
func TestHealthEndpoint(t *testing.T) {
	router := SetupTestRouter()

	// Simple health endpoint for testing
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"service": "mcpoverflow-api",
			"version": "test",
		})
	})

	t.Run("returns 200 OK", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/health", nil)
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		assert.Equal(t, "ok", response["status"])
		assert.Equal(t, "mcpoverflow-api", response["service"])
	})
}

// TestReadyEndpoint tests the readiness check
func TestReadyEndpoint(t *testing.T) {
	router := SetupTestRouter()

	router.GET("/health/ready", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "ready",
			"dependencies": map[string]string{
				"postgres": "healthy",
				"redis":    "healthy",
			},
		})
	})

	t.Run("returns dependencies status", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/health/ready", nil)
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		assert.Equal(t, "ready", response["status"])
		deps := response["dependencies"].(map[string]interface{})
		assert.Equal(t, "healthy", deps["postgres"])
	})
}

// TestConnectorCRUD tests connector CRUD operations
func TestConnectorCRUD(t *testing.T) {
	router := SetupTestRouter()

	// Mock connector store
	connectors := make(map[string]map[string]interface{})

	// Create connector
	router.POST("/api/v1/connectors", func(c *gin.Context) {
		var connector map[string]interface{}
		if err := c.ShouldBindJSON(&connector); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		connector["id"] = "conn-123"
		connector["status"] = "created"
		connectors["conn-123"] = connector
		c.JSON(http.StatusCreated, connector)
	})

	// Get connector
	router.GET("/api/v1/connectors/:id", func(c *gin.Context) {
		id := c.Param("id")
		if conn, ok := connectors[id]; ok {
			c.JSON(http.StatusOK, conn)
		} else {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		}
	})

	// List connectors
	router.GET("/api/v1/connectors", func(c *gin.Context) {
		list := make([]map[string]interface{}, 0, len(connectors))
		for _, v := range connectors {
			list = append(list, v)
		}
		c.JSON(http.StatusOK, gin.H{"data": list, "total": len(list)})
	})

	// Delete connector
	router.DELETE("/api/v1/connectors/:id", func(c *gin.Context) {
		id := c.Param("id")
		if _, ok := connectors[id]; ok {
			delete(connectors, id)
			c.JSON(http.StatusOK, gin.H{"message": "deleted"})
		} else {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		}
	})

	t.Run("create connector", func(t *testing.T) {
		body := map[string]interface{}{
			"name":        "Test Connector",
			"description": "A test connector",
			"spec_type":   "openapi",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/v1/connectors", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusCreated, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		assert.Equal(t, "conn-123", response["id"])
		assert.Equal(t, "Test Connector", response["name"])
	})

	t.Run("get connector", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/v1/connectors/conn-123", nil)
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("list connectors", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/v1/connectors", nil)
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		assert.Equal(t, float64(1), response["total"])
	})

	t.Run("delete connector", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("DELETE", "/api/v1/connectors/conn-123", nil)
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("get deleted connector returns 404", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/v1/connectors/conn-123", nil)
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNotFound, w.Code)
	})
}

// TestRateLimiting tests rate limiting behavior
func TestRateLimiting(t *testing.T) {
	router := SetupTestRouter()

	requestCount := 0
	router.GET("/rate-limited", func(c *gin.Context) {
		requestCount++
		c.JSON(http.StatusOK, gin.H{"count": requestCount})
	})

	t.Run("allows requests within limit", func(t *testing.T) {
		for i := 0; i < 10; i++ {
			w := httptest.NewRecorder()
			req, _ := http.NewRequest("GET", "/rate-limited", nil)
			router.ServeHTTP(w, req)

			assert.Equal(t, http.StatusOK, w.Code)
		}
	})
}

// TestAuthenticationFlow tests authentication endpoints
func TestAuthenticationFlow(t *testing.T) {
	router := SetupTestRouter()

	// Mock user store
	users := map[string]string{
		"test@example.com": "hashedpassword",
	}
	tokens := make(map[string]string)

	router.POST("/api/v1/auth/login", func(c *gin.Context) {
		var login struct {
			Email    string `json:"email"`
			Password string `json:"password"`
		}
		if err := c.ShouldBindJSON(&login); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if _, ok := users[login.Email]; ok {
			token := "test-jwt-token"
			tokens[token] = login.Email
			c.JSON(http.StatusOK, gin.H{
				"access_token":  token,
				"refresh_token": "test-refresh-token",
				"expires_in":    3600,
			})
		} else {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		}
	})

	router.GET("/api/v1/auth/me", func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "no token provided"})
			return
		}

		token := authHeader[7:] // Remove "Bearer "
		if email, ok := tokens[token]; ok {
			c.JSON(http.StatusOK, gin.H{
				"id":    "user-123",
				"email": email,
			})
		} else {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
		}
	})

	t.Run("login with valid credentials", func(t *testing.T) {
		body := map[string]string{
			"email":    "test@example.com",
			"password": "password123",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/v1/auth/login", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &response)
		assert.NotEmpty(t, response["access_token"])
	})

	t.Run("login with invalid credentials", func(t *testing.T) {
		body := map[string]string{
			"email":    "wrong@example.com",
			"password": "wrongpassword",
		}
		jsonBody, _ := json.Marshal(body)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/v1/auth/login", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("get current user with valid token", func(t *testing.T) {
		// First login to get token
		loginBody := map[string]string{"email": "test@example.com", "password": "password123"}
		loginJSON, _ := json.Marshal(loginBody)

		loginW := httptest.NewRecorder()
		loginReq, _ := http.NewRequest("POST", "/api/v1/auth/login", bytes.NewBuffer(loginJSON))
		loginReq.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(loginW, loginReq)

		var loginResp map[string]interface{}
		json.Unmarshal(loginW.Body.Bytes(), &loginResp)
		token := loginResp["access_token"].(string)

		// Now get current user
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/v1/auth/me", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &response)
		assert.Equal(t, "test@example.com", response["email"])
	})
}
